import test from "node:test";
import assert from "node:assert/strict";
import { CraftworksProjectAdapter, visibleCraftingProgress } from "../scripts/adapters/craftworks-project-adapter.mjs";
import { craftingPlaceLabel, craftingPlaces } from "../scripts/domain/crafting-places.mjs";

test("Craftworks adapter exposes ready marked recipes and active jobs once", async () => {
  const actor = { id: "joeb", uuid: "Actor.joeb", name: "Joeb" };
  const recipes = new Map([
    ["ready", { id: "ready", name: "Healing Potion", craft: { hoursRequired: 4 } }],
    ["missing", { id: "missing", name: "Plate Armor", craft: { hoursRequired: 40 } }],
    ["active", { id: "active", name: "Longsword", craft: { hoursRequired: 8 } }]
  ]);
  const activeJob = { recipeId: "active", inventoryActorUuid: actor.uuid };
  const api = {
    markedRecipes: { list: () => ["ready", "missing", "active"] },
    craftingJobs: {
      list: () => [activeJob],
      getProgress: () => ({ hoursRequired: 8, progressHours: 2 })
    },
    recipes: { get: id => recipes.get(id) },
    recipePlanner: { plan: recipe => ({ ready: recipe.id === "ready" }) },
    craftingEnvironment: { evaluate: () => ({ passed: true }) }
  };
  const adapter = new CraftworksProjectAdapter({ getApi: () => api });
  const projects = await adapter.list({ actors: [actor], locationName: "Neverwinter" });
  assert.deepEqual(projects.map(project => project.recipeId).sort(), ["active", "ready"]);
  assert.equal(projects.find(project => project.recipeId === "active").progressLabel, "2 / 8 hours");
  assert.equal(projects.find(project => project.recipeId === "ready").status, "ready");
});

test("Craftworks adapter shows hours spent when a check does not advance progress", async () => {
  const actor = { id: "joeb", uuid: "Actor.joeb", name: "Joeb" };
  const recipe = { id: "active", name: "Longsword", craft: { hoursRequired: 8 } };
  const api = {
    markedRecipes: { list: () => ["active"] },
    craftingJobs: {
      list: () => [{ recipeId: "active", inventoryActorUuid: actor.uuid }],
      getProgress: () => ({ hoursRequired: 8, progressHours: 2, timeSpentHours: 4 })
    },
    recipes: { get: () => recipe },
    recipePlanner: { plan: () => ({ ready: true }) },
    craftingEnvironment: { evaluate: () => ({ passed: true }) }
  };
  const adapter = new CraftworksProjectAdapter({ getApi: () => api });
  const [project] = await adapter.list({ actors: [actor], locationName: "Neverwinter" });
  assert.equal(project.progressLabel, "2 / 8 hours (4 hours spent)");
  assert.equal(project.progressPercent, 25);
});

test("Craftworks adapter excludes recipes unavailable at the downtime location", async () => {
  const actor = { id: "joeb", uuid: "Actor.joeb", name: "Joeb" };
  const recipe = { id: "forge", name: "Ball Bearings", craft: { hoursRequired: 2 } };
  const api = {
    markedRecipes: { list: () => [recipe.id] },
    craftingJobs: { list: () => [] },
    recipes: { get: () => recipe },
    recipePlanner: { plan: () => ({ ready: true, inventoryActorUuid: "Actor.party" }) },
    craftingEnvironment: {
      evaluate: (_recipe, { location }) => ({ passed: location.capabilities.some(entry => entry.type === "forge") })
    }
  };
  const adapter = new CraftworksProjectAdapter({ getApi: () => api });
  const projects = await adapter.list({
    actors: [actor],
    location: { id: "road", capabilities: [] },
    locationName: "On the Road"
  });
  assert.deepEqual(projects, []);
});

test("project progress prefers newer actor flags over a stale Craftworks cache", () => {
  const actor = {
    id: "darro",
    uuid: "Actor.darro",
    flags: { "morelord-craftworks": { craftingJobs: { antitoxin: {
      recipeId: "antitoxin", hoursRequired: 2, successes: 0, attempts: 2, updatedAt: 20
    } } } }
  };
  const api = { craftingJobs: { getProgress: () => ({ hoursRequired: 2, progressHours: 2, timeSpentHours: 2, updatedAt: 10 }) } };
  const progress = visibleCraftingProgress(actor, api, "antitoxin", actor.uuid);
  assert.equal(progress.timeSpentHours, 4);
  assert.equal(progress.progressHours, 0);
});

