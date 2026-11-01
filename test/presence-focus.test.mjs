import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { buildXgeProject } from "../scripts/activities/xge/xge-project.mjs";
import { ACTIVE_PRESENCE_TOOLTIP, INACTIVE_PRESENCE_TOOLTIP, presenceMarker } from "../scripts/domain/presence-focus.mjs";

const owner = { uuid: "Actor.aric", name: "Aric" };
const other = { uuid: "Actor.brom", name: "Brom" };
const town = { id: "town", capabilities: [] };
const library = { id: "stacks", capabilities: [{ type: "library", tier: "common" }] };

function harness() {
  let stored = null;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  const projects = new ProjectService({ repository, idFactory: () => "p", now: () => 10 });
  const sessions = new SessionService({ repository, idFactory: () => "session-1", segmentIdFactory: () => "segment-1", now: () => 10 });
  return { repository, projects, sessions };
}

function project(activityType, id, extra = {}, at = 1) {
  const built = buildXgeProject({
    activityType,
    owner,
    locationId: activityType === "lore-research" ? "stacks" : "town",
    ...(activityType === "carousing" ? { socialClass: "lower", npcNames: "Mira" } : {}),
    ...(activityType === "crime" ? { crimeDc: 10, crimeNotes: "A job", thirdSkill: "inv" } : {}),
    ...(activityType === "lore-research" ? { skill: "his", question: "The gate" } : {}),
    ...extra
  }, {
    location: activityType === "lore-research" ? library : town,
    idFactory: () => id,
    now: () => at
  }).project;
  return built;
}

test("one presence project is Active, and a second stays Inactive until chosen", async () => {
  const { projects, sessions } = harness();
  const carouse = await projects.create(project("carousing", "carouse", {}, 1));
  assert.equal(carouse.presenceFocus, true);
  const crime = await projects.create(project("crime", "crime", {}, 2));
  assert.equal(crime.presenceFocus, false);
  assert.equal((await projects.get("carouse")).presenceFocus, true);

  const rest = await projects.create(project("relaxation", "rest", {}, 3));
  const research = await projects.create(project("lore-research", "research", {}, 4));
  assert.notEqual(rest.presenceFocus, true);
  assert.notEqual(research.presenceFocus, true);

  await sessions.start((await sessions.create({
    name: "Town Week",
    locationId: "town",
    days: 4,
    plannedDurationHours: 32,
    participants: [{ actorUuid: owner.uuid, name: owner.name }],
    availableActivities: ["carousing", "crime", "relaxation", "lore-research"]
  })).id);

  await projects.advanceDay({ idempotencyKey: "day-1" });
  assert.equal((await projects.get("carouse")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("crime")).progress.elapsed.completedDays, 0);
  assert.equal((await projects.get("rest")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("research")).progress.elapsed.completedDays, 1);

  await projects.setPresenceFocus("crime");
  assert.equal((await projects.get("crime")).presenceFocus, true);
  assert.equal((await projects.get("carouse")).presenceFocus, false);
  await projects.advanceDay({ idempotencyKey: "day-2" });
  assert.equal((await projects.get("crime")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("carouse")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("rest")).progress.elapsed.completedDays, 2);
});

test("saved presence projects keep the most recently advanced one Active", async () => {
  const older = project("carousing", "older", {}, 1);
  const newer = project("crime", "newer", {}, 5);
  older.history.push({ at: 10, type: "elapsed-day", data: { days: 1 } });
  newer.history.push({ at: 40, type: "elapsed-day", data: { days: 1 } });
  let stored = { schemaVersion: 1, projects: { older, newer }, segments: {}, sessions: {}, consumedDayKeys: [] };
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = value; } });
  const state = await repository.read();
  assert.equal(state.projects.newer.presenceFocus, true);
  assert.equal(state.projects.older.presenceFocus, false);
  assert.match(state.projects.newer.history.at(-1).data.summary, /advanced most recently/);

  const quietOld = project("carousing", "quiet-old", {}, 1);
  const quietNew = project("crime", "quiet-new", {}, 9);
  stored = { schemaVersion: 1, projects: { "quiet-old": quietOld, "quiet-new": quietNew }, segments: {}, sessions: {}, consumedDayKeys: [] };
  const oldest = await repository.read();
  assert.equal(oldest.projects["quiet-old"].presenceFocus, true);
  assert.equal(oldest.projects["quiet-new"].presenceFocus, false);
});

test("another character's presence project stays Active on its own", async () => {
  const { projects, sessions } = harness();
  await projects.create(project("carousing", "aric", {}, 1));
  const brom = project("carousing", "brom", { owner: other, npcNames: "Lira" }, 2);
  await projects.create(brom);
  assert.equal((await projects.get("aric")).presenceFocus, true);
  assert.equal((await projects.get("brom")).presenceFocus, true);
  await sessions.start((await sessions.create({
    name: "Town Week",
    locationId: "town",
    plannedDurationHours: 8,
    participants: [
      { actorUuid: owner.uuid, name: owner.name },
      { actorUuid: other.uuid, name: other.name }
    ],
    availableActivities: ["carousing"]
  })).id);
  await projects.advanceDay({ idempotencyKey: "both" });
  assert.equal((await projects.get("aric")).progress.elapsed.completedDays, 1);
  assert.equal((await projects.get("brom")).progress.elapsed.completedDays, 1);
});

test("the presence marker is a dot the owner or GM can click, and other projects have none", () => {
  const active = project("carousing", "active");
  active.presenceFocus = true;
  const inactive = project("crime", "idle");
  inactive.presenceFocus = false;
  const away = project("relaxation", "rest");
  assert.deepEqual(presenceMarker(active, { canToggle: true }), {
    presenceTracked: true,
    presenceFocus: true,
    presenceState: "active",
    canTogglePresence: false,
    presenceTooltip: ACTIVE_PRESENCE_TOOLTIP
  });
  assert.equal(ACTIVE_PRESENCE_TOOLTIP, "Active: gets credit on Advance Day");
  assert.deepEqual(presenceMarker(inactive, { canToggle: true }), {
    presenceTracked: true,
    presenceFocus: false,
    presenceState: "inactive",
    canTogglePresence: true,
    presenceTooltip: INACTIVE_PRESENCE_TOOLTIP
  });
  assert.equal(INACTIVE_PRESENCE_TOOLTIP, "Click to make Active");
  assert.equal(presenceMarker(inactive, { canToggle: false }).presenceTooltip, "Inactive");
  assert.equal(presenceMarker(inactive, { canToggle: false }).canTogglePresence, false);
  assert.equal(presenceMarker(away, { canToggle: true }).presenceTracked, false);
});
