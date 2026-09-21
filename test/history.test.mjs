import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHistory } from "../scripts/ui/history.mjs";

test("history uses names, sentences and readable fallback without changing saved data", async () => {
  const services = { projects: { get: async () => ({ name: "Learn Elvish" }) }, segments: { get: async () => null } };
  const record = { owner: { uuid: "Actor.abc", name: "Thalin" } };
  const history = [
    { type: "effort-applied", data: { hours: 1, participantActorUuid: "Actor.abc" } },
    { type: "project-planned", data: { projectId: "internal" } },
    { type: "segment-added", data: { segmentId: "deleted" } },
    { type: "updated", data: { fields: ["collectionLocationId", "availableActivities"] } },
    { type: "source-item-persuasion", data: { total: 0, adjustment: -0.1 } },
    { type: "future-event", data: { outcome: { success: false, total: 0 } } }
  ].map(entry => ({ at: 1, ...entry }));
  const before = structuredClone(history);
  const rows = (await formatHistory(history, services, record)).reverse();
  assert.equal(rows[0].details, "Thalin contributed 1 hour.");
  assert.equal(rows[1].details, "Planned project: Learn Elvish.");
  assert.equal(rows[2].details, "Time pool added: Unavailable time pool.");
  assert.equal(rows[3].details, "Changed: Collection location, Available project types.");
  assert.equal(rows[4].details, "Persuasion total: 0. Price adjustment: -10%.");
  assert.equal(rows[5].details, "Outcome: Success: No; Total: 0");
  assert.deepEqual(history, before);
});

test("activity outcomes and missing characters remain understandable", async () => {
  const services = { locations: () => ({ list: () => [{ id: "town", name: "Neverwinter" }] }) };
  const entries = [
    ["elapsed-day", { days: 1 }, "1 day of progress recorded."],
    ["completed", { status: "awaiting-collection" }, "Work finished; ready for collection."],
    ["collected", { locationId: "town" }, "Collected at Neverwinter."],
    ["source-item-resolved", { success: false, total: 0, dc: 15, alternativeCount: 0 }, "Item not found. Check total: 0; difficulty: 15. Alternative offers: 0."],
    ["proficiency-awarded", { actorUuid: "Actor.deleted", kind: "language", proficiencyId: "elvish" }, "Unavailable character learned Elvish (Language)."],
    ["proficiency-award-skipped", { reason: "owner-actor-unavailable" }, "Proficiency was not awarded: Owner actor unavailable."]
  ];
  const rows = await formatHistory(entries.map(([type, data]) => ({ at: 1, type, data })), services);
  assert.deepEqual(rows.reverse().map(row => row.details), entries.map(entry => entry[2]));
});
