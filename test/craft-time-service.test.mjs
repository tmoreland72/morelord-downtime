import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { CraftTimeService } from "../scripts/services/craft-time-service.mjs";
import { isPrimaryActiveGm } from "../scripts/services/primary-gm.mjs";
import { registerCraftTimeTracking } from "../scripts/integrations/craft-time-tracking.mjs";
import { formatHistory } from "../scripts/ui/history.mjs";

function world() {
  let stored = null;
  let sessionId = 0;
  let segmentId = 0;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const sessions = new SessionService({
    repository,
    idFactory: () => `session-${++sessionId}`,
    segmentIdFactory: () => `segment-${++segmentId}`,
    now: () => 100
  });
  const jobs = new Map();
  const notices = [];
  const integration = {
    listProjects: async ({ crafterUuid }) => jobs.get(crafterUuid) ?? [],
    getProject: async ({ recipeId, crafterUuid }) => (jobs.get(crafterUuid) ?? []).find(job => job.recipeId === recipeId) ?? null,
    getRecipe: id => ({ id, name: id === "potion" ? "Healing Potion" : "Longsword" })
  };
  const actor = { id: "aric", uuid: "Actor.aric", name: "Aric", type: "character" };
  const service = new CraftTimeService({
    repository,
    getIntegration: () => integration,
    getActors: () => [actor],
    now: () => 500,
    notify: message => notices.push(message)
  });
  return { repository, sessions, jobs, notices, integration, actor, service };
}

function job(recipeId, timeSpentHours, extra = {}) {
  return { recipeId, inventoryActorUuid: "Actor.aric", timeSpentHours, ...extra };
}

async function startSession(sessions, { hours = 8, actorUuid = "Actor.aric", name = "Aric", activities = ["crafting"] } = {}) {
  const session = await sessions.create({
    name: "Crafting Week",
    plannedDurationHours: hours,
    participants: [{ actorUuid, name }],
    availableActivities: activities
  });
  await sessions.publish(session.id);
  return sessions.start(session.id);
}

test("existing crafting time is baselined and a later check updates the active Session once", async () => {
  const { repository, sessions, jobs, notices, actor, service } = world();
  jobs.set(actor.uuid, [job("potion", 4)]);
  const started = await startSession(sessions);
  assert.equal((await service.baseline()).hours, 4);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 4);

  jobs.set(actor.uuid, [job("potion", 6)]);
  const recorded = await service.reconcileActor(actor);
  assert.equal(recorded.hours, 2);
  const state = await repository.read();
  const participant = state.segments[started.segment.id].participants[0];
  assert.equal(participant.allocatedHours, 6);
  assert.equal(participant.availableHours - participant.allocatedHours, 2);
  assert.equal(state.sessions[started.session.id].history.at(-1).type, "craft-time");
  assert.equal(state.sessions[started.session.id].history.at(-1).data.recipeName, "Healing Potion");
  assert.equal(state.craftTimeLedger[actor.uuid].potion, 6);
  assert.match(notices.at(-1), /Aric spent 2 hours crafting Healing Potion/);

  jobs.set(actor.uuid, [job("potion", 6)]);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 6);
});

test("the ready baseline records crafting that changed while this client was not recording", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  const started = await startSession(sessions);
  jobs.set(actor.uuid, [job("potion", 0)]);
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 2)]);
  assert.equal((await service.baseline()).hours, 2);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 2);
});

test("a failed check's spent time is recorded even though crafting progress did not advance", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  const started = await startSession(sessions);
  jobs.set(actor.uuid, [job("potion", 0)]);
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 2, { progressHours: 0 })]);
  assert.equal((await service.reconcileActor(actor)).hours, 2);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 2);
});

test("a recipe that finishes without a check charges its full duration once", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  const started = await startSession(sessions);
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 8)]);
  assert.equal((await service.reconcileActor(actor)).hours, 8);
  jobs.set(actor.uuid, [job("potion", 8)]);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
});

test("time spent outside an active Session is not applied when a Session later starts", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 4)]);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  const started = await startSession(sessions);
  jobs.set(actor.uuid, [job("potion", 6)]);
  assert.equal((await service.reconcileActor(actor)).hours, 2);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 2);
});

