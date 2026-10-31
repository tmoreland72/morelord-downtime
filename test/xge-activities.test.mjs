import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { applyGpDelta, gpAmount } from "../scripts/activities/xge/xge-currency.mjs";
import { spendGp, clearExhaustion } from "../scripts/activities/xge/xge-actor.mjs";
import { applyXgeCheck, buildXgeProject } from "../scripts/activities/xge/xge-project.mjs";
import { XgeResolutionService } from "../scripts/activities/xge/xge-resolution-service.mjs";
import {
  complicationOccurs,
  contactResult,
  crimeResult,
  favorResult,
  gamblingResult,
  loreResult,
  pitFightingResult,
  xgeCost
} from "../scripts/activities/xge/xge-rules.mjs";

const owner = { uuid: "Actor.aric", name: "Aric" };
const temple = { id: "chapel", capabilities: [{ type: "temple", tier: "common" }] };
const library = { id: "stacks", capabilities: [{ type: "library", tier: "common" }] };
const town = { id: "town", capabilities: [] };

function base(activityType, extra = {}) {
  return { activityType, owner, locationId: "town", ...extra };
}

test("gates, costs, and social class follow the book", () => {
  assert.equal(xgeCost("carousing", { socialClass: "lower" }), 10);
  assert.equal(xgeCost("carousing", { socialClass: "middle" }), 50);
  assert.equal(xgeCost("carousing", { socialClass: "upper" }), 250);
  assert.equal(xgeCost("crime", {}), 25);
  assert.equal(xgeCost("gambling", { stakeGp: 10 }), 10);
  assert.equal(xgeCost("lore-research", { extraGp: 200 }), 250);
  assert.equal(xgeCost("relaxation", {}), 7);
  assert.equal(xgeCost("religious-service", {}), 0);
  assert.throws(() => xgeCost("gambling", { stakeGp: 1001 }), /1,000 gp/);
  assert.equal(xgeCost("gambling", { stakeGp: 2000, allowHighStake: true }, { isGm: true }), 2000);
  assert.throws(() => buildXgeProject(base("religious-service", { skill: "rel" }), { location: town }), /Temple/);
  assert.throws(() => buildXgeProject(base("religious-service", { skill: "rel", waiveLocation: true, metadata: { xge: { waiveLocation: true } } }), { isGm: true, location: town }), /Temple/);
  assert.equal(buildXgeProject(base("religious-service", { skill: "per", locationId: "chapel" }), { location: temple }).project.progress.elapsed.requiredDays, 7);
  assert.throws(() => buildXgeProject(base("lore-research", { skill: "his", question: "Who built the gate?" }), { location: town }), /Library/);
  assert.equal(buildXgeProject(base("lore-research", { skill: "his", question: "Who built the gate?", locationId: "stacks" }), { location: library }).costGp, 50);
  for (const activityType of ["carousing", "gambling", "pit-fighting"]) {
    const extra = activityType === "carousing" ? { socialClass: "lower", npcNames: "Mira" } : activityType === "gambling" ? { stakeGp: 10 } : {};
    assert.equal(buildXgeProject(base(activityType, extra), { location: town }).project.locationId, "town");
  }
  assert.throws(() => buildXgeProject(base("carousing", { socialClass: "upper", npcNames: "Lord" }), { location: town }), /nobility/);
  const upper = buildXgeProject(base("carousing", { socialClass: "upper", npcNames: "Lord", nobilityAccess: true }), { isGm: true, location: town });
  assert.equal(upper.costGp, 250);
});

test("a saved location waiver is dropped for every project type", async () => {
  let stored = {
    schemaVersion: 1,
    projects: {
      religious: { id: "religious", waiveLocation: true, metadata: { xge: { waiveLocation: true, costGp: 0 } } },
      training: { id: "training", metadata: { training: { waiveLocation: true, proficiencyId: "dwarvish" } } },
      source: { id: "source", metadata: { sourceItem: { waiveLocation: true } } },
      craft: { id: "craft", metadata: { crafting: { waiveLocation: true } } },
      commission: { id: "commission", metadata: { commission: { waiveLocation: true, itemName: "Rope" } } }
    },
    segments: {},
    sessions: {},
    consumedDayKeys: []
  };
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = value; } });
  const state = await repository.read();
  assert.equal(state.projects.religious.waiveLocation, undefined);
  assert.equal(state.projects.religious.metadata.xge.waiveLocation, undefined);
  assert.equal(state.projects.religious.metadata.xge.costGp, 0);
  assert.equal(state.projects.training.metadata.training.waiveLocation, undefined);
  assert.equal(state.projects.training.metadata.training.proficiencyId, "dwarvish");
  assert.equal(state.projects.source.metadata.sourceItem.waiveLocation, undefined);
  assert.equal(state.projects.craft.metadata.crafting.waiveLocation, undefined);
  assert.equal(state.projects.commission.metadata.commission.waiveLocation, undefined);
  assert.equal(state.projects.commission.metadata.commission.itemName, "Rope");
  await repository.write(structuredClone(stored));
  assert.equal(stored.projects.religious.metadata.xge.waiveLocation, undefined);
  assert.equal(stored.projects.training.metadata.training.waiveLocation, undefined);
  assert.equal(stored.projects.source.metadata.sourceItem.waiveLocation, undefined);
  assert.equal(stored.projects.craft.metadata.crafting.waiveLocation, undefined);
  assert.equal(stored.projects.commission.metadata.commission.waiveLocation, undefined);
  assert.equal(stored.projects.commission.metadata.commission.itemName, "Rope");
});

