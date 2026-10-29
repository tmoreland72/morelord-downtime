import { MODULE_ID } from "../constants.mjs";
import { recordSpentHours, remainingHours } from "../domain/segment.mjs";

const integrationReady = integration => typeof integration?.listProjects === "function"
  && typeof integration?.getProject === "function";

function sameLedger(left = {}, right = {}) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && Number(left[key]) === Number(right[key]));
}

function participant(segment, actorUuid) {
  return segment.participants.find(entry => entry.actorUuid === actorUuid);
}

/**
 * Apply Craftworks' published hours spent to the active Downtime Session.
 * The first successful observation baselines existing jobs and does not charge them.
 */
export class CraftTimeService {
  constructor({
    repository,
    getIntegration = () => null,
    readProjects = null,
    getActors = () => [],
    isPrimaryGm = () => true,
    now = () => Date.now(),
    notify = null
  } = {}) {
    this.repository = repository;
    this.getIntegration = getIntegration;
    this.readProjects = readProjects;
    this.getActors = getActors;
    this.isPrimaryGm = isPrimaryGm;
    this.now = now;
    this.notify = notify;
    this.#tail = Promise.resolve();
    this.#baselineTask = null;
    this.#releaseBaseline = null;
  }

  #tail;
  #baselineTask;
  #releaseBaseline;

