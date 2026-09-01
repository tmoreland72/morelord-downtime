import test from "node:test";
import assert from "node:assert/strict";
import { createCommissionProject } from "../scripts/activities/commission/commission-activity.mjs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";

test("a Commission advances on unique day keys and waits for collection", async () => {
  let stored = null;
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  const projects = new ProjectService({ repository, idFactory: () => "commission-1", now: () => 100 });
  const project = await projects.create(createCommissionProject({
    owner: { uuid: "Actor.joeb", name: "Joeb" },
    contractorName: "Arlen the Smith",
    itemDescription: "Silvered longsword",
    locationId: "camp-dawn",
    requiredDays: 2,
    notes: "Still owes 50 gp"
  }, { idFactory: () => "commission-1", now: () => 1 }));
  assert.equal(project.progress.mode, "elapsed");
  assert.equal(project.collectionLocationId, "camp-dawn");
  await projects.advanceDay({ idempotencyKey: "calendar:1" });
  await projects.advanceDay({ idempotencyKey: "calendar:1" });
  assert.equal((await projects.get(project.id)).progress.elapsed.completedDays, 1);
  await projects.advanceDay({ idempotencyKey: "calendar:2" });
  const completed = await projects.get(project.id);
  assert.equal(completed.status, "awaiting-collection");
  assert.equal(completed.metadata.commission.notes, "Still owes 50 gp");
});

test("a Commission requires contractor, item, Location, and whole labor days", () => {
  assert.throws(() => createCommissionProject({ owner: { uuid: "Actor.joeb" }, contractorName: "Smith", itemDescription: "Sword", locationId: "camp", requiredDays: 1.5 }), /positive whole number/);
});
