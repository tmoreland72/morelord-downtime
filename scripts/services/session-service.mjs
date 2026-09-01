import { createSegment, remainingHours } from "../domain/segment.mjs";
import { createSession, transitionSession } from "../domain/session.mjs";

export class SessionService {
  constructor({ repository, idFactory = null, segmentIdFactory = null, now = () => Date.now() }) {
    this.repository = repository;
    this.idFactory = idFactory;
    this.segmentIdFactory = segmentIdFactory;
    this.now = now;
  }
  #requireGm() { if (globalThis.game && !game.user?.isGM) throw new Error("Only a GM may modify Downtime Sessions."); }
  async list({ status = null, participantActorUuid = null } = {}) {
    const state = await this.repository.read();
    return Object.values(state.sessions)
      .filter(session => !status || session.status === status)
      .filter(session => !participantActorUuid || session.participants.some(entry => entry.actorUuid === participantActorUuid))
      .map(value => structuredClone(value));
  }
  async get(id) { const state = await this.repository.read(); return state.sessions[String(id)] ? structuredClone(state.sessions[String(id)]) : null; }
  async create(raw) {
    this.#requireGm();
    const state = await this.repository.read();
    const session = createSession(raw, { idFactory: this.idFactory ?? (() => foundry.utils.randomID()), now: this.now });
    state.sessions[session.id] = session;
    await this.repository.write(state);
    return structuredClone(session);
  }
  async update(id, changes = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.sessions[String(id)];
    if (!existing) throw new Error("Session not found.");
    if (!["draft", "upcoming", "active"].includes(existing.status)) throw new Error("Only open Sessions can be edited.");
    const session = createSession({
      ...existing,
      ...structuredClone(changes),
      id: existing.id,
      status: existing.status,
      createdAt: existing.createdAt,
      publishedAt: existing.publishedAt,
      history: existing.history
    }, { now: this.now });
    session.history.push({ at: this.now(), type: "updated", data: { fields: Object.keys(changes) } });
    if (existing.status === "active") {
      const openPool = existing.segmentIds.map(segmentId => state.segments[segmentId]).find(segment => segment?.status === "open");
      if (openPool) {
        const previousParticipants = new Map(openPool.participants.map(participant => [participant.actorUuid, participant]));
        openPool.name = session.name;
        openPool.locationId = session.locationId;
        openPool.participants = session.participants.map(participant => {
          const previous = previousParticipants.get(participant.actorUuid);
          const allocatedHours = previous?.allocatedHours ?? 0;
          return { ...participant, availableHours: Math.max(session.plannedDurationHours, allocatedHours), allocatedHours };
        });
        state.segments[openPool.id] = openPool;
      }
    }
    state.sessions[session.id] = session;
    await this.repository.write(state);
    return structuredClone(session);
  }
  async publish(id) { return this.#transition(id, "upcoming"); }
  async cancel(id) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.sessions[String(id)];
    if (!existing) throw new Error("Session not found.");
    const session = transitionSession(existing, "cancelled", this.now());
    for (const segmentId of session.segmentIds) {
      const segment = state.segments[segmentId];
      if (!segment || ["finalized", "cancelled"].includes(segment.status)) continue;
      segment.status = "cancelled";
      segment.finalizedAt = this.now();
    }
    state.sessions[session.id] = session;
    await this.repository.write(state);
    return structuredClone(session);
  }