test("crafting time is not allocated when the Session does not allow Crafting", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  const started = await startSession(sessions, { activities: ["training"] });
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 2)]);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  const state = await repository.read();
  assert.equal(state.segments[started.segment.id].participants[0].allocatedHours, 0);
  assert.equal(state.craftTimeLedger[actor.uuid].potion, 2);
});

test("a character outside the Session does not consume another character's time", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  const started = await startSession(sessions, { actorUuid: "Actor.other", name: "Other" });
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 2)]);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  const state = await repository.read();
  assert.equal(state.segments[started.segment.id].participants[0].allocatedHours, 0);
  assert.equal(state.craftTimeLedger[actor.uuid].potion, 2);
});

test("a failed progress read keeps the last total and does not charge it again", async () => {
  const { repository, sessions, jobs, integration, actor, service } = world();
  const started = await startSession(sessions);
  jobs.set(actor.uuid, [job("potion", 2)]);
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 4)]);
  await service.reconcileActor(actor);
  const originalGet = integration.getProject;
  integration.getProject = async () => null;
  jobs.set(actor.uuid, [job("potion", 4)]);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  integration.getProject = originalGet;
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 4);
  assert.equal((await repository.read()).craftTimeLedger[actor.uuid].potion, 4);
});

test("cancelling a craft does not refund recorded Session time", async () => {
  const { sessions, jobs, actor, service, repository } = world();
  const started = await startSession(sessions);
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 2)]);
  await service.reconcileActor(actor);
  jobs.set(actor.uuid, []);
  assert.equal((await service.reconcileActor(actor)).hours, 0);
  const state = await repository.read();
  assert.equal(state.segments[started.segment.id].participants[0].allocatedHours, 2);
  assert.equal(state.craftTimeLedger[actor.uuid], undefined);
});

test("crafting past the planned hours is still recorded", async () => {
  const { sessions, jobs, notices, actor, service, repository } = world();
  const started = await startSession(sessions, { hours: 2 });
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 4)]);
  const recorded = await service.reconcileActor(actor);
  assert.equal(recorded.hours, 4);
  const participant = (await repository.read()).segments[started.segment.id].participants[0];
  assert.equal(participant.allocatedHours, 4);
  assert.equal(participant.availableHours, 2);
  assert.match(notices.at(-1), /more time than that character had remaining/);
});

test("only the primary GM records crafting time", async () => {
  const { repository, sessions, jobs, actor } = world();
  const started = await startSession(sessions);
  const service = new CraftTimeService({
    repository,
    getIntegration: () => ({
      listProjects: async () => jobs.get(actor.uuid) ?? [],
      getProject: async ({ recipeId }) => jobs.get(actor.uuid).find(entry => entry.recipeId === recipeId)
    }),
    getActors: () => [actor],
    isPrimaryGm: () => false
  });
  await service.baseline();
  jobs.set(actor.uuid, [job("potion", 2)]);
  assert.equal((await service.reconcileActor(actor)).reason, "not-primary-gm");
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 0);
  assert.equal((await repository.read()).craftTimeLedgerInitialized, false);
});

test("a missing Craftworks integration leaves downtime state untouched", async () => {
  let writes = 0;
  const repository = new ProjectRepository({
    getState: async () => null,
    setState: async () => { writes += 1; }
  });
  const service = new CraftTimeService({
    repository,
    getIntegration: () => null,
    getActors: () => [{ id: "aric", uuid: "Actor.aric", name: "Aric", type: "character" }]
  });
  assert.equal((await service.baseline()).reason, "craftworks-unavailable");
  assert.equal((await service.reconcileActor({ id: "aric", uuid: "Actor.aric", name: "Aric", type: "character" })).reason, "craftworks-unavailable");
  assert.equal(writes, 0);
});

test("session history describes crafting time without internal ids", async () => {
  const rows = await formatHistory([{
    at: 500,
    type: "craft-time",
    data: { actorUuid: "Actor.aric", actorName: "Aric", hours: 1, recipeId: "potion", recipeName: "Healing Potion" }
  }], {});
  assert.equal(rows[0].details, "Aric spent 1 hour crafting Healing Potion.");
  assert.equal(rows[0].details.includes("potion"), false);
  assert.equal(rows[0].details.includes("Actor.aric"), false);
});

