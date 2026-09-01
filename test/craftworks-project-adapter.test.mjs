import test from "node:test";
import assert from "node:assert/strict";
import { CraftworksProjectAdapter } from "../scripts/adapters/craftworks-project-adapter.mjs";

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
