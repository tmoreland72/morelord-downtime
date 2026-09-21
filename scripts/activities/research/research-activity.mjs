import { createProject } from "../../domain/project.mjs";
import { getModuleApi } from "../../integrations/core-api.mjs";

export const RESEARCH_ACTIVITY_ID = "research-drakkenheim-recipes";

export class RecipeResearchService {
  constructor({ integration = () => getModuleApi("morelord-craftworks", "MorelordCraftworks")?.downtimeIntegration, random = Math.random } = {}) {
    this.integration = integration;
    this.random = random;
  }

  catalog() {
    const api = this.integration();
    if (!api?.getResearchComponents || !api?.getResearchRecipes) {
      throw new Error("Recipe research requires Morelord Craftworks with recipe research support.");
    }
    if (!this.isAvailable()) throw new Error("Research requires the enabled Drakkenheim content pack and access to it.");
    return api;
  }

  isAvailable() { return this.integration()?.isResearchAvailable?.() === true; }

  async createProject({ owner, componentUuid } = {}, options = {}) {
    const component = (await this.catalog().getResearchComponents(owner?.uuid))
      .find(item => item.uuid === componentUuid);
    if (!component) throw new Error("Choose a monster component from the character's or party's inventory.");
    return createProject({
      name: `Research Drakkenheim Recipes: ${component.name}`,
      activityType: RESEARCH_ACTIVITY_ID,
      owner,
      status: "active",
      participants: [{ actorUuid: owner.uuid, role: "researcher", approved: true }],
      progress: { mode: "effort", effort: { requiredHours: 1 } },
      metadata: { research: { component, outcome: null } }
    }, options);
  }

  async canProgress(project, { participantActorUuids = [], hours } = {}) {
    if (!participantActorUuids.includes(project.owner.uuid)) {
      return { passed: false, reasons: ["The researcher must allocate their own time."] };
    }
    if (Number(hours) > 1 - project.progress.effort.completedHours) {
      return { passed: false, reasons: ["Allocate only the remaining research time (one hour total)."] };
    }
    try {
      const components = await this.catalog().getResearchComponents(project.owner.uuid);
      if (!components.some(item => item.uuid === project.metadata.research.component.uuid)) {
        throw new Error("The selected monster component is no longer available in character or party inventory.");
      }
      return { passed: true, reasons: [] };
    } catch (error) { return { passed: false, reasons: [error.message] }; }
  }

  async complete(project) {
    if (project.metadata.research.outcome) return project;
    const recipes = await this.catalog().getResearchRecipes(project.owner.uuid, project.metadata.research.component.uuid);
    const pool = [...new Map(recipes.map(recipe => [recipe.id, recipe])).values()];
    const selected = [];
    while (pool.length && selected.length < 5) {
      const [recipe] = pool.splice(Math.floor(this.random() * pool.length), 1);
      selected.push({ id: recipe.id, name: recipe.name, img: recipe.img || recipe.output?.img || "icons/sundries/books/book-open-brown.webp" });
    }
    const result = structuredClone(project);
    result.metadata.research.outcome = { recipes: selected };
    await this.catalog().learnResearchRecipes(selected.map(recipe => recipe.id));
    return result;
  }
}
