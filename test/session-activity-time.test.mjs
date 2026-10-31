import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { CraftTimeService } from "../scripts/services/craft-time-service.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { createSourceItemProject } from "../scripts/activities/source-item/source-item-activity.mjs";
import { createCommissionProject } from "../scripts/activities/commission/commission-activity.mjs";
import { formatHistory } from "../scripts/ui/history.mjs";
import { sessionSpends } from "../scripts/ui/session-spends.mjs";

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
  const notices = [];
  const sessionTime = new CraftTimeService({ repository, now: () => 500, notify: message => notices.push(message) });
  return { repository, sessions, sessionTime, notices };
}

async function activeSession(sessions, activities) {
  const session = await sessions.create({
    name: "Market Week",
    plannedDurationHours: 40,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: activities
  });
  return sessions.start(session.id);
}

test("Available Activities includes Source Item and Crafting, and omits Commission", () => {
  const source = readFileSync(new URL("../scripts/main.mjs", import.meta.url), "utf8");
  const block = id => {
    const start = source.indexOf(`id: ${id}`);
    return source.slice(start, source.indexOf("activities.register", start + 10));
  };
  assert.match(block("SOURCE_ITEM_ACTIVITY_ID"), /availableInSessions: true/);
  assert.match(block("COMMISSION_ACTIVITY_ID"), /availableInSessions: false/);
  assert.match(source, /name: "Crafting"/);
  assert.match(source, /name: "Training"/);
});

test("Advance Day spends eight Session hours for a Source Item day only when that activity is enabled", async () => {
  const hidden = world();
  const hiddenStart = await activeSession(hidden.sessions, ["training"]);
  const hiddenProjects = new ProjectService({ repository: hidden.repository, now: () => 500 });
  await hiddenProjects.create(createSourceItemProject({
    owner: { uuid: "Actor.aric", name: "Aric" },
    target: { uuid: "Item.cloak", name: "Cloak of Protection", rarity: "uncommon" },
    locationId: "market",
    checkSkill: "arc",
    investmentGp: 100,
    weeks: 1
  }, { idFactory: () => "cloak", now: () => 1 }));
  await hiddenProjects.advanceDay({ idempotencyKey: "hidden-day" });
  assert.equal((await hidden.repository.read()).segments[hiddenStart.segment.id].participants[0].allocatedHours, 0);
  assert.equal((await hiddenProjects.get("cloak")).progress.elapsed.completedDays, 1);

  const allowed = world();
  const started = await activeSession(allowed.sessions, ["source-item"]);
  const projects = new ProjectService({ repository: allowed.repository, now: () => 500 });
  await projects.create(createSourceItemProject({
    owner: { uuid: "Actor.aric", name: "Aric" },
    target: { uuid: "Item.cloak", name: "Cloak of Protection", rarity: "uncommon" },
    locationId: "market",
    checkSkill: "arc",
    investmentGp: 100,
    weeks: 1
  }, { idFactory: () => "cloak", now: () => 1 }));
  await projects.create(createCommissionProject({
    owner: { uuid: "Actor.aric", name: "Aric" },
    contractorName: "Smith",
    itemDescription: "Plate",
    locationId: "market",
    requiredDays: 5
  }, { idFactory: () => "plate", now: () => 1 }));
  await projects.advanceDay({ idempotencyKey: "day-1" });
  assert.equal((await allowed.repository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
  await projects.advanceDay({ idempotencyKey: "day-2" });
  const state = await allowed.repository.read();
  assert.equal(state.segments[started.segment.id].participants[0].allocatedHours, 16);
  assert.equal(state.projects.cloak.progress.elapsed.completedDays, 2);
  assert.equal(state.projects.plate.progress.elapsed.completedDays, 2);
});

test("Session History names each person's hours or days without internal ids", () => {
  const rows = sessionSpends({
    session: { segmentIds: ["seg"] },
    segments: [{
      id: "seg",
      participants: [
        { actorUuid: "Actor.aric", name: "Aric" },
        { actorUuid: "Actor.brom", name: "Brom" }
      ],
      allocations: [
        { projectId: "train", participantActorUuids: ["Actor.aric", "Actor.brom"], hours: 4, createdAt: 2_000 },
        { projectId: "craft", participantActorUuids: ["Actor.aric"], hours: 2, createdAt: 3_000, recipeName: "Longsword", activityId: "crafting" },
        { projectId: "source", participantActorUuids: ["Actor.aric"], hours: 8, createdAt: 4_000, activityId: "source-item" },
        { projectId: "carouse", participantActorUuids: ["Actor.brom"], days: 1, hours: 0, createdAt: 5_000, activityId: "carousing" }
      ]
    }],
    projects: {
      train: { id: "train", name: "Learn Dwarvish", activityType: "training", owner: { uuid: "Actor.aric", name: "Aric" } },
      source: { id: "source", name: "Source Cloak of Protection", activityType: "source-item", owner: { uuid: "Actor.aric", name: "Aric" } },
      carouse: { id: "carouse", name: "Carousing", activityType: "carousing", owner: { uuid: "Actor.brom", name: "Brom" } }
    },
    activityName: id => ({ training: "Training", crafting: "Crafting", "source-item": "Source Item", carousing: "Carousing" })[id]
  });
  assert.deepEqual(rows.map(row => `${row.who} ${row.amount} on ${row.what}`), [
    "Brom 1 day on Carousing",
    "Aric 8 hours on Source Cloak of Protection",
    "Aric 2 hours on Longsword",
    "Aric 4 hours on Learn Dwarvish",
    "Brom 4 hours on Learn Dwarvish"
  ]);
  assert.equal(rows.some(row => `${row.who} ${row.amount} ${row.what} ${row.when}`.includes("Actor.")), false);
});

test("session history names commissioning and sourcing without internal ids", async () => {
  const rows = await formatHistory([
    { at: 1, type: "session-time", data: { actorName: "Aric", actorUuid: "Actor.aric", hours: 8, activityId: "commission", label: "Plate Armor", projectId: "project-1" } },
    { at: 2, type: "session-time", data: { actorName: "Aric", actorUuid: "Actor.aric", hours: 8, activityId: "source-item", label: "Cloak of Protection" } }
  ], {});
  assert.equal(rows[1].details, "Aric spent 8 hours commissioning Plate Armor.");
  assert.equal(rows[0].details, "Aric spent 8 hours sourcing Cloak of Protection.");
  assert.equal(rows.some(row => row.details.includes("project-1") || row.details.includes("Actor.aric")), false);
});
