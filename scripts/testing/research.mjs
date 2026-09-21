import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { listCharacterActors } from "../../../morelord-core/scripts/ui/actor-participation.js";
import { ResearchProjectApp } from "../apps/research-project-app.mjs";
import { ProjectDetailApp } from "../apps/detail-apps.mjs";
import { getHiddenRecipeIds, setHiddenRecipeIds } from "../../../morelord-craftworks/scripts/core/settings.mjs";

/** Creates and removes only its own Project and time pool; inventories are read-only. */
export async function runResearchTests({ onRendered = async () => {}, componentName = null } = {}) {
  return runInGameTests({ checks: [{ id: "downtime.recipe-research-ui", async run() {
    const app = new ResearchProjectApp();
    try {
      await app.render({ force: true });
      assert(app.element.querySelector(".ml-actor-identity"), "Researcher uses Core's actor identity.");
      for (const width of [680, 360]) {
        app.setPosition({ width });
        await new Promise(resolve => requestAnimationFrame(resolve));
        const body = app.element.querySelector(".ml-app-shell");
        assert(body && body.scrollWidth <= body.clientWidth + 1, "Research form must not overflow horizontally.");
        assert(app.element.querySelector(".ml-page-footer"), "Research uses Core's page footer.");
        await onRendered(app, `research-picker-${width}`);
      }
    } finally { await app.close(); }
  } }, { id: "downtime.recipe-research", async run() {
    assert(game.user.isGM, "Run recipe research verification as a GM.");
    const downtime = globalThis.MorelordDowntime;
    const catalog = globalThis.MorelordCraftworks?.downtimeIntegration;
    assert(catalog?.getResearchRecipes, "Updated Craftworks research integration must be loaded.");
    let owner, component, matching;
    for (const actor of listCharacterActors()) {
      for (const candidate of await catalog.getResearchComponents(actor.uuid)) {
        if (componentName && candidate.name !== componentName) continue;
        const recipes = await catalog.getResearchRecipes(actor.uuid, candidate.uuid);
        if (recipes.length) { owner = actor; component = candidate; matching = recipes; break; }
      }
      if (component) break;
    }
    assert(component, "A participant needs a monster component with enabled Drakkenheim recipe matches.");
    const originalQuantity = (await fromUuid(component.uuid)).system.quantity;
    const previouslyHidden = getHiddenRecipeIds();
    let project, pool, creation, details, recipeBrowser, learned = [];
    try {
      creation = new ResearchProjectApp();
      creation.ownerUuid = owner.uuid;
      await creation.render({ force: true });
      assert(creation.element.querySelector(`option[value="${component.uuid}"]`), "Personal/party component appears in the picker.");
      assert(creation.element.querySelector(".ml-actor-identity"), "Researcher uses Core's actor identity.");
      for (const width of [680, 360]) {
        creation.setPosition({ width });
        await new Promise(resolve => requestAnimationFrame(resolve));
        assert(creation.element.querySelector('[data-action="create"]'), "Start Research remains available.");
        await onRendered(creation, `research-create-${width}`);
      }
      project = await downtime.research.createProject({ owner: { uuid: owner.uuid, name: owner.name }, componentUuid: component.uuid });
      pool = await downtime.segments.create({ name: "Recipe research test fixture", status: "open", participants: [{ actorUuid: owner.uuid, availableHours: 1 }] });
      const request = { segmentId: pool.id, projectId: project.id, participantActorUuids: [owner.uuid], hours: 0.5 };
      await downtime.allocations.request(request);
      assert(!(await downtime.projects.get(project.id)).metadata.research.outcome, "Partial effort does not reveal recipes.");
      const result = await downtime.allocations.request(request);
      const recipes = result.project.metadata.research.outcome.recipes;
      learned = recipes.map(recipe => recipe.id);
      assert(learned.every(id => !getHiddenRecipeIds().has(id)), "Discovered recipes must be known to all players.");
      assert(result.project.status === "completed", "One hour completes research.");
      assert(recipes.length === Math.min(5, new Set(matching.map(recipe => recipe.id)).size), "Research returns up to five matches.");
      assert(new Set(recipes.map(recipe => recipe.id)).size === recipes.length, "Results contain no duplicates.");
      assert(recipes.every(recipe => matching.some(match => match.id === recipe.id)), "Every result uses the component.");
      assert((await fromUuid(component.uuid)).system.quantity === originalQuantity, "Research does not consume the component.");
      assert(JSON.stringify((await downtime.projects.get(project.id)).metadata.research.outcome.recipes) === JSON.stringify(recipes), "Reloading preserves results.");
      let rejected = false;
      try { await downtime.allocations.request(request); } catch { rejected = true; }
      assert(rejected, "Completed research rejects further allocation.");
      details = new ProjectDetailApp({ projectId: project.id });
      await details.render({ force: true });
      assert(details.element.querySelectorAll('[data-action="openResearchRecipe"]').length === recipes.length, "Saved results render recipe controls.");
      await onRendered(details, "research-results");
      recipeBrowser = await ProjectDetailApp.openResearchRecipe.call(details, { preventDefault() {} }, details.element.querySelector('[data-action="openResearchRecipe"]'));
      assert(recipeBrowser?.constructor.name === 'RecipeBrowserApp', "A discovered recipe opens Recipes, not Craft.");
      const visibleIds = [...new Set([...recipeBrowser.element.querySelectorAll('[data-recipe-id]')].map(element => element.dataset.recipeId))];
      assert(visibleIds.length === 1 && learned.includes(visibleIds[0]), "Recipes opens focused on the selected discovery.");
      await onRendered(recipeBrowser, "research-recipe-browser");
    } finally {
      await recipeBrowser?.close();
      if (learned.length) {
        const hidden = getHiddenRecipeIds();
        for (const id of learned) if (previouslyHidden.has(id)) hidden.add(id);
        await setHiddenRecipeIds(hidden);
      }
      await details?.close();
      await creation?.close();
      if (pool) await downtime.segments.remove(pool.id);
      if (project) await downtime.projects.remove(project.id);
    }
  } }] });
}