test("reconcile waits for the ready baseline before charging", async () => {
  const { jobs, actor, service, sessions, repository } = world();
  jobs.set(actor.uuid, [job("potion", 4)]);
  const started = await startSession(sessions);
  service.holdForBaseline();
  let settled = false;
  const pending = service.reconcileActor(actor).then(result => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  await service.baselineWhenReady({ attemptsRemaining: 1, intervalMs: 0 });
  const result = await pending;
  assert.equal(result.hours, 0);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 4);
  jobs.set(actor.uuid, [job("potion", 6)]);
  assert.equal((await service.reconcileActor(actor)).hours, 2);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 6);
});

test("a failed check during baseline still allocates its two hours for an ignored GM", async () => {
  const chuck = { id: "chuck", active: true, isGM: true, name: "Chuck" };
  const users = [chuck, { id: "darro-player", active: true, isGM: false, name: "Darro" }];
  const coreList = users.filter(user => user.id !== "chuck");
  const ignoredPrimary = coreList.filter(user => user.active && user.isGM)[0]?.id === chuck.id;
  assert.equal(ignoredPrimary, false);
  assert.equal(isPrimaryActiveGm({ user: chuck, users }), true);

  let stored = null;
  let phase = "setup";
  const jobs = new Map([["Actor.darro", [{ recipeId: "antitoxin", timeSpentHours: 2, progressHours: 2 }]]]);
  const repository = new ProjectRepository({
    getState: async () => {
      if (phase === "baseline") {
        phase = "rolled";
        jobs.set("Actor.darro", [{ recipeId: "antitoxin", timeSpentHours: 4, progressHours: 0 }]);
      }
      return stored;
    },
    setState: async value => { stored = structuredClone(value); }
  });
  const sessions = new SessionService({
    repository,
    idFactory: () => "session-downtime",
    segmentIdFactory: () => "segment-neverwinter",
    now: () => 100
  });
  const session = await sessions.create({
    name: "Session Downtime",
    locationId: "neverwinter",
    plannedDurationHours: 40,
    participants: [{ actorUuid: "Actor.darro", name: "Darro" }],
    availableActivities: ["crafting"]
  });
  await sessions.publish(session.id);
  const started = await sessions.start(session.id);
  const actor = { id: "darro", uuid: "Actor.darro", name: "Darro", type: "character" };
  const service = new CraftTimeService({
    repository,
    getIntegration: () => ({
      listProjects: async () => jobs.get(actor.uuid) ?? [],
      getProject: async ({ recipeId }) => (jobs.get(actor.uuid) ?? []).find(entry => entry.recipeId === recipeId) ?? null,
      getRecipe: () => ({ name: "Antitoxin" })
    }),
    readProjects: () => (jobs.get(actor.uuid) ?? []).map(entry => ({
      recipeId: entry.recipeId,
      timeSpentHours: entry.timeSpentHours,
      recipeName: "Antitoxin"
    })),
    getActors: () => [actor],
    isPrimaryGm: () => isPrimaryActiveGm({ user: chuck, users }),
    now: () => 500
  });
  phase = "baseline";
  const baselined = await service.baseline();
  assert.equal(baselined.hours, 2);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 2);
  const recorded = await service.reconcileActor(actor);
  assert.equal(recorded.hours, 2);
  const participant = (await repository.read()).segments[started.segment.id].participants[0];
  assert.equal(participant.availableHours, 40);
  assert.equal(participant.allocatedHours, 4);
});

test("an actor update for Craftworks flags refreshes Downtime and reconciles that character", async () => {
  const calls = [];
  const refreshed = [];
  const previousHooks = globalThis.Hooks;
  globalThis.Hooks = { on(event, callback) { calls.push({ event, callback }); } };
  try {
    const craftTime = { reconcileActor: async actor => actor.uuid };
    registerCraftTimeTracking(craftTime, { refresh: () => refreshed.push("refresh") });
    assert.equal(calls.length, 1);
    await calls[0].callback({ uuid: "Actor.aric" }, { flags: { "morelord-craftworks": { craftingJobs: {} } } });
    assert.deepEqual(refreshed, ["refresh"]);
    calls[0].callback({ uuid: "Actor.aric" }, { name: "Aric" });
    calls[0].callback({ uuid: "Actor.aric" }, { flags: { other: true } });
    assert.deepEqual(refreshed, ["refresh"]);
  } finally {
    globalThis.Hooks = previousHooks;
  }
});
