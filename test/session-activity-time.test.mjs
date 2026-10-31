import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { CraftTimeService } from "../scripts/services/craft-time-service.mjs";
import { sourcingTimeEntry } from "../scripts/activities/source-item/source-item-time.mjs";
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

test("logged sourcing hours count toward the Session only when Source Item is enabled", async () => {
  const { repository, sessions, sessionTime, notices } = world();
  const hidden = await activeSession(sessions, ["training"]);
  const entry = sourcingTimeEntry({ actorUuid: "Actor.aric", hours: 3, itemName: "Cloak of Protection", projectId: "project-cloak" });
  const skipped = await sessionTime.recordHours({
    actor: { id: "aric", uuid: entry.actorUuid, type: "character", name: "Aric" },
    activityId: "source-item",
    hours: entry.hours,
    label: entry.label,
    projectId: entry.projectId
  });
  assert.equal(skipped.recorded, false);
  assert.equal((await repository.read()).segments[hidden.segment.id].participants[0].allocatedHours, 0);

  const allowed = world();
  const started = await activeSession(allowed.sessions, ["source-item", "crafting"]);
  const logged = await allowed.sessionTime.recordHours({
    actor: { id: "aric", uuid: "Actor.aric", type: "character", name: "Aric" },
    activityId: "source-item",
    hours: 3,
    label: "Cloak of Protection",
    projectId: "project-cloak"
  });
  assert.equal(logged.hours, 3);
  assert.equal((await allowed.repository.read()).segments[started.segment.id].participants[0].allocatedHours, 3);
  assert.match(allowed.notices[0], /Aric spent 3 hours sourcing Cloak of Protection/);
  const more = await allowed.sessionTime.recordHours({
    actor: { id: "aric", uuid: "Actor.aric", type: "character", name: "Aric" },
    activityId: "source-item",
    hours: 1.5,
    label: "Cloak of Protection",
    projectId: "project-cloak"
  });
  assert.equal(more.hours, 1.5);
  assert.equal((await allowed.repository.read()).segments[started.segment.id].participants[0].allocatedHours, 4.5);
  assert.equal(notices.length, 0);
});

test("a player cannot record sourcing time", async () => {
  const prior = globalThis.game;
  const { sessions, sessionTime, repository } = world();
  const started = await activeSession(sessions, ["source-item"]);
  globalThis.game = { user: { isGM: false } };
  try {
    const result = await sessionTime.recordHours({
      actor: { id: "aric", uuid: "Actor.aric", type: "character", name: "Aric" },
      activityId: "source-item",
      hours: 2,
      label: "Cloak of Protection"
    });
    assert.deepEqual(result, { recorded: false, hours: 0, reason: "not-gm" });
    assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 0);
  } finally {
    globalThis.game = prior;
  }
});

test("sourcing time requires a character, an item, and a positive duration", () => {
  assert.throws(() => sourcingTimeEntry({ actorUuid: "", hours: 1, itemName: "Cloak" }), /Choose a character/);
  assert.throws(() => sourcingTimeEntry({ actorUuid: "Actor.aric", hours: 1, itemName: "  " }), /Name the item/);
  assert.throws(() => sourcingTimeEntry({ actorUuid: "Actor.aric", hours: 0, itemName: "Cloak" }), /greater than zero/);
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
