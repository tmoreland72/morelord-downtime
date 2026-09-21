import { MODULE_ID, STATE_SETTING } from "./constants.mjs";
import { ActivityRegistry } from "./domain/activity-registry.mjs";
import { ProjectRepository } from "./persistence/project-repository.mjs";
import { ProjectService } from "./services/project-service.mjs";
import { SegmentService } from "./services/segment-service.mjs";
import { TRAINING_ACTIVITY_ID, canProgressTraining, createTrainingProject, trainingSummary } from "./activities/training/training-activity.mjs";
import { TrainingAwardService, applyTrainingAwardResult } from "./activities/training/training-award-service.mjs";
import { DowntimeDashboardApp } from "./apps/downtime-dashboard-app.mjs";
import { NewProjectApp, SessionEditorApp, TrainingProjectApp } from "./apps/creation-apps.mjs";
import { CommissionProjectApp } from "./apps/creation-apps.mjs";
import { ProjectDetailApp, SessionDetailApp } from "./apps/detail-apps.mjs";
import { SessionService } from "./services/session-service.mjs";
import { AllocationAuthorityService } from "./services/allocation-authority-service.mjs";
import { DOWNTIME_DOCUMENTATION } from "./documentation/product-documentation.mjs";
import { queueLiveWindowRefresh } from "./apps/live-window-registry.mjs";
import { Dnd5eProficiencyAdapter } from "./adapters/dnd5e-proficiency-adapter.mjs";
import { CraftworksProjectAdapter } from "./adapters/craftworks-project-adapter.mjs";
import { COMMISSION_ACTIVITY_ID, commissionSummary, createCommissionProject } from "./activities/commission/commission-activity.mjs";
import { getCoreApi, getCoreLocations, getModuleApi } from "./integrations/core-api.mjs";
import { SOURCE_ITEM_ACTIVITY_ID, createSourceItemProject, sourceItemSummary } from "./activities/source-item/source-item-activity.mjs";
import { SourceItemResolutionService } from "./activities/source-item/source-item-resolution-service.mjs";
import { SourceItemProjectApp } from "./apps/source-item-app.mjs";
import { MarketplaceSourcingAdapter } from "./adapters/marketplace-sourcing-adapter.mjs";
import { RESEARCH_ACTIVITY_ID, RecipeResearchService } from "./activities/research/research-activity.mjs";
import { ResearchProjectApp } from "./apps/research-project-app.mjs";

const repository = new ProjectRepository();
const activities = new ActivityRegistry();
const projects = new ProjectService({ repository, activityRegistry: activities });
const proficiencies = new Dnd5eProficiencyAdapter();
const craftworksProjects = new CraftworksProjectAdapter();
const marketplaceSourcing = new MarketplaceSourcingAdapter();
const sourceItemResolution = new SourceItemResolutionService({ catalog: marketplaceSourcing });
const trainingAwards = new TrainingAwardService({ proficiencyAdapter: proficiencies });
const research = new RecipeResearchService();
const researchApi = {
  createProject: async data => projects.create(await research.createProject(data, { idFactory: () => foundry.utils.randomID() }))
};
let dashboardApp = null;
let trainingApi = null;
let commissionApi = null;
let sourceItemApi = null;
const sessions = new SessionService({ repository });
const segments = new SegmentService({
  repository,
  activityRegistry: activities,
  requirementEvaluator: (requirements, context) => {
    const locations = getCoreApi()?.locations;
    if (!locations?.evaluate) return { passed: false, reasons: ["Morelord Core Location services are unavailable."] };
    const location = context.locationId ? locations.get(context.locationId) : {
      id: "road", name: "On the Road", settlementType: "road", sceneIds: [], capabilities: [], notes: "", metadata: { virtual: true }
    };
    const result = locations.evaluate(requirements, { ...context, location });
    return {
      ...result,
      reasons: result.results?.filter(entry => !entry.passed).map(entry => {
        if (entry.kind === "capability") return `Requires ${entry.requirement.tier ?? "common"} ${entry.requirement.type}.`;
        return "A Project requirement is not met.";
      }) ?? []
    };
  }
});
const allocationAuthority = new AllocationAuthorityService({
  segments,
  projects,
  sessions,
  isPrimaryGm: () => isPrimaryActiveGm(),
  getTraining: () => trainingApi,
  getCommission: () => commissionApi,
  getSourceItem: () => sourceItemApi,
  getResearch: () => researchApi
});

