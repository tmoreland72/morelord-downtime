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
    getActors = () => [],
    isPrimaryGm = () => true,
    now = () => Date.now(),
    notify = null
  } = {}) {
    this.repository = repository;
    this.getIntegration = getIntegration;
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

  async #baseline(actors) {
    if (!this.#mayWrite()) return { recorded: false, hours: 0, reason: "not-primary-gm" };
    const integration = this.getIntegration();
    if (!integrationReady(integration)) return { recorded: false, hours: 0, reason: "craftworks-unavailable" };
    const state = await this.repository.read();
    const chargeNew = state.craftTimeLedgerInitialized === true;
    const notes = [];
    let hours = 0;
    let changed = state.craftTimeLedgerInitialized !== true;
    let unreadable = false;
    for (const actor of actors ?? []) {
      const result = await this.#applyActor(state, actor, integration, { chargeNew });
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

  async #applyActor(state, actor, integration, { chargeNew }) {
    if (actor?.type !== "character" || !actor.uuid) return { hours: 0, changed: false, notes: [] };
    let jobs = [];
    try {
      jobs = await integration.listProjects({ crafterUuid: actor.uuid, activeOnly: false }) ?? [];
    } catch (error) {
      console.error(`${MODULE_ID} | Could not read Craftworks projects for ${actor.uuid}.`, error);
      return { hours: 0, changed: false, notes: [], unreadable: true };
    }
    const previousLedger = state.craftTimeLedger[actor.uuid] ?? {};
    const nextLedger = {};
    const charges = [];
    let unreadable = false;
    for (const job of jobs) {
      const recipeId = String(job?.recipeId ?? "").trim();
      if (!recipeId) continue;
      const seen = Object.prototype.hasOwnProperty.call(previousLedger, recipeId);
      const previous = seen ? Number(previousLedger[recipeId]) : null;
      let timeSpentHours;
      try {
        const progress = await integration.getProject({
          recipeId,
          crafterUuid: actor.uuid,
          inventoryActorUuid: job.inventoryActorUuid ?? null
        });
        if (!progress) {
          if (previous != null) nextLedger[recipeId] = previous;
          else unreadable = true;
          continue;
        }
        timeSpentHours = Number(progress.timeSpentHours ?? 0);
        if (!Number.isFinite(timeSpentHours) || timeSpentHours < 0) timeSpentHours = 0;
      } catch (error) {
        console.error(`${MODULE_ID} | Could not read Craftworks progress for ${recipeId}.`, error);
        if (previous != null) nextLedger[recipeId] = previous;
        else unreadable = true;
        continue;
      }
      nextLedger[recipeId] = timeSpentHours;
      let delta = 0;
      if (previous == null) {
        if (chargeNew && timeSpentHours > 0) delta = timeSpentHours;
      } else if (timeSpentHours > previous) delta = timeSpentHours - previous;
      if (delta > 0) charges.push({ recipeId, recipeName: this.#recipeName(integration, recipeId), hours: delta });
    }
    const changed = !sameLedger(previousLedger, nextLedger);
    if (Object.keys(nextLedger).length) state.craftTimeLedger[actor.uuid] = nextLedger;
    else delete state.craftTimeLedger[actor.uuid];
    if (unreadable && chargeNew === false) return { hours: 0, changed: false, notes: [], unreadable: true };
    if (!charges.length) return { hours: 0, changed, notes: [], unreadable };
    const charged = this.#charge(state, actor, charges);
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

  #charge(state, actor, charges) {
    const session = Object.values(state.sessions).find(entry => entry.status === "active") ?? null;
    if (!session) return { hours: 0, notes: [] };
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
        projectId: `craftworks:${actor.id ?? actor.uuid}:${charge.recipeId}`,
        at: this.now(),
        recipeId: charge.recipeId,
        recipeName: charge.recipeName
      });
      segment = result.segment;
      hours += charge.hours;
      notes.push({
        actorName: actor.name ?? "A character",
        hours: charge.hours,
        recipeName: charge.recipeName,
        exceeded: result.exceeded
      });
      session.history.push({
        at: this.now(),
        type: "craft-time",
        data: {
          actorUuid: actor.uuid,
          actorName: actor.name ?? null,
          hours: charge.hours,
          recipeId: charge.recipeId,
          recipeName: charge.recipeName
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
      return `${note.actorName} spent ${note.hours} ${unit} crafting ${note.recipeName}.`;
    }).join(" ");
    const over = notes.some(note => note.exceeded)
      ? " It is more time than that character had remaining."
      : "";
    const message = `${summary} That time was added to the active Downtime Session.${over}`;
    if (this.notify) this.notify(message);
    else globalThis.ui?.notifications?.info?.(message);
  }
}