test("outcome bands and complication triggers use the book", () => {
  assert.equal(contactResult(5).hostile, 1);
  assert.equal(contactResult(10).allied, 0);
  assert.equal(contactResult(15).allied, 1);
  assert.equal(contactResult(20).allied, 2);
  assert.equal(contactResult(21).allied, 3);
  assert.equal(favorResult(10).favors, 0);
  assert.equal(favorResult(11).favors, 1);
  assert.equal(favorResult(21).favors, 2);
  assert.equal(crimeResult(10, [1, 1, 1]).fineGp, 50);
  assert.equal(crimeResult(10, [1, 1, 1]).jailWeeks, 2);
  assert.equal(crimeResult(25, [1, 1, 1]).jailWeeks, 40);
  assert.equal(crimeResult(15, [20, 1, 1]).payoutGp, 0);
  assert.equal(crimeResult(15, [20, 1, 1]).complication, true);
  assert.equal(crimeResult(15, [20, 16, 1]).payoutGp, 50);
  assert.equal(crimeResult(15, [20, 16, 16]).payoutGp, 100);
  assert.equal(gamblingResult(10, [1, 1, 1], [10, 10, 10]).debtGp, 10);
  assert.equal(gamblingResult(10, [12, 1, 1], [10, 10, 10]).payoutGp, 5);
  assert.equal(gamblingResult(10, [12, 12, 1], [10, 10, 10]).payoutGp, 15);
  assert.equal(gamblingResult(10, [12, 12, 12], [10, 10, 10]).payoutGp, 20);
  assert.equal(pitFightingResult([1, 1, 1], [10, 10, 10]).payoutGp, 0);
  assert.equal(pitFightingResult([12, 1, 1], [10, 10, 10]).payoutGp, 50);
  assert.equal(pitFightingResult([12, 12, 1], [10, 10, 10]).payoutGp, 100);
  assert.equal(pitFightingResult([12, 12, 12], [10, 10, 10]).payoutGp, 200);
  assert.equal(loreResult(4).lore, 0);
  assert.equal(loreResult(6).lore, 1);
  assert.equal(loreResult(11).lore, 2);
  assert.equal(loreResult(21).lore, 3);
  assert.equal(complicationOccurs("crime", { successes: 0 }), false);
  assert.equal(complicationOccurs("crime", { successes: 1 }), true);
  assert.equal(complicationOccurs("crime", { successes: 3 }), false);
  for (const activity of ["carousing", "gambling", "pit-fighting", "religious-service", "lore-research", "relaxation"]) {
    assert.equal(complicationOccurs(activity, { d100: 10 }), true);
    assert.equal(complicationOccurs(activity, { d100: 11 }), false);
  }
});

test("a resolved check pays the actor and a short stake is refused", async () => {
  const built = buildXgeProject(base("carousing", { socialClass: "lower", npcNames: "Mira" }), { location: town, idFactory: () => "carouse", now: () => 1 });
  built.project.metadata.xge.checks[0].total = null;
  const resolved = applyXgeCheck(built.project, 21, { d100: 5, d6: 1, at: 9 });
  assert.match(resolved.outcome.summary, /Three allied contacts/);
  assert.match(resolved.project.metadata.xge.complication.summary, /rumor/i);
  const quiet = applyXgeCheck(structuredClone(built.project), 12, { d100: 50, at: 9 });
  assert.equal(quiet.project.metadata.xge.complication, null);

  const updates = [];
  const actor = {
    name: "Aric",
    system: { currency: { pp: 0, gp: 20, ep: 0, sp: 0, cp: 0 }, attributes: { exhaustion: 4 } },
    update: async change => { updates.push(change); Object.assign(actor.system, change["system.currency"] ? { currency: change["system.currency"] } : {}); if (change["system.attributes.exhaustion"] != null) actor.system.attributes.exhaustion = change["system.attributes.exhaustion"]; }
  };
  await assert.rejects(() => spendGp(actor, 250, "Carousing"), /Not enough money\. Carousing costs 250 gp and Aric has 20 gp/);
  const paid = await spendGp(actor, 7, "Relaxation");
  assert.match(paid.note, /Aric pays 7 gp for Relaxation/);
  assert.equal(gpAmount(actor.system.currency), 13);
  await clearExhaustion(actor);
  assert.equal(actor.system.attributes.exhaustion, 0);
  assert.deepEqual(applyGpDelta({ gp: 1, sp: 5 }, 0.5).gp >= 1, true);
});

