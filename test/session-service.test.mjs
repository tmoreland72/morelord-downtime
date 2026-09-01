import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";

function harness() {
  let stored = null;
  let sessionId = 0;
  let segmentId = 0;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  return { repository, sessions: new SessionService({ repository, idFactory: () => `session-${++sessionId}`, segmentIdFactory: () => `segment-${++segmentId}`, now: () => 100 }) };
}

test("a Session persists through draft, upcoming, active, and finalized lifecycle", async () => {
  const { repository, sessions } = harness();
  const draft = await sessions.create({ name: "A Week in Neverwinter", description: "Pursue personal goals.", locationId: "neverwinter", plannedDurationHours: 40, participants: [{ actorUuid: "Actor.aric", name: "Aric" }], availableActivities: ["training"] });
  assert.equal(draft.status, "draft");
  const edited = await sessions.update(draft.id, { plannedDurationHours: 32, description: "Four focused days." });
  assert.equal(edited.plannedDurationHours, 32);
  assert.equal(edited.history.at(-1).type, "updated");
  const planned = await sessions.addSegment(draft.id, { name: "Neverwinter Day", locationId: "neverwinter", participants: [{ actorUuid: "Actor.aric", availableHours: 8 }] });
  assert.equal(planned.segment.status, "draft");
  assert.equal((await sessions.publish(draft.id)).status, "upcoming");
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
  await sessions.publish(session.id);
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
  await sessions.publish(first.id);
  await sessions.start(first.id);
  await sessions.publish(second.id);
  await assert.rejects(() => sessions.start(second.id), /Finalize 'First'/);
});

test("an unused cancelled Session can be deleted", async () => {
  const { repository, sessions } = harness();
  const session = await sessions.create({ name: "Mistake", plannedDurationHours: 8, participants: [{ actorUuid: "Actor.aric" }], availableActivities: ["training"] });
  await sessions.cancel(session.id);
  assert.equal(await sessions.removeUnused(session.id), true);
  assert.equal((await repository.read()).sessions[session.id], undefined);
});
