import { advanceElapsedDay, appendHistory, applyEffort, createProject } from "../domain/project.mjs";
import { recordSpentDays, recordSpentHours, releaseProjectHours } from "../domain/segment.mjs";
import { LABOR_DAY_HOURS } from "../domain/labor-time.mjs";
import { SOURCE_ITEM_ACTIVITY_ID } from "../activities/source-item/source-item-activity.mjs";
import { elapsedDayApplies, xgePolicy } from "../activities/xge/xge-rules.mjs";
import { activatePresenceFocus, normalizePresenceFocus } from "../domain/presence-focus.mjs";

function releaseTrainingHours(state, projectId) {
  for (const segment of Object.values(state.segments ?? {})) {
    const released = releaseProjectHours(segment, projectId);
    state.segments[segment.id] = released;
  }
}

export class ProjectService {
  constructor({ repository, activityRegistry = null, idFactory = null, now = () => Date.now() }) {
    this.repository = repository;
    this.activityRegistry = activityRegistry;
    this.idFactory = idFactory;
    this.now = now;
  }

  #requireGm() {
    if (globalThis.game && !game.user?.isGM) throw new Error("Only a GM may modify Downtime Project state.");
  }

  async list({ ownerUuid = null, status = null, activityType = null } = {}) {
    const state = await this.repository.read();
    return Object.values(state.projects)
      .filter(project => !ownerUuid || project.owner.uuid === ownerUuid)
      .filter(project => !status || project.status === status)
      .filter(project => !activityType || project.activityType === activityType)
      .map(project => structuredClone(project));
  }

  async get(id) {
    const state = await this.repository.read();
    return state.projects[String(id)] ? structuredClone(state.projects[String(id)]) : null;
  }

  async create(raw) {
    this.#requireGm();
    const state = await this.repository.read();
    const project = createProject(raw, {
      idFactory: this.idFactory ?? (() => foundry.utils.randomID()),
      now: this.now
    });
    if (state.projects[project.id]) throw new Error(`Project '${project.id}' already exists.`);
    state.projects[project.id] = project;
    normalizePresenceFocus(state.projects, { now: this.now() });
    await this.repository.write(state);
    return structuredClone(state.projects[project.id]);
  }

  async setPresenceFocus(id) {
    this.#requireGm();
    const state = await this.repository.read();
    if (!state.projects[String(id)]) throw new Error("Project not found.");
    activatePresenceFocus(state.projects, id, this.now());
    await this.repository.write(state);
    return structuredClone(state.projects[String(id)]);
  }

  async commit(project) {
    this.#requireGm();
    const state = await this.repository.read();
    if (!state.projects[String(project?.id)]) throw new Error("Project not found.");
    state.projects[project.id] = structuredClone(project);
    await this.repository.write(state);
    return structuredClone(state.projects[project.id]);
  }

  async update(id, changes = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.projects[String(id)];
    if (!existing) throw new Error("Project not found.");
    const incoming = structuredClone(changes);
    const project = createProject({
      ...existing,
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
      owner: { ...existing.owner, ...(incoming.owner ?? {}) },
      progress: {
        ...existing.progress,
        ...(incoming.progress ?? {}),
        effort: { ...existing.progress.effort, ...(incoming.progress?.effort ?? {}) },
        elapsed: { ...existing.progress.elapsed, ...(incoming.progress?.elapsed ?? {}) }
      },
      metadata: { ...existing.metadata, ...(incoming.metadata ?? {}) },
      history: existing.history
    }, { now: this.now });
    appendHistory(project, "updated", { fields: Object.keys(changes) }, this.now());
    state.projects[project.id] = project;
    await this.repository.write(state);
    return structuredClone(project);
  }

  async remove(id) {
    this.#requireGm();
    const state = await this.repository.read();
    if (!state.projects[String(id)]) return false;
    delete state.projects[String(id)];
    await this.repository.write(state);
    return true;
  }

  async removeUnused(id, { allowCancelled = false } = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const project = state.projects[String(id)];
    if (!project) return false;
    const hasProgress = project.progress.effort.completedHours > 0
      || project.progress.elapsed.completedDays > 0
      || project.participants.some(participant => participant.hoursContributed > 0)
      || Object.values(state.segments).some(segment => segment.allocations.some(allocation => allocation.projectId === project.id))
      || project.history.some(entry => !["created", "updated", "cancelled"].includes(entry.type));
    if (hasProgress && !(allowCancelled && project.status === "cancelled")) throw new Error("A Project with recorded progress must be cancelled before it can be deleted.");
    if (project.activityType === "training") releaseTrainingHours(state, project.id);
    delete state.projects[project.id];
    for (const session of Object.values(state.sessions)) {
      session.plannedProjectIds = (session.plannedProjectIds ?? []).filter(projectId => projectId !== project.id);
    }
    await this.repository.write(state);
    return true;
  }

  async cancel(id, { reason = null } = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const project = state.projects[String(id)];
    if (!project) throw new Error("Project not found.");
    if (["completed", "awaiting-collection", "cancelled", "failed"].includes(project.status)) throw new Error("Project cannot be cancelled in its current status.");
    if (project.activityType === "training") releaseTrainingHours(state, project.id);
    project.status = "cancelled";
    appendHistory(project, "cancelled", { reason: reason ? String(reason) : null }, this.now());
    state.projects[project.id] = project;
    await this.repository.write(state);
    return structuredClone(project);
  }

  async collect(id) {
    this.#requireGm();
    const state = await this.repository.read();
    const project = state.projects[String(id)];
    if (!project) throw new Error("Project not found.");
    if (project.status !== "awaiting-collection") throw new Error("This Project is not awaiting collection.");
    project.status = "completed";
    appendHistory(project, "collected", { locationId: project.collectionLocationId }, this.now());
    state.projects[project.id] = project;
    await this.repository.write(state);
    return structuredClone(project);
  }

  async applyEffort(id, hours, options = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.projects[String(id)];
    if (!existing) throw new Error("Project not found.");
    let project = applyEffort(existing, hours, { ...options, at: this.now() });
    if (existing.status !== project.status && ["completed", "awaiting-collection"].includes(project.status)) {
      const activity = this.activityRegistry?.get(project.activityType);
      if (activity?.onComplete) project = await activity.onComplete(project) ?? project;
    }
    state.projects[project.id] = project;
    await this.repository.write(state);
    return structuredClone(project);
  }

  async advanceDay({ idempotencyKey, source = "manual", metadata = {} } = {}) {
    this.#requireGm();
    const dayKey = String(idempotencyKey ?? "").trim();
    if (!dayKey) throw new Error("Day advancement requires an idempotency key.");
    const state = await this.repository.read();
    if (state.consumedDayKeys.includes(dayKey)) {
      return { advanced: false, duplicate: true, idempotencyKey: dayKey, projects: [] };
    }
    const activeSession = Object.values(state.sessions).find(session => session?.status === "active") ?? null;
    const dayLimit = activeSession?.days;
    const hasDayBudget = activeSession && dayLimit != null && dayLimit !== "" && Number.isInteger(Number(dayLimit)) && Number(dayLimit) >= 1;
    const sessionDaysBlocked = Boolean(hasDayBudget && Number(activeSession.daysUsed ?? 0) >= Number(dayLimit));
    if (hasDayBudget && !sessionDaysBlocked) activeSession.daysUsed = Number(activeSession.daysUsed ?? 0) + 1;
    const hoursBefore = sessionDayBaselines(state, activeSession, sessionDaysBlocked);
    const changed = [];
    for (const [id, existing] of Object.entries(state.projects)) {
      if (!elapsedDayApplies(existing, { session: activeSession, sessionDaysBlocked })) continue;
      let project = advanceElapsedDay(existing, { dayKey, at: this.now() });
      if (existing.status !== project.status && ["completed", "awaiting-collection"].includes(project.status)) {
        const activity = this.activityRegistry?.get(project.activityType);
        if (activity?.onComplete) project = await activity.onComplete(project) ?? project;
      }
      state.projects[id] = project;
      const daysApplied = project.progress.elapsed.completedDays - existing.progress.elapsed.completedDays;
      if (daysApplied > 0) chargeSourceItemSessionTime(state, project, daysApplied, activeSession, this.now());
      if (daysApplied > 0 && xgePolicy(project.activityType) === "present") notePresenceDay(state, project, activeSession, this.now());
      if (daysApplied > 0 || project.status !== existing.status) {
        const copy = structuredClone(project);
        if (daysApplied > 0) copy.elapsedDaysApplied = daysApplied;
        changed.push(copy);
      }
    }
    if (hoursBefore) chargeAdvanceDayHours(state, hoursBefore, this.now(), dayKey);
    if (sessionDaysBlocked && !changed.some(project => xgePolicy(project.activityType) === "away")) {
      throw new Error("This Session has used all of its days. Hour-based work can continue until the Session is finalized.");
    }
    state.consumedDayKeys.push(dayKey);
    if (state.consumedDayKeys.length > 1000) state.consumedDayKeys = state.consumedDayKeys.slice(-1000);
    await this.repository.write(state);
    return { advanced: true, duplicate: false, idempotencyKey: dayKey, source, metadata: structuredClone(metadata), projects: changed };
  }
}

