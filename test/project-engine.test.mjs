import test from "node:test";
import assert from "node:assert/strict";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";

function harness() {
  let stored = null;
  let time = 1000;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const service = new ProjectService({ repository, idFactory: () => "project-1", now: () => ++time });
  return { service, reload: () => new ProjectService({ repository, idFactory: () => "project-2", now: () => ++time }) };
}

const owner = { type: "actor", uuid: "Actor.aric", name: "Aric" };

test("a 120-hour effort Project survives repository reload and completes", async () => {
  const { service, reload } = harness();
  await service.create({ name: "Learn Brewer's Supplies", activityType: "training", owner, status: "active", progress: { mode: "effort", effort: { requiredHours: 120 } } });
  await service.applyEffort("project-1", 44);
  const reloaded = reload();
  assert.equal((await reloaded.get("project-1")).progress.effort.completedHours, 44);
  const completed = await reloaded.applyEffort("project-1", 76);
  assert.equal(completed.status, "completed");
  assert.equal(completed.progress.effort.completedHours, 120);
});

test("a 10-day provider Project advances without character effort", async () => {
  const { service } = harness();
  await service.create({ name: "Commission Plate Armor", activityType: "commission-crafting", owner, status: "active", provider: { id: "smithy", name: "Ironhammer Smithy", locationId: "neverwinter" }, collectionLocationId: "neverwinter", progress: { mode: "elapsed", elapsed: { requiredDays: 10 } } });
  for (let day = 1; day <= 10; day += 1) await service.advanceDay({ idempotencyKey: `manual:${day}` });
  const project = await service.get("project-1");
  assert.equal(project.progress.elapsed.completedDays, 10);
  assert.equal(project.status, "awaiting-collection");
});

test("duplicate day keys never advance a provider Project twice", async () => {
  const { service } = harness();
  await service.create({ name: "Potion Order", activityType: "commission-crafting", owner, status: "active", progress: { mode: "elapsed", elapsed: { requiredDays: 3 } } });
  const first = await service.advanceDay({ idempotencyKey: "journey:j1:day:1" });
  const duplicate = await service.advanceDay({ idempotencyKey: "journey:j1:day:1" });
  assert.equal(first.advanced, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await service.get("project-1")).progress.elapsed.completedDays, 1);
});

test("cancelling a Project preserves it and records the cancellation", async () => {
  const { service } = harness();
  await service.create({ name: "Learn Dwarvish", activityType: "training", owner, status: "active", progress: { mode: "effort", effort: { requiredHours: 120 } } });
  const cancelled = await service.cancel("project-1");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.history.at(-1).type, "cancelled");
  assert.equal((await service.get("project-1")).name, "Learn Dwarvish");
});

test("an unused Project can be deleted but recorded progress is preserved", async () => {
  const { service } = harness();
  const unused = await service.create({ name: "Mistake", activityType: "training", owner: { uuid: "Actor.aric" }, status: "active", progress: { mode: "effort", effort: { requiredHours: 10 } } });
  assert.equal(await service.removeUnused(unused.id), true);
  const progressed = await service.create({ name: "Practice", activityType: "training", owner: { uuid: "Actor.aric" }, status: "active", progress: { mode: "effort", effort: { requiredHours: 10 } } });
  await service.applyEffort(progressed.id, 1);
  await assert.rejects(() => service.removeUnused(progressed.id), /recorded progress/);
});

test("deleting an unused Project tolerates legacy Sessions without planned Project ids", async () => {
  let stored = null;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const service = new ProjectService({ repository, idFactory: () => "project-1", now: () => 1000 });
  const project = await service.create({ name: "Mistake", activityType: "training", owner, status: "active", progress: { mode: "effort", effort: { requiredHours: 10 } } });
  const legacy = await repository.read();
  legacy.sessions.legacy = { id: "legacy", name: "Old Session" };
  await repository.write(legacy);
  assert.equal(await service.removeUnused(project.id), true);
  assert.deepEqual((await repository.read()).sessions.legacy.plannedProjectIds, []);
});

test("activities register as plugins rather than core workflow branches", () => {
  const registry = new ActivityRegistry();
  registry.register({ id: "training", name: "Training", createProject: data => data });
  registry.register({ id: "crafting", name: "Crafting", launch: () => "opened" });
  assert.equal(registry.get("training").name, "Training");
  assert.equal(registry.get("crafting").launch(), "opened");
  assert.equal(registry.get("crafting").createProject, null);
  assert.equal(registry.list().length, 2);
});
