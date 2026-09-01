import test from "node:test";
import assert from "node:assert/strict";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SegmentService } from "../scripts/services/segment-service.mjs";

function harness({ requirementEvaluator = null } = {}) {
  let stored = null;
  let id = 0;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const activities = new ActivityRegistry();
  activities.register({ id: "training", name: "Training", createProject: value => value });
  return {
    projects: new ProjectService({ repository, idFactory: () => `project-${++id}`, now: () => 1000 + id }),
    segments: new SegmentService({ repository, activityRegistry: activities, requirementEvaluator, idFactory: () => `segment-${++id}`, now: () => 2000 + id })
  };
}

test("two participants spend two hours while their shared Project gains two hours once", async () => {
  const { projects, segments } = harness();
  const project = await projects.create({
    name: "Learn Brewer's Supplies",
    activityType: "training",
    owner: { type: "actor", uuid: "Actor.aric" },
    participants: [
      { actorUuid: "Actor.aric", role: "student", approved: true },
      { actorUuid: "Actor.brom", role: "instructor", approved: true }
    ],
    status: "active",
    progress: { mode: "effort", effort: { requiredHours: 120 } }
  });
  const segment = await segments.create({
    name: "Evening in Emberwood",
    locationId: "emberwood",
    status: "open",
    participants: [
      { actorUuid: "Actor.aric", name: "Aric", availableHours: 4 },
      { actorUuid: "Actor.brom", name: "Brom", availableHours: 4 }
    ]
  });
  const result = await segments.allocate({
    segmentId: segment.id,
    projectId: project.id,
    participantActorUuids: ["Actor.aric", "Actor.brom"],
    hours: 2
  });
  assert.equal(result.project.progress.effort.completedHours, 2);
  assert.equal(result.segment.participants[0].allocatedHours, 2);
  assert.equal(result.segment.participants[1].allocatedHours, 2);
  assert.equal(result.segment.participants[0].availableHours - result.segment.participants[0].allocatedHours, 2);
  assert.equal(result.segment.participants[1].availableHours - result.segment.participants[1].allocatedHours, 2);
  assert.equal(result.project.participants[0].hoursContributed, 2);
  assert.equal(result.project.participants[1].hoursContributed, 2);
});

test("an allocation is rejected atomically when one participant lacks hours", async () => {
  const { projects, segments } = harness();
  const project = await projects.create({ name: "Joint Research", activityType: "training", owner: { uuid: "Actor.aric" }, status: "active", progress: { mode: "effort", effort: { requiredHours: 10 } } });
  const segment = await segments.create({ name: "Rain Delay", status: "open", participants: [{ actorUuid: "Actor.aric", availableHours: 4 }, { actorUuid: "Actor.brom", availableHours: 1 }] });
  await assert.rejects(() => segments.allocate({ segmentId: segment.id, projectId: project.id, participantActorUuids: ["Actor.aric", "Actor.brom"], hours: 2 }), /enough remaining/);
  assert.equal((await projects.get(project.id)).progress.effort.completedHours, 0);
  assert.equal((await segments.get(segment.id)).participants[0].allocatedHours, 0);
});

test("shared Location requirements can pause allocation without discarding the Project", async () => {
  const { projects, segments } = harness({ requirementEvaluator: async () => ({ passed: false, reasons: ["Requires rare forge."] }) });
  const project = await projects.create({ name: "+1 Sword", activityType: "training", owner: { uuid: "Actor.aric" }, status: "active", requirements: [{ kind: "capability", type: "forge", tier: "rare" }], progress: { mode: "effort", effort: { requiredHours: 80 } } });
  const segment = await segments.create({ name: "Emberwood Evening", locationId: "emberwood", status: "open", participants: [{ actorUuid: "Actor.aric", availableHours: 4 }] });
  await assert.rejects(() => segments.allocate({ segmentId: segment.id, projectId: project.id, participantActorUuids: ["Actor.aric"], hours: 2 }), /Requires rare forge/);
  assert.equal((await projects.get(project.id)).status, "active");
  assert.equal((await projects.get(project.id)).progress.effort.completedHours, 0);
});

test("a finalized Segment rejects further allocations", async () => {
  const { projects, segments } = harness();
  const project = await projects.create({ name: "Practice", activityType: "training", owner: { uuid: "Actor.aric" }, status: "active", progress: { mode: "effort", effort: { requiredHours: 10 } } });
  const segment = await segments.create({ name: "Evening", status: "open", participants: [{ actorUuid: "Actor.aric", availableHours: 2 }] });
  const finalized = await segments.finalize(segment.id);
  assert.equal(finalized.status, "finalized");
  await assert.rejects(() => segments.allocate({ segmentId: segment.id, projectId: project.id, participantActorUuids: ["Actor.aric"], hours: 1 }), /not active/);
});

test("an active Session must permit the Project activity before time can be spent", async () => {
  const { segments } = harness();
  const project = { activityType: "training", status: "active", progress: { mode: "effort" }, requirements: [] };
  const segment = { status: "open", metadata: { sessionId: "session-1" }, participants: [] };
  const session = { id: "session-1", status: "active", availableActivities: ["crafting"] };
  const result = await segments.evaluateAllocation({ segment, project, session, participantActorUuids: [], hours: 1 });
  assert.equal(result.passed, false);
  assert.match(result.reasons.join(" "), /not available in the active Downtime Session/);
});