function isPrimaryActiveGm() {
  const activeGms = Array.from(globalThis.MorelordCore?.users?.list() ?? game.users ?? [])
    .filter(user => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id));
  return game.user.isGM && (!activeGms.length || activeGms[0].id === game.user.id);
}

function missingOptionalSuiteApis() {
  return [
    ["morelord-journeys", getModuleApi("morelord-journeys")?.travel],
    ["morelord-craftworks", getModuleApi("morelord-craftworks", "MorelordCraftworks")?.downtimeIntegration],
    ["morelord-marketplace", getModuleApi("morelord-marketplace", "MorelordMarketplace")?.shops]
  ].filter(([, value]) => !value).map(([id]) => id);
}

function reportOptionalSuiteApis({ attemptsRemaining = 40, intervalMs = 250 } = {}) {
  const missing = missingOptionalSuiteApis();
  if (!missing.length) {
    console.info(`${MODULE_ID} | Optional Morelord suite integrations are ready.`);
    return;
  }
  if (attemptsRemaining > 1) {
    setTimeout(() => reportOptionalSuiteApis({ attemptsRemaining: attemptsRemaining - 1, intervalMs }), intervalMs);
    return;
  }
  console.info(`${MODULE_ID} | Optional integrations unavailable: ${missing.join(", ")}.`);
}

Hooks.once("init", () => {
  repository.registerSetting();
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenTools = controls?.tokens?.tools;
  if (!tokenTools) return;
  tokenTools.morelordDowntime = {
    name: "morelordDowntime",
    title: "Morelord Downtime",
    icon: "fa-solid fa-timer",
    order: Object.keys(tokenTools).length,
    button: true,
    visible: true,
    onChange: () => {
      const api = globalThis.MorelordDowntime ?? game.modules.get(MODULE_ID)?.api;
      if (!api?.open) return ui.notifications.warn("Morelord Downtime is still initializing.");
      api.open();
    }
  };
});