  async removeUnused(id) {
    this.#requireGm();
    const state = await this.repository.read();
    const session = state.sessions[String(id)];
    if (!session) return false;
    if (!["draft", "cancelled"].includes(session.status)) throw new Error("Only a draft or cancelled Session can be deleted.");
    const related = session.segmentIds.map(segmentId => state.segments[segmentId]).filter(Boolean);
    const hasActions = related.some(segment => segment.allocations.length > 0 || segment.participants.some(participant => participant.allocatedHours > 0));
    if (hasActions) throw new Error("A Session with recorded allocations cannot be deleted.");
    for (const segment of related) delete state.segments[segment.id];
    delete state.sessions[session.id];
    await this.repository.write(state);
    return true;
  }
  async planProject(id, projectId) {
    this.#requireGm();
    const state = await this.repository.read();
    const session = state.sessions[String(id)];
    const project = state.projects[String(projectId)];
    if (!session || !project) throw new Error("Session or Project not found.");
    if (session.status !== "upcoming") throw new Error("Projects can only be planned for an upcoming Session.");
    if (!session.availableActivities.includes(project.activityType)) throw new Error("This activity is not available in the Session.");
    if (!session.participants.some(entry => entry.actorUuid === project.owner.uuid)) throw new Error("The Project owner is not participating in the Session.");
    if (!session.plannedProjectIds.includes(project.id)) session.plannedProjectIds.push(project.id);
    session.history.push({ at: this.now(), type: "project-planned", data: { projectId: project.id } });
    state.sessions[session.id] = session;
    await this.repository.write(state);
    return structuredClone(session);
  }
  async start(id) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.sessions[String(id)];
    if (!existing) throw new Error("Session not found.");
    const otherActiveSession = Object.values(state.sessions).find(session => session.id !== existing.id && session.status === "active");
    if (otherActiveSession) throw new Error(`Finalize '${otherActiveSession.name}' before starting another Downtime Session.`);
    const session = transitionSession(existing, "active", this.now());
    let segment = null;
    for (const segmentId of session.segmentIds) {
      const planned = state.segments[segmentId];
      if (planned?.status !== "draft") continue;
      planned.status = "open";
      state.segments[planned.id] = planned;
      segment ??= planned;
    }
    if (!segment) {
      segment = createSegment({
        name: session.name,
        source: "session",
        locationId: session.locationId,
        status: "open",
        participants: session.participants.map(entry => ({ ...entry, availableHours: session.plannedDurationHours })),
        metadata: { sessionId: session.id }
      }, { idFactory: this.segmentIdFactory ?? (() => foundry.utils.randomID()), now: this.now });
      session.segmentIds.push(segment.id);
    }
    state.sessions[session.id] = session;
    state.segments[segment.id] = segment;
    await this.repository.write(state);
    return { session: structuredClone(session), segment: structuredClone(segment) };
  }
  async addSegment(id, raw = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.sessions[String(id)];
    if (!existing) throw new Error("Session not found.");
    if (!["draft", "upcoming", "active"].includes(existing.status)) throw new Error("Segments can only be added while a Session is being prepared or is active.");
    const allowedParticipants = new Map(existing.participants.map(entry => [entry.actorUuid, entry]));
    const requestedParticipants = raw.participants?.length ? raw.participants : existing.participants;
    const segment = createSegment({
      ...raw,
      source: "session",
      status: existing.status === "active" ? "open" : "draft",
      metadata: { ...(raw.metadata ?? {}), sessionId: existing.id },
      participants: requestedParticipants.map(entry => {
        const sessionParticipant = allowedParticipants.get(String(entry.actorUuid ?? entry.uuid));
        if (!sessionParticipant) throw new Error("A Segment participant must belong to its Session.");
        return { ...sessionParticipant, ...entry };
      })
    }, { idFactory: this.segmentIdFactory ?? (() => foundry.utils.randomID()), now: this.now });
    const session = structuredClone(existing);
    session.segmentIds.push(segment.id);
    session.history.push({ at: this.now(), type: "segment-added", data: { segmentId: segment.id } });
    state.sessions[session.id] = session;
    state.segments[segment.id] = segment;
    await this.repository.write(state);
    return { session: structuredClone(session), segment: structuredClone(segment) };
  }
  async finalize(id, { force = false } = {}) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.sessions[String(id)];
    if (!existing) throw new Error("Session not found.");
    const sessionSegments = existing.segmentIds.map(segmentId => state.segments[segmentId]).filter(Boolean);
    const unallocated = sessionSegments.flatMap(segment => segment.participants
      .filter(participant => remainingHours(participant) > 0)
      .map(participant => ({ segmentId: segment.id, actorUuid: participant.actorUuid, hours: remainingHours(participant) })));
    const participantIds = new Set(existing.participants.map(entry => entry.actorUuid));
    const relatedProjects = Object.values(state.projects).filter(project => participantIds.has(project.owner.uuid)
      || project.participants.some(participant => participantIds.has(participant.actorUuid)));
    const waitingForGm = relatedProjects.filter(project => project.status === "waiting")
      .map(project => ({ projectId: project.id, name: project.name }));
    const warnings = [];
    if (unallocated.length) warnings.push({ type: "unallocated-hours", entries: unallocated });
    if (waitingForGm.length) warnings.push({ type: "waiting-for-gm", entries: waitingForGm });
    if (warnings.length && !force) return { finalized: false, session: structuredClone(existing), warnings };
    const session = transitionSession(existing, "finalized", this.now());
    for (const segment of sessionSegments) { segment.status = "finalized"; segment.finalizedAt = this.now(); }
    state.sessions[session.id] = session;
    await this.repository.write(state);
    return { finalized: true, session: structuredClone(session), warnings };
  }
  async #transition(id, status) {
    this.#requireGm();
    const state = await this.repository.read();
    const existing = state.sessions[String(id)];
    if (!existing) throw new Error("Session not found.");
    const session = transitionSession(existing, status, this.now());
    state.sessions[session.id] = session;
    await this.repository.write(state);
    return structuredClone(session);
  }
}