  #enqueue(task) {
    const run = this.#tail.then(task, task);
    this.#tail = run.then(() => {}, () => {});
    return run;
  }

  #mayWrite() {
    try {
      return this.isPrimaryGm() === true;
    } catch (error) {
      console.error(`${MODULE_ID} | Could not determine the primary GM for crafting time.`, error);
      return false;
    }
  }

  /** Reconcile waits until the ready-time baseline finishes. */
  holdForBaseline() {
    if (!this.#baselineTask) {
      this.#baselineTask = new Promise(resolve => { this.#releaseBaseline = resolve; });
    }
    return this.#baselineTask;
  }

  baseline(actors = this.getActors()) {
    return this.#enqueue(() => this.#baseline(actors));
  }

  baselineWhenReady({ attemptsRemaining = 40, intervalMs = 250 } = {}) {
    return this.#retryBaseline({ attemptsRemaining, intervalMs }).finally(() => {
      this.#releaseBaseline?.();
      this.#releaseBaseline = null;
      this.#baselineTask = null;
    });
  }

  async #retryBaseline({ attemptsRemaining, intervalMs }) {
    const result = await this.baseline(this.getActors());
    if (result?.reason === "craftworks-unavailable" && attemptsRemaining > 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      return this.#retryBaseline({ attemptsRemaining: attemptsRemaining - 1, intervalMs });
    }
    return result;
  }

  async reconcileActor(actor) {
    if (this.#baselineTask) await this.#baselineTask;
    return this.#enqueue(() => this.#reconcileActor(actor));
  }

  /** Allocate hours already spent on a session activity. Past time is not applied later. */
  recordHours({ actor, activityId, hours, label, projectId }) {
    return this.#enqueue(() => this.#recordHours({ actor, activityId, hours, label, projectId }));
  }

  async #recordHours({ actor, activityId, hours, label, projectId }) {
    if (globalThis.game?.user && game.user.isGM !== true) return { recorded: false, hours: 0, reason: "not-gm" };
    const spent = Number(hours);
    if (actor?.type !== "character" || !actor.uuid || !activityId || !Number.isFinite(spent) || spent <= 0) {
      return { recorded: false, hours: 0, reason: "invalid" };
    }
    const state = await this.repository.read();
    const charged = this.#charge(state, actor, [{
      recipeId: String(projectId ?? activityId),
      recipeName: label || "a project",
      projectId: String(projectId ?? activityId),
      hours: spent
    }], { activityId: String(activityId) });
    if (charged.hours > 0) {
      await this.repository.write(state);
      this.#notify(charged.notes);
    }
    return {
      recorded: charged.hours > 0,
      hours: charged.hours,
      notes: charged.notes,
      reason: charged.hours > 0 ? "recorded" : "unchanged"
    };
  }

  #capture(actors) {
    if (typeof this.readProjects !== "function") return null;
    const captured = new Map();
    for (const actor of actors ?? []) {
      if (actor?.type !== "character" || !actor.uuid) continue;
      try {
        const projects = this.readProjects(actor);
        if (Array.isArray(projects)) captured.set(actor.uuid, projects);
      } catch (error) {
        console.error(`${MODULE_ID} | Could not read Craftworks progress for ${actor.uuid}.`, error);
      }
    }
    return captured;
  }

  async #baseline(actors) {
    if (!this.#mayWrite()) return { recorded: false, hours: 0, reason: "not-primary-gm" };
    const integration = this.getIntegration();
    if (!integrationReady(integration) && typeof this.readProjects !== "function") {
      return { recorded: false, hours: 0, reason: "craftworks-unavailable" };
    }
    // Snapshot before the settings read so a crafting check during that await stays a later delta.
    const captured = this.#capture(actors);
    if (!integrationReady(integration) && !captured?.size) {
      return { recorded: false, hours: 0, reason: "craftworks-unavailable" };
    }
    const state = await this.repository.read();
    const chargeNew = state.craftTimeLedgerInitialized === true;
    const notes = [];
    let hours = 0;
    let changed = state.craftTimeLedgerInitialized !== true;
    let unreadable = false;
    for (const actor of actors ?? []) {
      const result = await this.#applyActor(state, actor, integration, { chargeNew, projects: captured?.get(actor.uuid) });
      hours += result.hours;
      notes.push(...result.notes);
      changed = changed || result.changed;
      unreadable = unreadable || result.unreadable === true;
    }
    if (unreadable && !chargeNew) return { recorded: false, hours: 0, reason: "craftworks-unavailable" };
    state.craftTimeLedgerInitialized = true;
    if (changed || hours > 0) await this.repository.write(state);
    if (hours > 0) this.#notify(notes);
    return { recorded: hours > 0, hours, notes, reason: chargeNew ? "reconciled" : "baselined" };
  }

  async #reconcileActor(actor) {
    if (!this.#mayWrite()) return { recorded: false, hours: 0, reason: "not-primary-gm" };
    if (actor?.type !== "character" || !actor.uuid) return { recorded: false, hours: 0, reason: "not-character" };
    const integration = this.getIntegration();
    if (!integrationReady(integration)) return { recorded: false, hours: 0, reason: "craftworks-unavailable" };
    const state = await this.repository.read();
    if (state.craftTimeLedgerInitialized !== true) {
      let unreadable = false;
      for (const candidate of this.getActors()) {
        const result = await this.#applyActor(state, candidate, integration, { chargeNew: false });
        unreadable = unreadable || result.unreadable === true;
      }
      const current = await this.#applyActor(state, actor, integration, { chargeNew: false });
      if (unreadable || current.unreadable) return { recorded: false, hours: 0, reason: "craftworks-unavailable" };
      state.craftTimeLedgerInitialized = true;
      await this.repository.write(state);
      return { recorded: false, hours: 0, reason: "baselined" };
    }
    const result = await this.#applyActor(state, actor, integration, { chargeNew: true });
    if (result.changed || result.hours > 0) await this.repository.write(state);
    if (result.hours > 0) this.#notify(result.notes);
    return { recorded: result.hours > 0, hours: result.hours, notes: result.notes, reason: result.hours > 0 ? "recorded" : "unchanged" };
  }

  async #projectsFor(actor, integration, preset) {
    if (Array.isArray(preset)) {
      return preset.map(project => ({
        recipeId: String(project?.recipeId ?? ""),
        timeSpentHours: Number(project?.timeSpentHours ?? 0),
        recipeName: project?.recipeName || null,
        outputAwarded: project?.outputAwarded === true
      })).filter(project => project.recipeId);
    }
    if (!integrationReady(integration)) return null;
    const jobs = await integration.listProjects({ crafterUuid: actor.uuid, activeOnly: false }) ?? [];
    const projects = [];
    for (const job of jobs) {
      const recipeId = String(job?.recipeId ?? "").trim();
      if (!recipeId) continue;
      const progress = await integration.getProject({
        recipeId,
        crafterUuid: actor.uuid,
        inventoryActorUuid: job.inventoryActorUuid ?? null
      });
      if (!progress) {
        projects.push({ recipeId, timeSpentHours: null, recipeName: null });
        continue;
      }
      const timeSpentHours = Number(progress.timeSpentHours ?? 0);
      projects.push({
        recipeId,
        timeSpentHours: Number.isFinite(timeSpentHours) ? Math.max(0, timeSpentHours) : 0,
        recipeName: null,
        outputAwarded: progress.outputAwarded === true
      });
    }
    return projects;
  }

  async #applyActor(state, actor, integration, { chargeNew, projects: preset = undefined }) {
    if (actor?.type !== "character" || !actor.uuid) return { hours: 0, changed: false, notes: [] };
    let listed = [];
    try {
      const projects = await this.#projectsFor(actor, integration, preset);
      if (!projects) return { hours: 0, changed: false, notes: [], unreadable: true };
      listed = projects;
    } catch (error) {
      console.error(`${MODULE_ID} | Could not read Craftworks projects for ${actor.uuid}.`, error);
      return { hours: 0, changed: false, notes: [], unreadable: true };
    }
    const previousLedger = state.craftTimeLedger[actor.uuid] ?? {};
    const nextLedger = {};
    const charges = [];
    let unreadable = false;
    for (const project of listed) {
      const recipeId = project.recipeId;
      const seen = Object.prototype.hasOwnProperty.call(previousLedger, recipeId);
      const previous = seen ? Number(previousLedger[recipeId]) : null;
      if (project.timeSpentHours == null) {
        if (previous != null) nextLedger[recipeId] = previous;
        else unreadable = true;
        continue;
      }
      const timeSpentHours = project.timeSpentHours;
      nextLedger[recipeId] = timeSpentHours;
      let delta = 0;
      // Open work seen for the first time counts, including hours already spent
      // when Downtime starts during an active Session. Awarded jobs are remembered
      // without charging this Session for work finished earlier.
      if (previous == null) {
        if (timeSpentHours > 0 && project.outputAwarded !== true) delta = timeSpentHours;
      } else if (timeSpentHours > previous) delta = timeSpentHours - previous;
      if (delta > 0) {
        charges.push({
          recipeId,
          recipeName: project.recipeName || this.#recipeName(integration, recipeId),
          hours: delta
        });
      }
    }
    const changed = !sameLedger(previousLedger, nextLedger);
    if (Object.keys(nextLedger).length) state.craftTimeLedger[actor.uuid] = nextLedger;
    else delete state.craftTimeLedger[actor.uuid];
    if (unreadable && chargeNew === false) return { hours: 0, changed: false, notes: [], unreadable: true };
    if (!charges.length) return { hours: 0, changed, notes: [], unreadable };
    const charged = this.#charge(state, actor, charges, { activityId: "crafting" });
    return { hours: charged.hours, changed: true, notes: charged.notes, unreadable };
  }

  #recipeName(integration, recipeId) {
    try {
      const recipe = integration.getRecipe?.(recipeId);
      if (recipe?.name) return String(recipe.name);
    } catch (error) {
      console.error(`${MODULE_ID} | Could not read Craftworks recipe ${recipeId}.`, error);
    }
    return "a recipe";
  }

  #charge(state, actor, charges, { activityId = "crafting" } = {}) {
    const session = Object.values(state.sessions).find(entry => entry.status === "active") ?? null;
    if (!session) return { hours: 0, notes: [] };
    if (!session.availableActivities?.includes(activityId)) return { hours: 0, notes: [] };
    const candidates = session.segmentIds
      .map(id => state.segments[id])
      .filter(segment => segment?.status === "open" && participant(segment, actor.uuid));
    if (!candidates.length) return { hours: 0, notes: [] };
    candidates.sort((left, right) => remainingHours(participant(right, actor.uuid)) - remainingHours(participant(left, actor.uuid)));
    let segment = candidates[0];
    const notes = [];
    let hours = 0;
    for (const charge of charges) {
      const result = recordSpentHours(segment, {
        actorUuid: actor.uuid,
        hours: charge.hours,
        projectId: charge.projectId ?? `craftworks:${actor.id ?? actor.uuid}:${charge.recipeId}`,
        at: this.now(),
        recipeId: charge.recipeId,
        recipeName: charge.recipeName
      });
      segment = result.segment;
      hours += charge.hours;
      const crafting = activityId === "crafting";
      notes.push({
        actorName: actor.name ?? "A character",
        hours: charge.hours,
        recipeName: charge.recipeName,
        activityId,
        exceeded: result.exceeded
      });
      session.history.push({
        at: this.now(),
        type: crafting ? "craft-time" : "session-time",
        data: crafting
          ? {
            actorUuid: actor.uuid,
            actorName: actor.name ?? null,
            hours: charge.hours,
            recipeId: charge.recipeId,
            recipeName: charge.recipeName
          }
          : {
            actorUuid: actor.uuid,
            actorName: actor.name ?? null,
            hours: charge.hours,
            activityId,
            label: charge.recipeName
          }
      });
    }
    state.segments[segment.id] = segment;
    state.sessions[session.id] = session;
    return { hours, notes };
  }

  #notify(notes) {
    if (!notes?.length) return;
    const summary = notes.map(note => {
      const unit = note.hours === 1 ? "hour" : "hours";
      const action = note.activityId === "source-item" ? "sourcing"
        : note.activityId === "commission" ? "commissioning"
          : "crafting";
      return `${note.actorName} spent ${note.hours} ${unit} ${action} ${note.recipeName}.`;
    }).join(" ");
    const over = notes.some(note => note.exceeded)
      ? " It is more time than that character had remaining."
      : "";
    const message = `${summary} That time was added to the active Downtime Session.${over}`;
    if (this.notify) this.notify(message);
    else globalThis.ui?.notifications?.info?.(message);
  }
}