test("Neverwinter crafting projects stay listed when the active Session is On the Road", async () => {
  const neverwinter = { id: "neverwinter", name: "Neverwinter", capabilities: [{ type: "forge", tier: "rare" }] };
  const road = { id: "road", name: "On the Road", settlementType: "road", capabilities: [] };
  const actor = { id: "joeb", uuid: "Actor.joeb", name: "Joeb" };
  const recipes = new Map([
    ["active", { id: "active", name: "Longsword", craft: { hoursRequired: 8 } }],
    ["ready", { id: "ready", name: "Healing Potion", craft: { hoursRequired: 4 } }]
  ]);
  const api = {
    markedRecipes: { list: () => ["ready", "active"] },
    craftingJobs: {
      list: () => [{ recipeId: "active", inventoryActorUuid: actor.uuid }],
      getProgress: () => ({ hoursRequired: 8, progressHours: 2 })
    },
    recipes: { get: id => recipes.get(id) },
    recipePlanner: { plan: () => ({ ready: true, inventoryActorUuid: actor.uuid }) },
    craftingEnvironment: {
      evaluate: (_recipe, context = {}) => ({
        passed: context.location?.capabilities?.some(entry => entry.type === "forge") === true
      })
    }
  };
  const adapter = new CraftworksProjectAdapter({ getApi: () => api });
  const sessionOnly = await adapter.list({ actors: [actor], location: road, locationName: "On the Road" });
  assert.deepEqual(sessionOnly.map(project => project.recipeId), ["active"]);
  assert.equal(sessionOnly[0].status, "paused");
  const places = craftingPlaces({
    activeContext: { location: road, source: "road", sessionId: "market-week" },
    sceneLocation: neverwinter
  });
  assert.deepEqual(places.map(place => place.id), ["road", "neverwinter"]);
  const projects = await adapter.list({
    actors: [actor],
    places,
    locationName: craftingPlaceLabel(places, neverwinter)
  });
  assert.deepEqual(projects.map(project => project.recipeId).sort(), ["active", "ready"]);
  assert.equal(projects.every(project => project.locationName === "Neverwinter"), true);
  assert.equal(projects.find(project => project.recipeId === "active").status, "in-progress");
});

test("one recipe whose location check throws does not hide the other crafting projects", async () => {
  const actor = { id: "joeb", uuid: "Actor.joeb", name: "Joeb" };
  const recipes = new Map([
    ["bad", { id: "bad", name: "Broken Rule", craft: { hoursRequired: 2 } }],
    ["good", { id: "good", name: "Antitoxin", craft: { hoursRequired: 2 } }]
  ]);
  const api = {
    markedRecipes: { list: () => ["bad", "good"] },
    craftingJobs: { list: () => [] },
    recipes: { get: id => recipes.get(id) },
    recipePlanner: { plan: () => ({ ready: true }) },
    craftingEnvironment: {
      evaluate: recipe => {
        if (recipe.id === "bad") throw new Error("Unknown capability tier: artifact.");
        return { passed: true };
      }
    }
  };
  const adapter = new CraftworksProjectAdapter({ getApi: () => api });
  const projects = await adapter.list({ actors: [actor], location: { id: "neverwinter", name: "Neverwinter", capabilities: [] } });
  assert.deepEqual(projects.map(project => project.recipeId).sort(), ["bad", "good"]);
});

test("opening a Craftworks project requests a focused recipe window", () => {
  let options = null;
  const api = {
    openCraft: value => { options = value; },
    crafterContext: { select: () => {} }
  };
  const adapter = new CraftworksProjectAdapter({ getApi: () => api });
  adapter.open({ recipeId: "potion", ownerUuid: "Actor.hero", inventoryActorUuid: "Actor.party" });
  assert.deepEqual(options, {
    recipeId: "potion",
    crafterActorUuid: "Actor.hero",
    inventoryActorUuid: "Actor.party"
  });
});
