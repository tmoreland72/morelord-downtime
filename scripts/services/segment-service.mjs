import { applyEffort } from "../domain/project.mjs";
import { allocateSegmentHours, createSegment, remainingHours } from "../domain/segment.mjs";
import { characterInstructorUuid, sameActor, withCharacterInstructor } from "../activities/training/training-activity.mjs";

export class SegmentService {
  constructor({ repository, activityRegistry, requirementEvaluator = null, getLocation = null, resolveActor = null, idFactory = null, now = () => Date.now() }) {
    this.repository = repository;
    this.activityRegistry = activityRegistry;
    this.requirementEvaluator = requirementEvaluator;
    this.getLocation = getLocation;
    this.resolveActor = resolveActor;
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
      const locationId = project.locationId || segment?.locationId;
      let location = null;
      if (locationId && this.getLocation) {
        try { location = this.getLocation(locationId) ?? null; }
        catch { location = null; }
      }
      const result = await activity.canProgress(project, { segment, participantActorUuids, hours, location });
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

  async #sessionInstructor(project, segment) {
    const raw = characterInstructorUuid(project);
    if (!raw || !segment) return null;
    const resolved = typeof this.resolveActor === "function" ? await this.resolveActor(raw) : raw;
    const candidates = [resolved, raw].map(value => String(value ?? "").trim()).filter(Boolean);
    const instructor = segment.participants.find(entry => candidates.some(uuid => sameActor(entry.actorUuid, uuid)));
    const name = project.metadata?.training?.instructor?.name || instructor?.name || "The instructor";
    if (!instructor) throw new Error(`${name} is not part of this Downtime Session, so the same training hours cannot be spent.`);
    return instructor;
  }

  async allocate({ segmentId, projectId, participantActorUuids, hours }) {
    this.#requireGm();
    const state = await this.repository.read();
    const segment = state.segments[String(segmentId)];
    const project = state.projects[String(projectId)];
    const session = segment?.metadata?.sessionId ? state.sessions[String(segment.metadata.sessionId)] : null;
    const instructor = await this.#sessionInstructor(project, segment);
    const instructorUuid = instructor?.actorUuid ?? characterInstructorUuid(project);
    const actors = withCharacterInstructor(project, participantActorUuids, instructorUuid);
    if (instructor && remainingHours(instructor) < Math.max(0, Number(hours ?? 0))) {
      const name = instructor.name || project.metadata?.training?.instructor?.name || "The instructor";
      throw new Error(`${name} does not have enough remaining downtime hours. Training spends the same hours for the student and the instructor.`);
    }
    const projectForCheck = structuredClone(project);
    if (instructor && projectForCheck.metadata?.training) {
      projectForCheck.metadata.training.instructor = {
        ...(projectForCheck.metadata.training.instructor ?? {}),
        mode: "participant",
        actorUuid: instructor.actorUuid
      };
      if (!projectForCheck.participants.some(entry => sameActor(entry.actorUuid, instructor.actorUuid))) {
        projectForCheck.participants.push({ actorUuid: instructor.actorUuid, role: "instructor", approved: true, hoursContributed: 0 });
      }
    }
    const eligibility = await this.evaluateAllocation({ segment, project: projectForCheck, session, participantActorUuids: actors, hours });
    if (!eligibility.passed) throw new Error(eligibility.reasons.join(" "));
    const { segment: updatedSegment, allocation } = allocateSegmentHours(segment, {
      projectId, participantActorUuids: actors, hours, at: this.now()
    });
    // Collaborative work consumes the same duration from every participant,
    // but advances the shared Project only once.
    let updatedProject = applyEffort(projectForCheck, hours, { at: this.now() });
    for (const actorUuid of allocation.participantActorUuids) {
      const participant = updatedProject.participants.find(entry => sameActor(entry.actorUuid, actorUuid));
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
