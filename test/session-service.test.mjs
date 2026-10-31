import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";

function harness() {
  let stored = null;
  let sessionId = 0;
  let segmentId = 0;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  return { repository, sessions: new SessionService({ repository, idFactory: () => `session-${++sessionId}`, segmentIdFactory: () => `segment-${++segmentId}`, now: () => 100 }) };
}

test("players cannot create, edit, or delete Sessions", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const { sessions } = harness();
    const draft = await sessions.create({ name: "Week", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"] });
    game.user.isGM = false;
    await assert.rejects(() => sessions.create({ name: "Other", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric" }] }), /Only a GM may modify Downtime Sessions/);
    await assert.rejects(() => sessions.update(draft.id, { name: "Changed" }), /Only a GM may modify Downtime Sessions/);
    await assert.rejects(() => sessions.removeUnused(draft.id), /Only a GM may modify Downtime Sessions/);
    await assert.rejects(() => sessions.start(draft.id), /Only a GM may modify Downtime Sessions/);
    game.user.isGM = true;
    assert.equal((await sessions.get(draft.id)).name, "Week");
  } finally {
    globalThis.game = prior;
  }
});

test("a Session persists through pending, active, and finalized", async () => {
  const { repository, sessions } = harness();
  const draft = await sessions.create({ name: "A Week in Neverwinter", description: "Pursue personal goals.", locationId: "neverwinter", plannedDurationHours: 40, participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"] });
  assert.equal(draft.status, "pending");
  assert.equal(draft.days, null);
  assert.equal(draft.plannedDurationHours, 40);
  const edited = await sessions.update(draft.id, { days: 2, plannedDurationHours: 20, description: "Two days, with extra hours." });
  assert.equal(edited.days, 2);
  assert.equal(edited.plannedDurationHours, 20);
  assert.equal(edited.history.at(-1).type, "updated");
  const planned = await sessions.addSegment(draft.id, { name: "Neverwinter Day", locationId: "neverwinter", participants: [{ actorUuid: "Actor.aric", availableHours: 8 }] });
  assert.equal(planned.segment.status, "draft");
  const stateWithProject = await repository.read();
  stateWithProject.projects.training = { id: "training", name: "Learn Dwarvish", activityType: "training", status: "active", owner: { uuid: "Actor.aric" }, participants: [] };
  await repository.write(stateWithProject);
  const plannedProject = await sessions.planProject(draft.id, "training");
  assert.deepEqual(plannedProject.plannedProjectIds, ["training"]);
  const started = await sessions.start(draft.id);
  assert.equal(started.session.status, "active");
  assert.equal(started.segment.id, "segment-1");
  assert.equal(started.segment.status, "open");
  assert.equal(started.segment.participants[0].availableHours, 8);
  const added = await sessions.addSegment(draft.id, { name: "Rain Delay", locationId: "road", participants: [{ actorUuid: "Actor.aric", availableHours: 4 }] });
  assert.equal(added.segment.id, "segment-2");
  assert.equal(added.session.segmentIds.length, 2);
  const stateWithPendingWork = await repository.read();
  stateWithPendingWork.projects.training.status = "waiting";
  await repository.write(stateWithPendingWork);
  const warning = await sessions.finalize(draft.id);
  assert.equal(warning.finalized, false);
  assert.deepEqual(warning.warnings.map(entry => entry.type), ["unallocated-hours", "waiting-for-gm"]);
  const result = await sessions.finalize(draft.id, { force: true });
  assert.equal(result.session.status, "finalized");
  const state = await repository.read();
  assert.equal(state.segments["segment-1"].status, "finalized");
  assert.equal(state.segments["segment-2"].status, "finalized");
  assert.equal(state.projects.training.status, "waiting");
  assert.equal(state.projects.training.name, "Learn Dwarvish");
});

test("cancelling a Session preserves its history and closes its Segments", async () => {
  const { repository, sessions } = harness();
  const session = await sessions.create({ name: "Cancelled Week", locationId: "road", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"] });
  await sessions.addSegment(session.id, { name: "Cancelled Day", locationId: "road", participants: [{ actorUuid: "Actor.aric", availableHours: 8 }] });
  const cancelled = await sessions.cancel(session.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.history.at(-1).type, "cancelled");
  const state = await repository.read();
  assert.equal(state.sessions[session.id].status, "cancelled");
  assert.equal(state.segments["segment-1"].status, "cancelled");
});

test("only one Downtime Session can be active at a time", async () => {
  const { sessions } = harness();
  const first = await sessions.create({ name: "First", locationId: "road", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric" }], availableActivities: ["training"] });
  const second = await sessions.create({ name: "Second", locationId: "road", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric" }], availableActivities: ["training"] });
  await sessions.start(first.id);
  await assert.rejects(() => sessions.start(second.id), /Finalize 'First'/);
});

test("saved Draft and Upcoming sessions become Pending and keep their hours", async () => {
  const { repository, sessions } = harness();
  const state = await repository.read();
  state.sessions.legacy = {
    id: "legacy", name: "Old Draft", status: "draft", plannedDurationHours: 36,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"]
  };
  state.sessions.published = {
    id: "published", name: "Old Upcoming", status: "upcoming", plannedDurationHours: 16, days: 2,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"]
  };
  state.sessions.hoursOnly = {
    id: "hoursOnly", name: "Errand", status: "pending", plannedDurationHours: 2,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"]
  };
  await repository.write(state);
  const draft = await sessions.get("legacy");
  assert.equal(draft.status, "pending");
  assert.equal(draft.days, null);
  assert.equal(draft.plannedDurationHours, 36);
  const upcoming = await sessions.get("published");
  assert.equal(upcoming.status, "pending");
  assert.equal(upcoming.days, 2);
  assert.equal(upcoming.plannedDurationHours, 16);
  const kept = await sessions.get("hoursOnly");
  assert.equal(kept.status, "pending");
  assert.equal(kept.days ?? null, null);
  assert.equal(kept.plannedDurationHours, 2);
});

test("Days is optional and Hours stays independently editable", async () => {
  const { sessions } = harness();
  const hoursOnly = await sessions.create({
    name: "Errand", plannedDurationHours: 2,
    participants: [{ actorUuid: "Actor.aric" }]
  });
  assert.equal(hoursOnly.days, null);
  assert.equal(hoursOnly.plannedDurationHours, 2);
  const mixed = await sessions.create({
    name: "Long Days", days: 2, plannedDurationHours: 20,
    participants: [{ actorUuid: "Actor.aric" }]
  });
  assert.equal(mixed.days, 2);
  assert.equal(mixed.plannedDurationHours, 20);
  const filled = await sessions.update(mixed.id, { days: 3 });
  assert.equal(filled.days, 3);
  assert.equal(filled.plannedDurationHours, 24);
  const overridden = await sessions.update(filled.id, { days: 2, plannedDurationHours: 20 });
  assert.equal(overridden.days, 2);
  assert.equal(overridden.plannedDurationHours, 20);
  const cleared = await sessions.update(overridden.id, { days: null, plannedDurationHours: 20 });
  assert.equal(cleared.days, null);
  assert.equal(cleared.plannedDurationHours, 20);
});

test("day-based projects stop after the Session days are used", async () => {
  const { repository, sessions } = harness();
  const projects = new ProjectService({ repository, idFactory: () => "commission-1", now: () => 100 });
  const project = await projects.create({
    name: "Commission", activityType: "commission", owner: { uuid: "Actor.aric" }, status: "active",
    progress: { mode: "elapsed", elapsed: { requiredDays: 5, completedDays: 0 } }
  });
  const session = await sessions.create({
    name: "One Day", days: 1,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: ["training"]
  });
  assert.equal(session.plannedDurationHours, 8);
  await sessions.start(session.id);
  const advanced = await projects.advanceDay({ idempotencyKey: "day-1" });
  assert.equal(advanced.projects[0].progress.elapsed.completedDays, 1);
  assert.equal((await sessions.get(session.id)).daysUsed, 1);
  await assert.rejects(() => projects.advanceDay({ idempotencyKey: "day-2" }), /used all of its days/);
  assert.equal((await projects.get(project.id)).progress.elapsed.completedDays, 1);
  assert.equal(project.id, project.id);
});

test("day-based projects are not limited when Days is blank", async () => {
  const { repository, sessions } = harness();
  const projects = new ProjectService({ repository, idFactory: () => "commission-2", now: () => 100 });
  const project = await projects.create({
    name: "Commission", activityType: "commission", owner: { uuid: "Actor.aric" }, status: "active",
    progress: { mode: "elapsed", elapsed: { requiredDays: 3, completedDays: 0 } }
  });
  const session = await sessions.create({
    name: "Short", plannedDurationHours: 2,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: ["training"]
  });
  assert.equal(session.days, null);
  assert.equal(session.plannedDurationHours, 2);
  const started = await sessions.start(session.id);
  assert.equal(started.segment.participants[0].availableHours, 2);
  await projects.advanceDay({ idempotencyKey: "open-1" });
  await projects.advanceDay({ idempotencyKey: "open-2" });
  const stored = await sessions.get(session.id);
  assert.equal(stored.days, null);
  assert.equal(stored.daysUsed, 0);
  assert.equal((await projects.get(project.id)).progress.elapsed.completedDays, 2);
});

test("an unused cancelled Session can be deleted", async () => {
  const { repository, sessions } = harness();
  const session = await sessions.create({ name: "Mistake", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric" }], availableActivities: ["training"] });
  await sessions.cancel(session.id);
  assert.equal(await sessions.removeUnused(session.id), true);
  assert.equal((await repository.read()).sessions[session.id], undefined);
});
