export class CraftworksProjectAdapter {
  constructor({ getApi = () => game.modules.get("morelord-craftworks")?.api ?? globalThis.MorelordCraftworks } = {}) {
    this.getApi = getApi;
  }

  async list({ actors = [], locationName = "Current Location", location = null } = {}) {
    const api = this.getApi();
    if (!api?.markedRecipes || !api?.craftingJobs || !api?.recipes || !api?.recipePlanner) return [];
    const projects = [];
    for (const actor of actors) {
      const activeJobs = api.craftingJobs.list(actor, { activeOnly: true });
      const activeByRecipe = new Map(activeJobs.map(job => [String(job.recipeId), job]));
      const recipeIds = new Set([...api.markedRecipes.list(actor).map(String), ...activeByRecipe.keys()]);
      for (const recipeId of recipeIds) {
        const recipe = api.recipes.get(recipeId, { includeDisabled: true });
        if (!recipe) continue;
        const job = activeByRecipe.get(recipeId) ?? null;
        const readiness = job ? null : api.recipePlanner.plan(recipe, actor);
        const environment = api.craftingEnvironment?.evaluate?.(recipe, { location }) ?? { passed: true };
        if (!environment.passed || (!job && !readiness?.ready)) continue;
        const progress = job ? api.craftingJobs.getProgress(recipeId, actor, job.inventoryActorUuid) : null;
        const requiredHours = Number(progress?.hoursRequired ?? recipe.craft?.hoursRequired ?? 0);
        const completedHours = Number(progress?.progressHours ?? 0);
        projects.push({
          id: `craftworks:${actor.id}:${recipeId}`,
          external: true,
          externalType: "craftworks",
          recipeId,
          inventoryActorUuid: job?.inventoryActorUuid ?? readiness?.inventoryActorUuid ?? actor.uuid,
          ownerUuid: actor.uuid,
          name: recipe.name,
          activityLabel: "Crafting",
          status: job ? (environment.passed ? "in-progress" : "paused") : "ready",
          ownerName: actor.name,
          locationName,
          progressLabel: `${completedHours} / ${requiredHours} hours`,
          progressPercent: requiredHours ? Math.min(100, Math.round(completedHours / requiredHours * 100)) : 0,
          canEditProject: true,
          canDeleteProject: false,
          isClosed: false
        });
      }
    }
    return projects.sort((left, right) => left.ownerName.localeCompare(right.ownerName) || left.name.localeCompare(right.name));
  }

  open(project) {
    const api = this.getApi();
    if (typeof api?.openCraft !== "function") throw new Error("Morelord Craftworks is unavailable.");
    api.crafterContext?.select?.(project.ownerUuid);
    return api.openCraft({
      recipeId: project.recipeId,
      crafterActorUuid: project.ownerUuid,
      inventoryActorUuid: project.inventoryActorUuid ?? null
    });
  }
}