/** A Source Item day spends up to 8 Session hours. That spend counts as the Advance Day charge. */
function chargeSourceItemSessionTime(state, project, daysApplied, activeSession, at) {
  if (project.activityType !== SOURCE_ITEM_ACTIVITY_ID || !activeSession) return;
  if (!activeSession.availableActivities?.includes(SOURCE_ITEM_ACTIVITY_ID)) return;
  const actorUuid = project.owner?.uuid;
  if (!actorUuid) return;
  const segment = (activeSession.segmentIds ?? [])
    .map(id => state.segments[id])
    .find(entry => entry?.status === "open" && entry.participants.some(participant => participant.actorUuid === actorUuid));
  if (!segment) return;
  const participant = segment.participants.find(entry => entry.actorUuid === actorUuid);
  const remaining = Math.max(0, Number(participant.availableHours) - Number(participant.allocatedHours));
  const take = Math.min(daysApplied * LABOR_DAY_HOURS, remaining);
  if (take <= 0) return;
  const result = recordSpentHours(segment, {
    actorUuid,
    hours: take,
    projectId: project.id,
    at,
    sourceName: "source-item",
    recipeName: project.metadata?.sourceItem?.target?.name ?? project.name,
    activityId: SOURCE_ITEM_ACTIVITY_ID,
    days: daysApplied
  });
  state.segments[result.segment.id] = result.segment;
}

