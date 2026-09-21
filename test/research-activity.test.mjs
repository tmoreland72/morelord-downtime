import test from "node:test";
import assert from "node:assert/strict";
import { RecipeResearchService, RESEARCH_ACTIVITY_ID } from "../scripts/activities/research/research-activity.mjs";
import { CraftingMaterialService } from "../../morelord-craftworks/scripts/crafting/crafting-material-service.mjs";
import { combinedCraftingInventory } from "../../morelord-craftworks/scripts/crafting/group-membership.mjs";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SegmentService } from "../scripts/services/segment-service.mjs";

const component = { uuid: "Actor.party.Item.bone", name: "Spine", img: "bone.webp", inventoryName: "Party" };
const input = { owner: { uuid: "Actor.hero", name: "Hero" }, componentUuid: component.uuid };

test("one hour saves five unique matches; reopening or resolving again does not reroll", async () => {
  let available = true, calls = 0, stored, learned = [];
  const research = new RecipeResearchService({ random: () => 0.5, integration: () => ({
    isResearchAvailable: () => true, learnResearchRecipes: async ids => { learned = ids; },
    getResearchComponents: async () => available ? [component] : [],
    getResearchRecipes: async () => { calls++; return Array.from({ length: 8 }, (_, id) => ({ id: String(id), name: `Recipe ${id}` })); }
  }) });
  const registry = new ActivityRegistry();
  registry.register({ id: RESEARCH_ACTIVITY_ID, createProject: value => value,
    canProgress: (project, context) => research.canProgress(project, context), onComplete: project => research.complete(project) });
  const repository = new ProjectRepository({ getState: async () => stored, setState: async value => { stored = structuredClone(value); } });
  const projects = new ProjectService({ repository, activityRegistry: registry });
  const segments = new SegmentService({ repository, activityRegistry: registry, idFactory: () => "pool" });
  const project = await projects.create(await research.createProject(input, { idFactory: () => "research" }));
  assert.equal(project.progress.effort.requiredHours, 1);
  const segment = await segments.create({ name: "Study", status: "open", participants: [{ actorUuid: input.owner.uuid, availableHours: 2 }] });
  const allocation = { projectId: project.id, segmentId: segment.id, participantActorUuids: [input.owner.uuid], hours: 0.5 };
  available = false;
  await assert.rejects(() => segments.allocate(allocation), /no longer available/);
  assert.equal((await segments.get(segment.id)).participants[0].allocatedHours, 0);
  available = true;
  await assert.rejects(() => segments.allocate({ ...allocation, hours: 2 }), /remaining research time/);
  await assert.rejects(() => segments.allocate({ ...allocation, participantActorUuids: [] }), /researcher/);
  assert.equal((await segments.allocate(allocation)).project.metadata.research.outcome, null);
  const completed = (await segments.allocate(allocation)).project;
  assert.equal(completed.status, "completed");
  assert.equal(completed.metadata.research.outcome.recipes.length, 5);
  assert.equal(new Set(completed.metadata.research.outcome.recipes.map(recipe => recipe.id)).size, 5);
  assert.deepEqual(learned, completed.metadata.research.outcome.recipes.map(recipe => recipe.id));
  assert.deepEqual(await research.complete(await projects.get(project.id)), completed);
  assert.equal(calls, 1);
  await assert.rejects(() => segments.allocate(allocation), /not available for progress/);
  assert.equal((await segments.get(segment.id)).participants[0].allocatedHours, 1);
});

test("zero or few matches, invalid components, and unavailable integration", async () => {
  let recipes = [];
  const service = new RecipeResearchService({ integration: () => ({
    isResearchAvailable: () => true, learnResearchRecipes: async () => {},
    getResearchComponents: async () => [component], getResearchRecipes: async () => recipes
  }) });
  const project = await service.createProject(input);
  assert.deepEqual((await service.complete(project)).metadata.research.outcome.recipes, []);
  recipes = [{ id: "one", name: "One" }, { id: "one", name: "Duplicate" }, { id: "two", name: "Two" }];
  assert.equal((await service.complete(project)).metadata.research.outcome.recipes.length, 2);
  await assert.rejects(() => service.createProject({ ...input, componentUuid: "Actor.stranger.Item.bone" }), /Choose a monster component/);
  await assert.rejects(() => new RecipeResearchService({ integration: () => null }).createProject(input), /requires Morelord Craftworks/);
});

test("component matching reuses crafting rules for alternatives, tags, rarity and quantities", () => {
  const materials = new CraftingMaterialService({});
  const item = { flags: { "morelord-craftworks": { materialId: "spine", rarity: "rare", tags: ["monster-component", "drakkenheim-component-bones-spine-from-a-monstrosity"] } }, system: { quantity: 1 } };
  const recipe = match => ({ requirementGroups: [{ requirements: [{ type: "alternatives", alternatives: [
    { match: { materialId: "other" } }, { quantity: 10, match }
  ] }] }] });
  assert.equal(materials.recipeUsesItem(recipe({ tags: ["drakkenheim-component-bones-spine"], rarity: "rare" }), item), true);
  assert.equal(materials.recipeUsesItem(recipe({ tags: ["drakkenheim-component-bones-ribs"] }), item), false);
  assert.equal(materials.recipeUsesItem(recipe({ materialId: "spine", rarity: "common" }), item), false);
  assert.equal(materials.recipeUsesItem({ requirementGroups: [], output: { materialId: "spine" } }, item), false);
});

test("inventory includes the researcher's parties without unrelated actors or consuming items", () => {
  const personal = { uuid: "personal", system: { quantity: 2 } }, shared = { uuid: "shared", system: { quantity: 3 } };
  const hero = { id: "hero", uuid: "Actor.hero", type: "character", items: [personal] };
  const party = { type: "group", system: { members: [{ actor: hero }] }, items: [shared] };
  globalThis.game = { actors: [hero, party, { type: "group", system: { members: ["other"] }, items: [{ uuid: "excluded" }] }] };
  try {
    assert.deepEqual(combinedCraftingInventory(hero).items, [personal, shared]);
    assert.equal(shared.system.quantity, 3);
  } finally { delete globalThis.game; }
});
