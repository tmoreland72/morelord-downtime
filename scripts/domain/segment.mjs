const clone = value => structuredClone(value);
const hours = value => Math.max(0, Number(value ?? 0));

export function normalizeSegmentParticipant(raw = {}) {
  const actorUuid = String(raw.actorUuid ?? raw.uuid ?? "").trim();
  if (!actorUuid) throw new Error("A Segment participant requires an Actor UUID.");
  const availableHours = hours(raw.availableHours);
  const allocatedHours = Math.min(availableHours, hours(raw.allocatedHours));
  return { actorUuid, name: raw.name ? String(raw.name) : null, availableHours, allocatedHours };
}

export function createSegment(raw = {}, { idFactory = () => crypto.randomUUID(), now = () => Date.now() } = {}) {
  const id = String(raw.id ?? idFactory()).trim();
  const name = String(raw.name ?? "").trim();
  if (!id) throw new Error("A Downtime Segment requires an id.");
  if (!name) throw new Error("A Downtime Segment requires a name.");
  const status = String(raw.status ?? "open");
  if (!["draft", "open", "finalized", "cancelled"].includes(status)) throw new Error(`Unknown Segment status: ${status}.`);
  return {
    schemaVersion: 1,
    id,
    name,
    source: String(raw.source ?? "manual"),
    locationId: raw.locationId ? String(raw.locationId) : null,
    temporaryCapabilities: clone(raw.temporaryCapabilities ?? []),
    participants: (raw.participants ?? []).map(normalizeSegmentParticipant),
    status,
    allocations: clone(raw.allocations ?? []),
    metadata: clone(raw.metadata ?? {}),
    createdAt: Number(raw.createdAt ?? now()),
    finalizedAt: raw.finalizedAt == null ? null : Number(raw.finalizedAt)
  };
}

export function remainingHours(participant) {
  return Math.max(0, hours(participant.availableHours) - hours(participant.allocatedHours));
}

export function allocateSegmentHours(source, { projectId, participantActorUuids, hours: requestedHours, at = Date.now() } = {}) {
  const segment = clone(source);
  if (segment.status !== "open") throw new Error("Only an active Downtime Session can receive allocations.");
  const allocationHours = hours(requestedHours);
  if (!allocationHours) throw new Error("Allocation hours must be greater than zero.");
  const actorUuids = [...new Set((participantActorUuids ?? []).map(String).filter(Boolean))];
  if (!actorUuids.length) throw new Error("An allocation requires at least one participant.");
  const participants = actorUuids.map(actorUuid => {
    const participant = segment.participants.find(entry => entry.actorUuid === actorUuid);
    if (!participant) throw new Error(`Actor '${actorUuid}' is not part of this Downtime Session.`);
    if (remainingHours(participant) < allocationHours) throw new Error(`${participant.name ?? actorUuid} does not have enough remaining downtime hours.`);
    return participant;
  });
  for (const participant of participants) participant.allocatedHours += allocationHours;
  const allocation = {
    id: `${segment.id}:${segment.allocations.length + 1}`,
    projectId: String(projectId),
    participantActorUuids: actorUuids,
    hours: allocationHours,
    createdAt: at
  };
  segment.allocations.push(allocation);
  return { segment, allocation };
}

/** Give back the session hours recorded against one Project. A second call is a no-op. */
export function releaseProjectHours(source, projectId) {
  const segment = clone(source);
  const target = String(projectId);
  const kept = [];
  for (const allocation of segment.allocations) {
    if (String(allocation.projectId) !== target) {
      kept.push(allocation);
      continue;
    }
    for (const actorUuid of allocation.participantActorUuids ?? []) {
      const participant = segment.participants.find(entry => entry.actorUuid === actorUuid);
      if (participant) participant.allocatedHours = Math.max(0, hours(participant.allocatedHours) - hours(allocation.hours));
    }
  }
  segment.allocations = kept;
  return segment;
}

/** Record time a character has already spent. Crafting can exceed the plan because the time is already gone. */
export function recordSpentHours(source, { actorUuid, hours: requestedHours, projectId, at = Date.now(), sourceName = "craftworks", recipeId = null, recipeName = null, activityId = null, days = null } = {}) {
  const segment = clone(source);
  if (segment.status !== "open") throw new Error("Only an active Downtime Session can record spent time.");
  const spent = hours(requestedHours);
  if (!spent) throw new Error("Spent hours must be greater than zero.");
  const participant = segment.participants.find(entry => entry.actorUuid === String(actorUuid));
  if (!participant) throw new Error(`Actor '${actorUuid}' is not part of this Downtime Session.`);
  participant.allocatedHours += spent;
  const allocation = {
    id: `${segment.id}:${segment.allocations.length + 1}`,
    projectId: String(projectId),
    participantActorUuids: [participant.actorUuid],
    hours: spent,
    createdAt: at,
    source: String(sourceName),
    recipeId: recipeId == null ? null : String(recipeId),
    recipeName: recipeName == null ? null : String(recipeName),
    activityId: activityId == null ? null : String(activityId),
    days: days == null ? null : Number(days)
  };
  segment.allocations.push(allocation);
  return { segment, allocation, exceeded: participant.allocatedHours > participant.availableHours };
}

/** A presence activity spends a Session day without taking hours from the hour pool. */
export function recordSpentDays(source, { actorUuid, days = 1, projectId, at = Date.now(), activityId = null } = {}) {
  const segment = clone(source);
  if (segment.status !== "open") throw new Error("Only an active Downtime Session can record spent time.");
  const spentDays = Number(days);
  if (!Number.isFinite(spentDays) || spentDays <= 0) throw new Error("Spent days must be greater than zero.");
  const participant = segment.participants.find(entry => entry.actorUuid === String(actorUuid));
  if (!participant) throw new Error(`Actor '${actorUuid}' is not part of this Downtime Session.`);
  const allocation = {
    id: `${segment.id}:${segment.allocations.length + 1}`,
    projectId: String(projectId),
    participantActorUuids: [participant.actorUuid],
    hours: 0,
    days: spentDays,
    createdAt: at,
    source: "xge",
    recipeId: null,
    recipeName: null,
    activityId: activityId == null ? null : String(activityId)
  };
  segment.allocations.push(allocation);
  return { segment, allocation };
}
