/** One row per person for each recorded Session allocation, newest first. */
export function sessionSpends({ session, segments = [], projects = {}, activityName = () => null } = {}) {
  const byId = Array.isArray(segments)
    ? new Map(segments.map(segment => [segment.id, segment]))
    : new Map(Object.entries(segments ?? {}));
  const projectList = Array.isArray(projects) ? projects : Object.values(projects ?? {});
  const projectById = new Map(projectList.map(project => [project.id, project]));
  const rows = [];
  for (const segmentId of session?.segmentIds ?? []) {
    const segment = byId.get(segmentId);
    if (!segment) continue;
    for (const allocation of segment.allocations ?? []) {
      const project = projectById.get(allocation.projectId) ?? null;
      const what = allocation.recipeName
        || project?.name
        || activityName(allocation.activityId || project?.activityType)
        || "a project";
      const people = allocation.participantActorUuids?.length ? allocation.participantActorUuids : [];
      for (const actorUuid of people) {
        rows.push({
          at: Number(allocation.createdAt ?? 0),
          who: personName(actorUuid, segment, project),
          amount: amountLabel(allocation),
          what
        });
      }
    }
  }
  rows.sort((left, right) => right.at - left.at || left.who.localeCompare(right.who));
  return rows.map(row => ({
    who: row.who,
    amount: row.amount,
    what: row.what,
    when: row.at ? new Date(row.at).toLocaleString() : ""
  }));
}

function personName(actorUuid, segment, project) {
  const onSegment = segment.participants?.find(entry => entry.actorUuid === actorUuid)?.name;
  if (onSegment) return onSegment;
  const onProject = project?.participants?.find(entry => entry.actorUuid === actorUuid)?.name;
  if (onProject) return onProject;
  if (project?.owner?.uuid === actorUuid && project.owner.name) return project.owner.name;
  return "A participant";
}

function amountLabel(allocation) {
  const hours = Number(allocation.hours);
  if (Number.isFinite(hours) && hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Number(allocation.days);
  if (Number.isFinite(days) && days > 0) return `${days} ${days === 1 ? "day" : "days"}`;
  return "0 hours";
}
