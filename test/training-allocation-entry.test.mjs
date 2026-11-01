import test from "node:test";
import assert from "node:assert/strict";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SegmentService } from "../scripts/services/segment-service.mjs";
import { AllocationAuthorityService } from "../scripts/services/allocation-authority-service.mjs";
import { canProgressTraining, createTrainingProject, trainingAudience } from "../scripts/activities/training/training-activity.mjs";

test("the Project Allocate button charges a token-linked instructor through the player socket", async () => {
  let stored = null;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const registry = new ActivityRegistry();
  registry.register({ id: "training", name: "Training", createProject: data => createTrainingProject(data), canProgress: canProgressTraining });
  const projects = new ProjectService({ repository, activityRegistry: registry, idFactory: () => "project-1", now: () => 1 });
  const segments = new SegmentService({
    repository,
    activityRegistry: registry,
    idFactory: () => "segment-1",
    now: () => 2,
    resolveActor: async uuid => uuid === "Scene.s1.Token.bromToken" ? "Actor.brom" : uuid
  });
  const player = { id: "player", isGM: false, active: true };
  const gm = { id: "gm", isGM: true, active: true };
  const prior = { game: globalThis.game, ui: globalThis.ui, foundry: globalThis.foundry, fromUuid: globalThis.fromUuid };
  globalThis.foundry = {
    applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => class extends Base {} } },
    utils: { randomID: () => "req-1" }
  };
  const { ProjectDetailApp } = await import("../scripts/apps/detail-apps.mjs");
  globalThis.fromUuid = async uuid => ({
    uuid,
    documentName: "Actor",
    testUserPermission: user => user?.id === "player" && uuid === "Actor.aric"
  });
  const socket = {
    handler: null,
    on(_event, fn) { this.handler = fn; },
    emit(_event, message) {
      if (String(message.type).endsWith(".request")) {
        globalThis.game.user = gm;
        this.handler(message);
        return;
      }
      const signedIn = globalThis.game.user;
      globalThis.game.user = player;
      try { this.handler(message); }
      finally { globalThis.game.user = signedIn; }
    }
  };
  globalThis.game = {
    user: gm,
    users: { get: id => [player, gm].find(user => user.id === id) },
    socket
  };
  const notices = [];
  globalThis.ui = { notifications: { info() {}, error(message) { notices.push(message); } } };
  const authority = new AllocationAuthorityService({
    segments, projects, sessions: { planProject() {} }, isPrimaryGm: () => true, getTraining: () => null
  });
  authority.start();
  const project = await projects.create(createTrainingProject({
    kind: "language",
    proficiencyId: "dwarvish",
    proficiencyLabel: "Dwarvish",
    requiredHours: 40,
    owner: { uuid: "Actor.aric", name: "Aric" },
    instructor: { mode: "participant", actorUuid: "Actor.brom", name: "Brom" }
  }, { idFactory: () => "project-1", now: () => 1 }));
  const saved = await repository.read();
  saved.projects[project.id].metadata.training.instructor = { actorUuid: "Scene.s1.Token.bromToken", name: "Brom" };
  await repository.write(saved);
  const segment = await segments.create({
    name: "Week",
    status: "open",
    metadata: { sessionId: null },
    participants: [
      { actorUuid: "Actor.aric", name: "Aric", availableHours: 40 },
      { actorUuid: "Actor.brom", name: "Brom", availableHours: 40 }
    ]
  });
  globalThis.game.user = player;
  const app = {
    projectId: project.id,
    element: {
      querySelectorAll: selector => selector === "[data-allocation-actor]:checked" ? [{ value: "Actor.aric" }] : [],
      querySelector: selector => selector === "[data-allocation-hours]" ? { value: "4" } : null
    },
    constructor: { services: { allocationAuthority: authority } },
    render: async () => {}
  };
  await ProjectDetailApp.allocate.call(app, { preventDefault() {} }, { disabled: false, dataset: { allocationPoolId: segment.id } });
  assert.deepEqual(notices, []);
  const after = await segments.get(segment.id);
  assert.equal(after.participants.find(entry => entry.actorUuid === "Actor.aric").allocatedHours, 4);
  assert.equal(after.participants.find(entry => entry.actorUuid === "Actor.brom").allocatedHours, 4);
  const updated = await projects.get(project.id);
  assert.equal(updated.progress.effort.completedHours, 4);
  const bromView = trainingAudience(updated, ["Actor.brom"]);
  assert.equal(bromView.readOnly, true);
  assert.equal(bromView.listName, "Instructing Aric");
  assert.equal(trainingAudience(updated, ["Actor.aric"]).readOnly, false);
  globalThis.game = prior.game;
  globalThis.ui = prior.ui;
  globalThis.foundry = prior.foundry;
  globalThis.fromUuid = prior.fromUuid;
});
