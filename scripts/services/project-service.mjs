import { advanceElapsedDay, appendHistory, applyEffort, createProject } from "../domain/project.mjs";

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
    await this.repository.write(state);
    return structuredClone(project);
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

  async removeUnused(id) {
    this.#requireGm();
    const state = await this.repository.read();
    const project = state.projects[String(id)];
    if (!project) return false;
    const hasProgress = project.progress.effort.completedHours > 0
      || project.progress.elapsed.completedDays > 0
      || project.participants.some(participant => participant.hoursContributed > 0)
      || Object.values(state.segments).some(segment => segment.allocations.some(allocation => allocation.projectId === project.id))
      || project.history.some(entry => !["created", "updated", "cancelled"].includes(entry.type));
    if (hasProgress) throw new Error("A Project with recorded progress cannot be deleted. Cancel it to preserve its history.");
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
    const changed = [];
    for (const [id, existing] of Object.entries(state.projects)) {
      let project = advanceElapsedDay(existing, { dayKey, at: this.now() });
      if (existing.status !== project.status && ["completed", "awaiting-collection"].includes(project.status)) {
        const activity = this.activityRegistry?.get(project.activityType);
        if (activity?.onComplete) project = await activity.onComplete(project) ?? project;
      }
      state.projects[id] = project;
      if (project.progress.elapsed.completedDays !== existing.progress.elapsed.completedDays || project.status !== existing.status) changed.push(structuredClone(project));
    }
    state.consumedDayKeys.push(dayKey);
    if (state.consumedDayKeys.length > 1000) state.consumedDayKeys = state.consumedDayKeys.slice(-1000);
    await this.repository.write(state);
    return { advanced: true, duplicate: false, idempotencyKey: dayKey, source, metadata: structuredClone(metadata), projects: changed };
  }
}