test("Research and Relaxation advance with no Session, and the others wait for the assigned place", async () => {
  let stored = null;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  const projects = new ProjectService({ repository, idFactory: () => "p", now: () => 10 });
  const sessions = new SessionService({ repository, idFactory: () => "session-1", segmentIdFactory: () => "segment-1", now: () => 10 });
  const research = buildXgeProject(base("lore-research", { skill: "his", question: "The gate", locationId: "stacks" }), { location: library, idFactory: () => "research", now: () => 1 }).project;
  const rest = buildXgeProject(base("relaxation"), { location: town, idFactory: () => "rest", now: () => 1 }).project;
  const party = buildXgeProject(base("carousing", { socialClass: "lower", npcNames: "Mira" }), { location: town, idFactory: () => "party", now: () => 1 }).project;
  await projects.create(research);
  await projects.create(rest);
  await projects.create(party);
  await projects.advanceDay({ idempotencyKey: "away-1" });
  assert.equal((await projects.get("research")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("rest")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("party")).progress.elapsed.completedDays, 0);

  const started = await sessions.start((await sessions.create({
    name: "Town Week",
    locationId: "town",
    days: 2,
    plannedDurationHours: 16,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: ["carousing"]
  })).id);
  await projects.advanceDay({ idempotencyKey: "present-1" });
  assert.equal((await projects.get("party")).progress.elapsed.completedDays, 1);
  const segment = (await repository.read()).segments[started.segment.id];
  assert.equal(segment.allocations.some(entry => entry.projectId === "party" && entry.days === 1), true);
  assert.equal(segment.participants[0].allocatedHours, 0);

  const moved = await repository.read();
  moved.sessions[started.session.id].locationId = "road";
  await repository.write(moved);
  await projects.advanceDay({ idempotencyKey: "wrong-place" });
  assert.equal((await projects.get("party")).progress.elapsed.completedDays, 1);
});

test("clearing Exhaustion does not toggle a status effect the update already removed", async () => {
  let toggled = false;
  const actor = {
    name: "Aric",
    system: { attributes: { exhaustion: 2 } },
    update: async change => {
      actor.system.attributes.exhaustion = change["system.attributes.exhaustion"];
    },
    toggleStatusEffect: async () => {
      toggled = true;
      throw new Error("undefined id [dnd5eexhaustion0] does not exist");
    }
  };
  assert.equal(await clearExhaustion(actor), 2);
  assert.equal(actor.system.attributes.exhaustion, 0);
  assert.equal(toggled, false);
});

test("Relaxation clears every Exhaustion level when the week ends", async () => {
  let stored = null;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  const actor = {
    name: "Aric",
    uuid: "Actor.aric",
    system: { currency: { gp: 20, sp: 0, cp: 0, pp: 0, ep: 0 }, attributes: { exhaustion: 3 } },
    update: async change => {
      if (change["system.attributes.exhaustion"] != null) actor.system.attributes.exhaustion = change["system.attributes.exhaustion"];
      if (change["system.currency"]) actor.system.currency = change["system.currency"];
    }
  };
  const registry = new ActivityRegistry();
  const service = new XgeResolutionService({
    projects: null,
    getActor: async () => actor,
    getLocation: async () => town,
    rollDie: async () => 50
  });
  registry.register({ id: "relaxation", name: "Relaxation", createProject: data => data, onComplete: project => service.onComplete(project) });
  const projects = new ProjectService({ repository, activityRegistry: registry, idFactory: () => "rest", now: () => 5 });
  service.projects = projects;
  const built = buildXgeProject(base("relaxation"), { location: town, idFactory: () => "rest", now: () => 1 });
  built.project.progress.elapsed.completedDays = 6;
  await projects.create(built.project);
  await projects.advanceDay({ idempotencyKey: "rest-done" });
  const finished = await projects.get("rest");
  assert.equal(finished.status, "completed");
  assert.equal(actor.system.attributes.exhaustion, 0);
  assert.match(finished.metadata.xge.outcome.summary, /All Exhaustion is removed/);
  assert.match(finished.metadata.xge.outcome.recovery, /hit points|ability score/);
  assert.equal(finished.metadata.xge.complication, null);
});
