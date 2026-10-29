import { getModuleApi } from "../integrations/core-api.mjs";

const CRAFT_INTERVAL_HOURS = 2;

function persistedCraftingJob(actor, recipeId) {
  const jobs = actor?.flags?.["morelord-craftworks"]?.craftingJobs ?? {};
  if (jobs[recipeId]) return jobs[recipeId];
  const prefix = `${recipeId}::`;
  const key = Object.keys(jobs).find(candidate => candidate.startsWith(prefix));
  return key ? jobs[key] : null;
}

function progressFromFlags(job) {
  if (!job) return null;
  const hoursRequired = Math.max(0, Number(job.hoursRequired ?? 0));
  if (job.completedWithoutCheck) {
    return { hoursRequired, progressHours: hoursRequired, timeSpentHours: hoursRequired, updatedAt: Number(job.updatedAt ?? 0) };
  }
  const successes = Math.max(0, Number(job.successes ?? 0));
  const attempts = Math.max(0, Number(job.attempts ?? 0));
  return {
    hoursRequired,
    progressHours: Math.min(hoursRequired, successes * CRAFT_INTERVAL_HOURS),
    timeSpentHours: attempts * CRAFT_INTERVAL_HOURS,
    updatedAt: Number(job.updatedAt ?? 0)
  };
}

/** Craftworks caches job progress per client. Actor flags are the copy every client receives. */
export function visibleCraftingProgress(actor, api, recipeId, inventoryActorUuid) {
  const flagsJob = persistedCraftingJob(actor, recipeId);
  const fromFlags = progressFromFlags(flagsJob);
  let fromApi = null;
  try {
    fromApi = api?.craftingJobs?.getProgress?.(recipeId, actor, inventoryActorUuid) ?? null;
  } catch {
    fromApi = null;
  }
  if (!fromFlags) return fromApi;
  if (!fromApi) return fromFlags;
  return Number(flagsJob?.updatedAt ?? 0) > Number(fromApi.updatedAt ?? 0) ? { ...fromApi, ...fromFlags } : fromApi;
}

export class CraftworksProjectAdapter {
  constructor({ getApi = () => getModuleApi("morelord-craftworks", "MorelordCraftworks") } = {}) {
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
        const progress = job ? visibleCraftingProgress(actor, api, recipeId, job.inventoryActorUuid) : null;
        const requiredHours = Number(progress?.hoursRequired ?? recipe.craft?.hoursRequired ?? 0);
        const completedHours = Number(progress?.progressHours ?? 0);
        const reportedSpent = Number(progress?.timeSpentHours);
        const timeSpentHours = Number.isFinite(reportedSpent) ? reportedSpent : completedHours;
        const spentLabel = timeSpentHours > completedHours
          ? ` (${timeSpentHours} ${timeSpentHours === 1 ? "hour" : "hours"} spent)`
          : "";
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
          progressLabel: `${completedHours} / ${requiredHours} hours${spentLabel}`,
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
