import { SESSION_STATUSES } from "../constants.mjs";

const clone = value => structuredClone(value);

const LEGACY_PENDING = new Set(["draft", "upcoming"]);

/** Days is optional. A blank value stays blank. Hours are stored as given, or Days × 8 when only Days is provided. */
export function sessionSchedule(raw = {}) {
  const days = optionalDays(raw.days);
  const plannedDurationHours = sessionHours(raw.plannedDurationHours, days);
  const daysUsed = Math.max(0, Number(raw.daysUsed ?? 0));
  return { days, plannedDurationHours, daysUsed: Number.isFinite(daysUsed) ? daysUsed : 0 };
}

function optionalDays(value) {
  if (value === undefined || value === null || value === "") return null;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1) throw new Error("Days must be a whole number of at least 1.");
  return days;
}

function sessionHours(value, days) {
  if (value === undefined || value === null || value === "") {
    if (days == null) throw new Error("A Downtime Session requires hours.");
    return days * 8;
  }
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Hours must be greater than 0.");
  return hours;
}

export function createSession(raw = {}, { idFactory = () => crypto.randomUUID(), now = () => Date.now() } = {}) {
  const id = String(raw.id ?? idFactory()).trim();
  const name = String(raw.name ?? "").trim();
  const requestedStatus = String(raw.status ?? "pending");
  const status = LEGACY_PENDING.has(requestedStatus) ? "pending" : requestedStatus;
  if (!id) throw new Error("A Downtime Session requires an id.");
  if (!name) throw new Error("A Downtime Session requires a name.");
  if (!SESSION_STATUSES.includes(status)) throw new Error(`Unknown Session status: ${status}.`);
  const { days, plannedDurationHours, daysUsed } = sessionSchedule(raw);
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
    days,
    daysUsed,
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
  const allowed = { pending: ["active", "cancelled"], active: ["finalized", "cancelled"] };
  if (!allowed[session.status]?.includes(status)) throw new Error(`Session cannot transition from ${session.status} to ${status}.`);
  session.status = status;
  if (status === "pending") session.publishedAt = at;
  if (status === "active") session.startedAt = at;
  if (status === "finalized") session.finalizedAt = at;
  session.history.push({ at, type: status, data: {} });
  return session;
}
