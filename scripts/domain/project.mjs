import { PROGRESS_MODES, PROJECT_SCHEMA_VERSION, PROJECT_STATUSES } from "../constants.mjs";

const clone = value => structuredClone(value);
const number = value => Math.max(0, Number(value ?? 0));

export function normalizeOwner(owner = {}) {
  const type = String(owner.type ?? "actor").trim();
  const uuid = String(owner.uuid ?? "").trim();
  if (!uuid) throw new Error("A Project owner requires a UUID.");
  return { type, uuid, name: owner.name ? String(owner.name) : null };
}

export function normalizeParticipant(participant = {}) {
  const actorUuid = String(participant.actorUuid ?? participant.uuid ?? "").trim();
  if (!actorUuid) throw new Error("A Project participant requires an Actor UUID.");
  return {
    actorUuid,
    role: String(participant.role ?? "participant"),
    approved: participant.approved === true,
    hoursContributed: number(participant.hoursContributed)
  };
}

export function normalizeProvider(provider) {
  if (!provider) return null;
  const id = String(provider.id ?? provider.uuid ?? "").trim();
  if (!id) throw new Error("A provider requires an id or UUID.");
  return {
    id,
    name: String(provider.name ?? "Provider"),
    type: String(provider.type ?? "record"),
    actorUuid: provider.actorUuid ? String(provider.actorUuid) : null,
    locationId: provider.locationId ? String(provider.locationId) : null,
    capabilities: clone(provider.capabilities ?? [])
  };
}

export function normalizeProgress(progress = {}) {
  const mode = String(progress.mode ?? "effort");
  if (!PROGRESS_MODES.includes(mode)) throw new Error(`Unknown Project progress mode: ${mode}.`);
  return {
    mode,
    effort: { requiredHours: number(progress.effort?.requiredHours), completedHours: number(progress.effort?.completedHours) },
    elapsed: { requiredDays: number(progress.elapsed?.requiredDays), completedDays: number(progress.elapsed?.completedDays) }
  };
}

export function isProgressComplete(progress) {
  const effortComplete = progress.effort.requiredHours <= progress.effort.completedHours;
  const elapsedComplete = progress.elapsed.requiredDays <= progress.elapsed.completedDays;
  if (progress.mode === "effort") return effortComplete;
  if (progress.mode === "elapsed") return elapsedComplete;
  return effortComplete && elapsedComplete;
}

export function createProject(raw = {}, { idFactory = () => crypto.randomUUID(), now = () => Date.now() } = {}) {
  const id = String(raw.id ?? idFactory()).trim();
  const activityType = String(raw.activityType ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!id) throw new Error("A Project requires an id.");
  if (!activityType) throw new Error("A Project requires an activity type.");
  if (!name) throw new Error("A Project requires a name.");
  const status = String(raw.status ?? "planned");
  if (!PROJECT_STATUSES.includes(status)) throw new Error(`Unknown Project status: ${status}.`);
  const createdAt = Number(raw.createdAt ?? now());
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    name,
    activityType,
    owner: normalizeOwner(raw.owner),
    participants: (raw.participants ?? []).map(normalizeParticipant),
    provider: normalizeProvider(raw.provider),
    status,
    createdAt,
    startedAt: raw.startedAt == null ? null : Number(raw.startedAt),
    completedAt: raw.completedAt == null ? null : Number(raw.completedAt),
    locationId: raw.locationId ? String(raw.locationId) : null,
    collectionLocationId: raw.collectionLocationId ? String(raw.collectionLocationId) : null,
    progress: normalizeProgress(raw.progress),
    requirements: clone(raw.requirements ?? []),
    costs: clone(raw.costs ?? []),
    history: clone(raw.history ?? [{ at: createdAt, type: "created", data: {} }]),
    metadata: clone(raw.metadata ?? {})
  };
}

export function appendHistory(project, type, data = {}, at = Date.now()) {
  project.history.push({ at, type: String(type), data: clone(data) });
  return project;
}

export function finalizeIfComplete(project, at = Date.now()) {
  if (!isProgressComplete(project.progress)) return project;
  project.status = project.collectionLocationId ? "awaiting-collection" : "completed";
  project.completedAt = at;
  appendHistory(project, "completed", { status: project.status }, at);
  return project;
}

export function applyEffort(source, hours, { participantActorUuid = null, at = Date.now() } = {}) {
  const project = clone(source);
  if (!["active", "paused", "waiting"].includes(project.status)) throw new Error("Project cannot receive effort in its current status.");
  if (!['effort', 'hybrid'].includes(project.progress.mode)) throw new Error("Project does not use character effort.");
  const applied = Math.min(number(hours), Math.max(0, project.progress.effort.requiredHours - project.progress.effort.completedHours));
  project.progress.effort.completedHours += applied;
  if (participantActorUuid) {
    const participant = project.participants.find(entry => entry.actorUuid === participantActorUuid);
    if (participant) participant.hoursContributed += applied;
  }
  appendHistory(project, "effort-applied", { hours: applied, participantActorUuid }, at);
  return finalizeIfComplete(project, at);
}

export function advanceElapsedDay(source, { dayKey, at = Date.now() } = {}) {
  const project = clone(source);
  if (project.status !== "active" || !["elapsed", "hybrid"].includes(project.progress.mode)) return project;
  const remaining = Math.max(0, project.progress.elapsed.requiredDays - project.progress.elapsed.completedDays);
  const applied = Math.min(1, remaining);
  project.progress.elapsed.completedDays += applied;
  if (applied) appendHistory(project, "elapsed-day", { days: applied, dayKey }, at);
  return finalizeIfComplete(project, at);
}
