import test from "node:test";
import assert from "node:assert/strict";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SegmentService } from "../scripts/services/segment-service.mjs";
import { canProgressTraining, createTrainingProject } from "../scripts/activities/training/training-activity.mjs";
import { assertNpcInstructorSpecialty, filterNpcTrainingChoices, locationAllowsSpecialty } from "../scripts/domain/instructor-specialty.mjs";
import { TrainingAwardService, applyTrainingAwardResult } from "../scripts/activities/training/training-award-service.mjs";

function trainingHarness({ actor = null } = {}) {
  let stored = null;
  let id = 0;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  const registry = new ActivityRegistry();
  const awards = new TrainingAwardService({ resolveUuid: async () => actor });
  registry.register({
    id: "training",
    name: "Training",
    createProject: data => createTrainingProject(data),
    canProgress: canProgressTraining,
    onComplete: async project => applyTrainingAwardResult(project, await awards.award(project))
  });
  const projects = new ProjectService({ repository, activityRegistry: registry, idFactory: () => `project-${++id}`, now: () => 1000 + id });
  const segments = new SegmentService({ repository, activityRegistry: registry, idFactory: () => `segment-${++id}`, now: () => 2000 + id });
  return { projects, segments };
}

test("participant instructor requires no approval but must allocate matching travel hours", () => {
  const project = createTrainingProject({
    kind: "language", proficiencyId: "dwarvish", owner: { uuid: "Actor.aric" },
    instructor: { mode: "participant", actorUuid: "Actor.brom" },
    participants: [{ actorUuid: "Actor.aric", role: "student", approved: true }]
  }, { idFactory: () => "training-1", now: () => 1 });
  assert.equal(canProgressTraining(project, { segment: { source: "journey" }, participantActorUuids: ["Actor.aric"] }).passed, false);
  assert.equal(canProgressTraining(project, { segment: { source: "journey" }, participantActorUuids: ["Actor.aric", "Actor.brom"] }).passed, true);
});

test("travel-compatible training continues across Segments and awards language proficiency", async () => {
  const updates = [];
  const actor = {
    uuid: "Actor.aric", documentName: "Actor",
    system: { traits: { languages: { value: new Set(["common"]) } } },
    update: async change => updates.push(change)
  };
  const { projects, segments } = trainingHarness({ actor });
  const raw = createTrainingProject({
    kind: "language", proficiencyId: "dwarvish", proficiencyLabel: "Dwarvish", requiredHours: 4,
    owner: { uuid: "Actor.aric" }, instructor: { mode: "participant", actorUuid: "Actor.brom" },
    participants: [{ actorUuid: "Actor.aric", role: "student", approved: true }, { actorUuid: "Actor.brom", role: "instructor", approved: true }]
  }, { idFactory: () => "training-project", now: () => 1 });
  const project = await projects.create(raw);
  for (const [name, source] of [["Rain Delay", "journey"], ["Neverwinter Evening", "session"]]) {
    const segment = await segments.create({ name, source, status: "open", participants: [{ actorUuid: "Actor.aric", availableHours: 2 }, { actorUuid: "Actor.brom", availableHours: 2 }] });
    await segments.allocate({ segmentId: segment.id, projectId: project.id, participantActorUuids: ["Actor.aric", "Actor.brom"], hours: 2 });
  }
  const completed = await projects.get(project.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.metadata.training.proficiencyAwarded, true);
  assert.deepEqual(updates[0]["system.traits.languages.value"], ["common", "dwarvish"]);
});

test("provider instructors must expose the matching instructor capability", () => {
  const project = createTrainingProject({
    kind: "artisanTool", proficiencyId: "smith", owner: { uuid: "Actor.aric" },
    instructor: { mode: "provider", providerId: "academy" },
    provider: { id: "academy", locationId: "waterdeep", capabilities: [{ type: "instructor", specialty: "brewers-supplies", tier: "rare" }] }
  }, { idFactory: () => "training-2", now: () => 1 });
  assert.equal(canProgressTraining(project, { segment: { source: "session" }, participantActorUuids: ["Actor.aric"] }).passed, false);
  project.provider.capabilities[0].specialty = "smith";
  assert.equal(canProgressTraining(project, { segment: { source: "session", locationId: "neverwinter" }, participantActorUuids: ["Actor.aric"] }).passed, false);
  assert.equal(canProgressTraining(project, { segment: { source: "session", locationId: "waterdeep" }, participantActorUuids: ["Actor.aric"] }).passed, true);
});

