import { SESSION_STATUSES } from "../constants.mjs";

const clone = value => structuredClone(value);

export function createSession(raw = {}, { idFactory = () => crypto.randomUUID(), now = () => Date.now() } = {}) {
  const id = String(raw.id ?? idFactory()).trim();
  const name = String(raw.name ?? "").trim();
  const status = String(raw.status ?? "draft");
  if (!id) throw new Error("A Downtime Session requires an id.");
  if (!name) throw new Error("A Downtime Session requires a name.");
  if (!SESSION_STATUSES.includes(status)) throw new Error(`Unknown Session status: ${status}.`);
  const plannedDurationHours = Math.max(0, Number(raw.plannedDurationHours ?? 0));
  if (!plannedDurationHours) throw new Error("A Downtime Session requires a planned duration in hours.");
  const participants = (raw.participants ?? []).map(entry => {
    const actorUuid = String(entry.actorUuid ?? entry.uuid ?? "").trim();
    if (!actorUuid) throw new Error("A Session participant requires an Actor UUID.");
    return { actorUuid, name: entry.name ? String(entry.name) : null };
  });
  if (!participants.length) throw new Error("A Downtime Session requires at least one participant.");
  const createdAt = Number(raw.createdAt ?? now());
  return {
    schemaVersion: 1, id, name,
    description: String(raw.description ?? ""),
    gmNotes: String(raw.gmNotes ?? ""),
    locationId: raw.locationId ? String(raw.locationId) : null,
    plannedDurationHours,
    participants,
    availableActivities: [...new Set((raw.availableActivities ?? []).map(String).filter(Boolean))],
    plannedProjectIds: [...new Set((raw.plannedProjectIds ?? []).map(String).filter(Boolean))],
    segmentIds: [...new Set((raw.segmentIds ?? []).map(String).filter(Boolean))],
    status,
    createdAt,
    publishedAt: raw.publishedAt == null ? null : Number(raw.publishedAt),
    startedAt: raw.startedAt == null ? null : Number(raw.startedAt),
    finalizedAt: raw.finalizedAt == null ? null : Number(raw.finalizedAt),
    history: clone(raw.history ?? [{ at: createdAt, type: "created", data: {} }])
  };
}

export function transitionSession(source, status, at = Date.now()) {
  const session = clone(source);
  const allowed = { draft: ["upcoming", "cancelled"], upcoming: ["active", "cancelled"], active: ["finalized", "cancelled"] };
  if (!allowed[session.status]?.includes(status)) throw new Error(`Session cannot transition from ${session.status} to ${status}.`);
  session.status = status;
  if (status === "upcoming") session.publishedAt = at;
  if (status === "active") session.startedAt = at;
  if (status === "finalized") session.finalizedAt = at;
  session.history.push({ at, type: status, data: {} });
  return session;
}