Hooks.once("ready", () => {
  getCoreApi()?.ui?.documentation?.register(DOWNTIME_DOCUMENTATION);
  const coreLocations = () => getCoreLocations();
  activities.register({
    id: RESEARCH_ACTIVITY_ID,
    isAvailable: () => research.isAvailable(),
    name: "Research Drakkenheim Recipes",
    icon: "fa-solid fa-book-open",
    description: "Study a monster component from character or party inventory for one hour to find up to five random recipes that use it.",
    launch: () => new ResearchProjectApp().render({ force: true }),
    createProject: data => research.createProject(data, { idFactory: () => foundry.utils.randomID() }),
    canProgress: (project, context) => research.canProgress(project, context),
    onComplete: project => research.complete(project)
  });
  activities.register({
    id: TRAINING_ACTIVITY_ID,
    name: "Training",
    icon: "fa-solid fa-graduation-cap",
    description: "Learn a language or tool proficiency with a participant or provider instructor.",
    launch: () => new TrainingProjectApp().render({ force: true }),
    edit: project => new TrainingProjectApp({ projectId: project.id }).render({ force: true }),
    createProject: data => createTrainingProject(data, { idFactory: () => foundry.utils.randomID() }),
    canProgress: canProgressTraining,
    getSummary: trainingSummary,
    getRequirements: project => project.requirements ?? [],
    onComplete: async project => applyTrainingAwardResult(project, await trainingAwards.award(project))
  });
  activities.register({
    id: COMMISSION_ACTIVITY_ID,
    name: "Commission",
    icon: "fa-solid fa-handshake",
    description: "Track contracted work that advances as campaign days pass.",
    availableInSessions: false,
    launch: () => new CommissionProjectApp().render({ force: true }),
    edit: project => new CommissionProjectApp({ projectId: project.id }).render({ force: true }),
    createProject: data => createCommissionProject(data, { idFactory: () => foundry.utils.randomID() }),
    getSummary: commissionSummary
  });
  activities.register({
    id: SOURCE_ITEM_ACTIVITY_ID,
    name: "Source Item",
    icon: "fa-solid fa-magnifying-glass-dollar",
    description: "Invest gold and weeks to locate a magic item from a character's Marketplace wishlist.",
    availableInSessions: false,
    launch: () => new SourceItemProjectApp().render({ force: true }),
    edit: project => new SourceItemProjectApp({ projectId: project.id }).render({ force: true }),
    createProject: data => createSourceItemProject(data, { idFactory: () => foundry.utils.randomID() }),
    getSummary: sourceItemSummary,
    onComplete: project => sourceItemResolution.resolve(project)
  });
  activities.register({
    id: "crafting",
    name: "Crafting",
    icon: "fa-solid fa-hammer",
    description: "Open Morelord Craftworks and mark recipes for crafting to start a crafting Project. Marked recipes and active work appear in the Downtime Projects list.",
    actionLabel: "Open Craftworks",
    actionIcon: "fa-solid fa-arrow-up-right-from-square",
    launch: () => {
      const craftworks = getModuleApi("morelord-craftworks", "MorelordCraftworks");
      if (typeof craftworks?.openCraft !== "function") return ui.notifications.warn("Morelord Craftworks is unavailable.");
      return craftworks.openCraft();
    }
  });
  const training = Object.freeze({
    createProject: data => projects.create(createTrainingProject(data, { idFactory: () => foundry.utils.randomID() })),
    updateProject: async (id, data) => {
      const existing = await projects.get(id);
      if (!existing) throw new Error("Project not found.");
      return projects.update(id, createTrainingProject({
        ...existing,
        ...data,
        id: existing.id,
        status: existing.status,
        completedHours: existing.progress.effort.completedHours,
        metadata: existing.metadata
      }, { idFactory: () => existing.id }));
    },
    canProgress: canProgressTraining
  });
  trainingApi = training;
  const commission = Object.freeze({
    createProject: data => projects.create(createCommissionProject(data, { idFactory: () => foundry.utils.randomID() })),
    updateProject: async (id, data) => {
      const existing = await projects.get(id);
      if (!existing) throw new Error("Project not found.");
      return projects.update(id, createCommissionProject({
        ...existing,
        ...data,
        id: existing.id,
        status: existing.status,
        completedDays: existing.progress.elapsed.completedDays,
        metadata: existing.metadata
      }, { idFactory: () => existing.id }));
    }
  });
  commissionApi = commission;
  const sourceItem = Object.freeze({
    createProject: async data => {
      const target = await marketplaceSourcing.requireWishlistItem(data.owner?.uuid, data.target?.uuid);
      const input = createSourceItemProject({ ...data, target }, { idFactory: () => foundry.utils.randomID() });
      await marketplaceSourcing.spendInvestment(input.owner.uuid, input.metadata.sourceItem.investmentGp);
      try {
        return await projects.create(input);
      } catch (error) {
        await marketplaceSourcing.refundInvestment(input.owner.uuid, input.metadata.sourceItem.investmentGp);
        throw error;
      }
    },
    updateProject: async (id, data) => {
      const existing = await projects.get(id);
      if (!existing) throw new Error("Project not found.");
      if (existing.metadata?.sourceItem?.outcome) throw new Error("A resolved Source Item Project cannot be edited.");
      if (data.owner?.uuid !== existing.owner.uuid) throw new Error("A Source Item Project owner cannot be changed after investment begins.");
      if (data.target?.uuid !== existing.metadata.sourceItem.target.uuid) throw new Error("The requested item cannot be changed after investment begins.");
      const target = existing.metadata.sourceItem.target;
      const additionalInvestmentGp = Number(data.investmentGp) - Number(existing.metadata.sourceItem.investmentGp);
      if (additionalInvestmentGp < 0) throw new Error("Committed sourcing investment cannot be reduced.");
      if (Number(data.weeks) < Number(existing.metadata.sourceItem.weeks)) throw new Error("Committed sourcing time cannot be reduced.");
      const input = createSourceItemProject({
        ...existing,
        ...data,
        target,
        id: existing.id,
        status: existing.status,
        completedDays: existing.progress.elapsed.completedDays,
        metadata: existing.metadata
      }, { idFactory: () => existing.id });
      if (additionalInvestmentGp) await marketplaceSourcing.spendInvestment(existing.owner.uuid, additionalInvestmentGp);
      try {
        return await projects.update(id, input);
      } catch (error) {
        if (additionalInvestmentGp) await marketplaceSourcing.refundInvestment(existing.owner.uuid, additionalInvestmentGp);
        throw error;
      }
    },
    negotiate: async (id, roll) => {
      const existing = await projects.get(id);
      if (!existing || existing.activityType !== SOURCE_ITEM_ACTIVITY_ID) throw new Error("Source Item Project not found.");
      const negotiated = await sourceItemResolution.negotiate(existing, roll);
      return projects.update(id, { metadata: negotiated.metadata });
    }
  });
  sourceItemApi = sourceItem;
  allocationAuthority.start();
  DowntimeDashboardApp.configure({ projects, segments, sessions, allocationAuthority, locations: coreLocations, training, activities, craftworksProjects });
  TrainingProjectApp.configure({
    segments,
    allocationAuthority,
    projects,
    locations: coreLocations,
    proficiencies,
    training: {
      createProject: data => allocationAuthority.createTraining(data),
      updateProject: (id, data) => allocationAuthority.updateTraining(id, data)
    },
    onCreated: () => dashboardApp?.render({ force: true })
  });
  CommissionProjectApp.configure({
    segments,
    allocationAuthority,
    projects,
    locations: coreLocations,
    commission: {
      createProject: data => allocationAuthority.createCommission(data),
      updateProject: (id, data) => allocationAuthority.updateCommission(id, data)
    },
    onCreated: () => dashboardApp?.render({ force: true })
  });
  SourceItemProjectApp.configure({
    segments,
    allocationAuthority,
    projects,
    locations: coreLocations,
    catalog: marketplaceSourcing,
    sourceItem: {
      createProject: data => allocationAuthority.createSourceItem(data),
      updateProject: (id, data) => allocationAuthority.updateSourceItem(id, data)
    },
    onCreated: () => dashboardApp?.render({ force: true })
  });
  NewProjectApp.configure({ activities });
  ResearchProjectApp.configure({ research, allocationAuthority, onCreated: () => dashboardApp?.render({ force: true }) });
  SessionEditorApp.configure({
    sessions,
    activities,
    locations: coreLocations,
    onCreated: () => {
      return dashboardApp?.render({ force: true });
    }
  });
  SessionDetailApp.configure({ sessions, projects, segments, locations: coreLocations, activities });
  ProjectDetailApp.configure({ projects, segments, sessions, activities, locations: coreLocations, allocationAuthority });
  const open = async () => {
    if (!dashboardApp) dashboardApp = new DowntimeDashboardApp();
    return dashboardApp.render({ force: true });
  };
  const telemetry = globalThis.MorelordCore?.telemetry;
  telemetry?.windows(MODULE_ID, { "morelord-downtime-dashboard": "dashboard.opened", "morelord-downtime-create-training": "training.opened", "morelord-downtime-source-item": "sourcing.opened", "morelord-downtime-create-research": "research.opened" });
  telemetry?.observe(MODULE_ID, projects, { create: "project.create", collect: "project.collect", cancel: "project.cancel" });
  telemetry?.observe(MODULE_ID, sessions, { create: "session.create", start: "session.start", finalize: "session.finalize" });
  telemetry?.observe(MODULE_ID, segments, { allocate: "time.allocate" });
  const api = Object.freeze({
    open,
    registerActivity: definition => activities.register(definition),
    activities: Object.freeze({
      get: id => activities.get(id),
      list: () => activities.list(),
      createProject: async (id, data) => {
        const activity = activities.get(id);
        if (!activity) throw new Error(`Downtime activity '${id}' is not registered.`);
        if (typeof activity.createProject !== "function") throw new Error(`Downtime activity '${id}' uses its own Project workflow.`);
        return projects.create(await activity.createProject(data));
      }
    }),
    projects: Object.freeze({
      list: filters => projects.list(filters),
      get: id => projects.get(id),
      create: raw => projects.create(raw),
      update: (id, changes) => projects.update(id, changes),
      remove: id => projects.remove(id),
      removeUnused: id => projects.removeUnused(id),
      cancel: (id, options) => projects.cancel(id, options),
      applyEffort: (id, hours, options) => projects.applyEffort(id, hours, options)
    }),
    segments: Object.freeze({
      list: filters => segments.list(filters),
      get: id => segments.get(id),
      create: raw => segments.create(raw),
      remove: id => segments.remove(id),
      finalize: id => segments.finalize(id),
      evaluateAllocation: input => segments.evaluateAllocation(input),
      allocate: input => segments.allocate(input)
    }),
    sessions: Object.freeze({
      list: filters => sessions.list(filters),
      get: id => sessions.get(id),
      create: raw => sessions.create(raw),
      update: (id, changes) => sessions.update(id, changes),
      publish: id => sessions.publish(id),
      planProject: (id, projectId) => sessions.planProject(id, projectId),
      start: id => sessions.start(id),
      addSegment: (id, raw) => sessions.addSegment(id, raw),
      finalize: (id, options) => sessions.finalize(id, options),
      cancel: id => sessions.cancel(id),
      removeUnused: id => sessions.removeUnused(id)
    }),
    allocations: Object.freeze({ request: input => allocationAuthority.allocate(input) }),
    planning: Object.freeze({ planProject: (sessionId, projectId) => allocationAuthority.planProject(sessionId, projectId) }),
    cancellations: Object.freeze({ cancelProject: projectId => allocationAuthority.cancelProject(projectId) }),
    deletions: Object.freeze({ deleteProject: projectId => allocationAuthority.deleteProject(projectId) }),
    training: Object.freeze({ createProject: data => allocationAuthority.createTraining(data), canProgress: canProgressTraining }),
    research: Object.freeze({ createProject: data => allocationAuthority.createResearch(data) }),
    sourceItem: Object.freeze({
      createProject: data => allocationAuthority.createSourceItem(data),
      negotiate: projectId => allocationAuthority.negotiateSourceItem(projectId)
    }),
    advanceDay: context => projects.advanceDay(context),
    locations: Object.freeze({
      current: () => coreLocations()?.current?.() ?? null,
      evaluate: (requirements, context) => coreLocations()?.evaluate?.(requirements, context)
        ?? { passed: false, results: [], reason: "morelord-core-unavailable" },
      open: () => coreLocations()?.open?.()
    })
  });
  game.modules.get(MODULE_ID).api = api;
  globalThis.MorelordDowntime = api;
  // Other modules may perform asynchronous initialization in their own ready
  // listeners. Retry quietly before reporting a genuinely unavailable API.
  reportOptionalSuiteApis();
});

Hooks.on("morelordJourneys.dayComplete", async payload => {
  if (!isPrimaryActiveGm()) return;
  try {
    const result = await projects.advanceDay({
      idempotencyKey: payload.idempotencyKey,
      source: "journey",
      metadata: payload
    });
    Hooks.callAll("morelordDowntime.dayAdvanced", result);
  } catch (error) {
    console.error(`${MODULE_ID} | Could not process Journey day completion.`, error);
    ui.notifications.error(`Morelord Downtime could not advance the Journey day: ${error.message}`);
  }
});

Hooks.on("updateSetting", setting => {
  if (setting.key === `${MODULE_ID}.${STATE_SETTING}`) queueLiveWindowRefresh();
});
Hooks.on("morelordCoreLocationChanged", () => queueLiveWindowRefresh());
Hooks.on("morelordCoreLocationRemoved", () => queueLiveWindowRefresh());
Hooks.on("updateActor", (actor, changes) => {
  if (changes.flags?.["morelord-craftworks"]) queueLiveWindowRefresh();
});