test("an NPC instructor at Neverwinter can only teach that Location's Instructor specialty", () => {
  const neverwinter = {
    id: "neverwinter",
    name: "Neverwinter",
    capabilities: [{ type: "instructor", tier: "common", specialty: "sign" }]
  };
  const choices = filterNpcTrainingChoices([
    { id: "sign", kind: "language", label: "Common Sign Language" },
    { id: "dwarvish", kind: "language", label: "Dwarvish" },
    { id: "ste", kind: "skillProficiency", label: "Stealth" }
  ], neverwinter);
  assert.deepEqual(choices.map(choice => choice.id), ["sign"]);
  const project = proficiency => createTrainingProject({
    kind: "language",
    proficiencyId: proficiency,
    owner: { uuid: "Actor.aric" },
    instructor: { mode: "npc", name: "Chapel Interpreter" },
    locationId: "neverwinter"
  });
  const context = proficiency => ({
    segment: { locationId: "neverwinter" },
    participantActorUuids: ["Actor.aric"],
    location: neverwinter
  });
  assert.equal(canProgressTraining(project("dwarvish"), context("dwarvish")).passed, false);
  assert.equal(canProgressTraining(project("sign"), context("sign")).passed, true);
  assert.equal(locationAllowsSpecialty(neverwinter, "instructor", "sign"), true);
  assert.throws(
    () => assertNpcInstructorSpecialty({ instructor: { mode: "npc" }, locationId: "neverwinter", proficiencyId: "dwarvish" }, neverwinter),
    /cannot teach that subject/
  );
  const openAcademy = { id: "academy", capabilities: [{ type: "instructor", specialty: "any" }] };
  assert.equal(filterNpcTrainingChoices(choices.concat([{ id: "dwarvish" }]), openAcademy).length, 2);
});

test("NPC specialty checks use Core locationAllowsSpecialty when it is exposed", () => {
  const prior = globalThis.MorelordCore;
  const location = { id: "neverwinter", capabilities: [{ type: "instructor", specialty: "sign" }] };
  globalThis.MorelordCore = {
    locations: {
      locationAllowsSpecialty: (place, type, key) => {
        assert.equal(place, location);
        assert.equal(type, "instructor");
        assert.equal(key, "sign");
        return true;
      }
    }
  };
  try {
    assert.equal(locationAllowsSpecialty(location, "instructor", "sign"), true);
  } finally {
    globalThis.MorelordCore = prior;
  }
});

test("a named NPC instructor requires the Project Location", () => {
  const project = createTrainingProject({
    kind: "language",
    proficiencyId: "dwarvish",
    owner: { uuid: "Actor.aric" },
    instructor: { mode: "npc", name: "Master Hlin" },
    locationId: "neverwinter"
  });
  assert.equal(canProgressTraining(project, { segment: { locationId: "waterdeep" }, participantActorUuids: ["Actor.aric"] }).passed, false);
  assert.equal(canProgressTraining(project, { segment: { locationId: "neverwinter" }, participantActorUuids: ["Actor.aric"] }).passed, true);
});

test("direct Project effort completion runs the training award lifecycle", async () => {
  const updates = [];
  const actor = {
    uuid: "Actor.aric", documentName: "Actor",
    system: { tools: { smith: { value: 0 } } },
    update: async change => updates.push(change)
  };
  const { projects } = trainingHarness({ actor });
  const project = await projects.create(createTrainingProject({
    kind: "artisanTool", proficiencyId: "smith", requiredHours: 2,
    owner: { uuid: "Actor.aric" }, instructor: { mode: "provider", providerId: "academy" },
    provider: { id: "academy", capabilities: [{ type: "instructor", specialty: "smith" }] }
  }, { idFactory: () => "direct-training", now: () => 1 }));
  const completed = await projects.applyEffort(project.id, 2);
  assert.equal(completed.metadata.training.proficiencyAwarded, true);
  assert.equal(updates[0]["system.tools.smith.value"], 1);
});

test("weapon proficiency and weapon mastery awards target specific D&D5e weapon traits", async () => {
  const updates = [];
  const actor = {
    uuid: "Actor.aric", documentName: "Actor",
    system: { traits: { weaponProf: { value: new Set(["sim"]), mastery: { value: new Set(["dagger"]) } } } },
    update: async change => updates.push(change)
  };
  const awards = new TrainingAwardService({ resolveUuid: async () => actor });
  const weapon = createTrainingProject({ kind: "weaponProficiency", proficiencyId: "longsword", owner: { uuid: actor.uuid }, instructor: { mode: "provider" } }, { idFactory: () => "weapon", now: () => 1 });
  const mastery = createTrainingProject({ kind: "weaponMastery", proficiencyId: "warhammer", owner: { uuid: actor.uuid }, instructor: { mode: "provider" } }, { idFactory: () => "mastery", now: () => 1 });
  assert.equal((await awards.award(weapon)).awarded, true);
  assert.equal((await awards.award(mastery)).awarded, true);
  assert.deepEqual(updates[0]["system.traits.weaponProf.value"], ["sim", "longsword"]);
  assert.deepEqual(updates[1]["system.traits.weaponProf.mastery.value"], ["dagger", "warhammer"]);
});