function sessionDayBaselines(state, activeSession, sessionDaysBlocked) {
  if (!activeSession || sessionDaysBlocked) return null;
  const baselines = new Map();
  for (const segmentId of activeSession.segmentIds ?? []) {
    const segment = state.segments[segmentId];
    if (segment?.status !== "open") continue;
    baselines.set(segmentId, {
      count: segment.allocations.length,
      hours: new Map(segment.participants.map(participant => [participant.actorUuid, Number(participant.allocatedHours) || 0]))
    });
  }
  return baselines.size ? baselines : null;
}

/** One advanced day spends 8 Session hours for every participant, and never drops remaining time below 0. */
function chargeAdvanceDayHours(state, baselines, at, dayKey) {
  const seen = new Set();
  for (const [segmentId, baseline] of baselines) {
    let segment = state.segments[segmentId];
    if (!segment) continue;
    for (const [actorUuid, previousHours] of baseline.hours) {
      if (seen.has(actorUuid)) continue;
      seen.add(actorUuid);
      const participant = segment.participants.find(entry => entry.actorUuid === actorUuid);
      if (!participant) continue;
      const added = Math.max(0, Number(participant.allocatedHours) - previousHours);
      const counted = Math.min(LABOR_DAY_HOURS, added);
      const remaining = Math.max(0, Number(participant.availableHours) - Number(participant.allocatedHours));
      const take = Math.min(LABOR_DAY_HOURS - counted, remaining);
      const covered = counted + take;
      const note = covered < LABOR_DAY_HOURS ? dayShortfallNote(covered) : null;
      if (take > 0) {
        const result = recordSpentHours(segment, {
          actorUuid,
          hours: take,
          projectId: `advance-day:${dayKey}`,
          at,
          sourceName: "advance-day",
          recipeName: "Advance Day"
        });
        if (note) result.allocation.note = note;
        segment = result.segment;
        state.segments[segment.id] = segment;
      } else if (note && added > 0) {
        const allocation = [...segment.allocations].slice(baseline.count).reverse().find(entry =>
          (entry.participantActorUuids ?? []).includes(actorUuid) && Number(entry.hours) > 0);
        if (allocation) allocation.note = note;
      } else if (note) {
        segment.allocations.push({
          id: `${segment.id}:${segment.allocations.length + 1}`,
          projectId: `advance-day:${dayKey}`,
          participantActorUuids: [actorUuid],
          hours: 0,
          createdAt: at,
          source: "advance-day",
          recipeId: null,
          recipeName: "Advance Day",
          activityId: null,
          days: null,
          note
        });
        state.segments[segment.id] = segment;
      }
    }
  }
}

function dayShortfallNote(covered) {
  if (covered <= 0) return "No hours remained, so this day took none of the 8.";
  const amount = formatDayHours(covered);
  return `Only ${amount} remained, so this day took ${amount} instead of 8.`;
}

function formatDayHours(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text} ${rounded === 1 ? "hour" : "hours"}`;
}

function notePresenceDay(state, project, activeSession, at) {
  if (!activeSession) return;
  const actorUuid = project.owner?.uuid;
  if (!actorUuid) return;
  const segment = (activeSession.segmentIds ?? [])
    .map(id => state.segments[id])
    .find(entry => entry?.status === "open" && entry.participants.some(participant => participant.actorUuid === actorUuid));
  if (!segment) return;
  const result = recordSpentDays(segment, {
    actorUuid,
    days: 1,
    projectId: project.id,
    at,
    activityId: project.activityType
  });
  state.segments[result.segment.id] = result.segment;
}
