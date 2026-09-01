import { applyEffort } from "../domain/project.mjs";
import { allocateSegmentHours, createSegment } from "../domain/segment.mjs";

export class SegmentService {
  constructor({ repository, activityRegistry, requirementEvaluator = null, idFactory = null, now = () => Date.now() }) {
    this.repository = repository;
    this.activityRegistry = activityRegistry;
    this.requirementEvaluator = requirementEvaluator;
    this.idFactory = idFactory;
    this.now = now;
  }

  #requireGm() {
    if (globalThis.game && !game.user?.isGM) throw new Error("Only a GM may modify Downtime Segments.");
  }

  async list({ status = null, participantActorUuid = null } = {}) {
    const state = await this.repository.read();
    return Object.values(state.segments)
      .filter(segment => !status || segment.status === status)
      .filter(segment => !participantActorUuid || segment.participants.some(entry => entry.actorUuid === participantActorUuid))
      .map(segment => structuredClone(segment));
  }

  async get(id) {
    const state = await this.repository.read();
    return state.segments[String(id)] ? structuredClone(state.segments[String(id)]) : null;
  }

  async create(raw) {
    this.#requireGm();
    const state = await this.repository.read();
    const segment = createSegment(raw, { idFactory: this.idFactory ?? (() => foundry.utils.randomID()), now: this.now });
    if (state.segments[segment.id]) throw new Error(`Segment '${segment.id}' already exists.`);
    state.segments[segment.id] = segment;
    await this.repository.write(state);
    return structuredClone(segment);
  }

  async remove(id) {
    this.#requireGm();
    const state = await this.repository.read();
    if (!state.segments[String(id)]) return false;
    delete state.segments[String(id)];
    await this.repository.write(state);
    return true;
  }

  async finalize(id) {
    this.#requireGm();
    const state = await this.repository.read();
    const segment = state.segments[String(id)];
    if (!segment) throw new Error("Segment not found.");
    if (segment.status !== "open") throw new Error("Only an open Segment can be finalized.");
    segment.status = "finalized";
    segment.finalizedAt = this.now();
    state.segments[segment.id] = segment;
    await this.repository.write(state);
    return structuredClone(segment);
  }

  async evaluateAllocation({ segment, project, session = null, participantActorUuids, hours }) {
    const reasons = [];
    if (!segment) reasons.push("Active Downtime Session not found.");
    if (!project) reasons.push("Project not found.");
    if (project && !["active", "paused", "waiting"].includes(project.status)) reasons.push("Project is not available for progress.");
    if (project && !["effort", "hybrid"].includes(project.progress.mode)) reasons.push("Project does not accept character effort.");
    if (segment && segment.status !== "open") reasons.push("The Downtime Session is not active.");
    if (segment?.metadata?.sessionId && (!session || session.status !== "active")) reasons.push("The Downtime Session is not active.");
    if (session && project && !session.availableActivities.includes(project.activityType)) reasons.push("This activity is not available in the active Downtime Session.");
    if (project?.locationId && segment?.locationId !== project.locationId) reasons.push("This Project can only progress at its assigned Location.");
    const activity = project ? this.activityRegistry.get(project.activityType) : null;
    if (project && activity) {
      const result = await activity.canProgress(project, { segment, participantActorUuids, hours });
      if (result === false) reasons.push("The Project cannot progress during this Downtime Session.");
      else if (result?.passed === false) reasons.push(...(result.reasons ?? ["The Project cannot progress during this Downtime Session."]));
    }
    if (project?.requirements?.length && this.requirementEvaluator) {
      const result = await this.requirementEvaluator(project.requirements, {
        locationId: segment?.locationId,
        capabilities: segment?.temporaryCapabilities ?? [],
        segment,
        project
      });
      if (!result?.passed) reasons.push(...(result?.reasons ?? ["The Downtime Session does not meet Project requirements."]));
    }
    return { passed: reasons.length === 0, reasons };
  }

  async allocate({ segmentId, projectId, participantActorUuids, hours }) {
    this.#requireGm();
    const state = await this.repository.read();
    const segment = state.segments[String(segmentId)];
    const project = state.projects[String(projectId)];
    const session = segment?.metadata?.sessionId ? state.sessions[String(segment.metadata.sessionId)] : null;
    const eligibility = await this.evaluateAllocation({ segment, project, session, participantActorUuids, hours });
    if (!eligibility.passed) throw new Error(eligibility.reasons.join(" "));
    const { segment: updatedSegment, allocation } = allocateSegmentHours(segment, {
      projectId, participantActorUuids, hours, at: this.now()
    });
    // Collaborative work consumes the same duration from every participant,
    // but advances the shared Project only once.
    let updatedProject = applyEffort(project, hours, { at: this.now() });
    for (const actorUuid of allocation.participantActorUuids) {
      const participant = updatedProject.participants.find(entry => entry.actorUuid === actorUuid);
      if (participant) participant.hoursContributed += allocation.hours;
    }
    if (["completed", "awaiting-collection"].includes(updatedProject.status) && !["completed", "awaiting-collection"].includes(project.status)) {
      const activity = this.activityRegistry.get(updatedProject.activityType);
      if (activity?.onComplete) {
        updatedProject = await activity.onComplete(updatedProject, { segment: updatedSegment, allocation }) ?? updatedProject;
      }
    }
    state.segments[updatedSegment.id] = updatedSegment;
    state.projects[updatedProject.id] = updatedProject;
    await this.repository.write(state);
    return { segment: structuredClone(updatedSegment), project: structuredClone(updatedProject), allocation };
  }
}
