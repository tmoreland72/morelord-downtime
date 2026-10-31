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

/** Chronological record of everything that changed while the Session was open. */
export function sessionJournal({ session, segments = [], projects = {}, activityName = () => null } = {}) {
  const byId = segmentMap(segments);
  const projectList = Array.isArray(projects) ? projects : Object.values(projects ?? {});
  const projectById = new Map(projectList.map(project => [project.id, project]));
  const participants = new Set((session?.participants ?? []).map(entry => entry.actorUuid));
  const start = session?.startedAt == null ? null : Number(session.startedAt);
  const end = session?.finalizedAt == null ? Infinity : Number(session.finalizedAt);
  const during = at => {
    const time = Number(at);
    if (!Number.isFinite(time) || time <= 0 || start == null) return false;
    return time >= start && time <= end;
  };
  const rows = [];
  const allocatedIds = new Set();
  for (const segmentId of session?.segmentIds ?? []) {
    const segment = byId.get(segmentId);
    if (!segment) continue;
    for (const allocation of segment.allocations ?? []) {
      allocatedIds.add(allocation.projectId);
      const project = projectById.get(allocation.projectId) ?? null;
      const projectName = projectLabel(allocation, project, activityName);
      const people = allocation.participantActorUuids?.length ? allocation.participantActorUuids : [];
      for (const actorUuid of people) {
        rows.push(entry({
          at: allocation.createdAt,
          order: 10,
          who: personName(actorUuid, segment, project),
          project: projectName,
          change: `Spent ${amountLabel(allocation)}`,
          result: ""
        }));
      }
    }
  }
  for (const project of projectList) {
    const involved = participants.has(project.owner?.uuid)
      || (project.participants ?? []).some(person => participants.has(person.actorUuid))
      || allocatedIds.has(project.id);
    if (!involved) continue;
    const recordedChecks = new Set();
    for (const item of project.history ?? []) {
      if (!during(item.at)) continue;
      if (item.type === "xge-check") recordedChecks.add(checkKey(item.data));
      const described = describeHistory(item, project);
      if (!described) continue;
      rows.push(entry({
        at: item.at,
        order: historyOrder(item.type),
        who: historyWho(item, project, session),
        project: project.name,
        ...described
      }));
    }
    if (!recordedChecks.size) {
      const resolvedAt = (project.history ?? []).find(item => item.type === "xge-resolved")?.at
        ?? project.completedAt;
      if (during(resolvedAt)) {
        for (const check of project.metadata?.xge?.checks ?? []) {
          if (check?.total == null) continue;
          const dc = check.dc == null ? null : Number(check.dc);
          rows.push(entry({
            at: resolvedAt,
            order: 30,
            who: project.owner?.name || "A participant",
            project: project.name,
            change: `${check.label} ${check.total}${dc == null ? "" : ` vs DC ${dc}`}`,
            result: dc == null ? "" : (Number(check.total) >= dc ? "Success" : "Failure")
          }));
        }
      }
    }
  }
  rows.sort((left, right) => left.at - right.at || left.order - right.order || left.project.localeCompare(right.project) || left.change.localeCompare(right.change));
  return rows.map(row => ({
    who: row.who,
    project: row.project,
    change: row.change,
    result: row.result,
    when: row.at ? new Date(row.at).toLocaleString() : ""
  }));
}

function segmentMap(segments) {
  return Array.isArray(segments)
    ? new Map(segments.map(segment => [segment.id, segment]))
    : new Map(Object.entries(segments ?? {}));
}

function projectLabel(allocation, project, activityName) {
  return allocation.recipeName
    || project?.name
    || activityName(allocation.activityId || project?.activityType)
    || "a project";
}

function entry(row) {
  return {
    at: Number(row.at ?? 0),
    order: Number(row.order ?? 20),
    who: row.who || "A participant",
    project: row.project || "a project",
    change: row.change,
    result: row.result || ""
  };
}

function historyOrder(type) {
  if (type === "xge-check") return 30;
  if (type === "xge-resolved" || type === "source-item-resolved" || type === "source-item-persuasion") return 40;
  if (type === "completed" || type === "cancelled" || type === "proficiency-awarded") return 50;
  return 20;
}

function historyWho(item, project, session) {
  const actorUuid = item.data?.participantActorUuid || project.owner?.uuid;
  const named = session?.participants?.find(person => person.actorUuid === actorUuid)?.name
    || project.participants?.find(person => person.actorUuid === actorUuid)?.name
    || project.owner?.name;
  return named || "A participant";
}

function checkKey(data = {}) {
  return `${data.label}:${data.total}:${data.dc ?? ""}`;
}

function describeHistory(item, project) {
  const data = item.data ?? {};
  switch (item.type) {
    case "created":
      return { change: "Project started", result: project.metadata?.xge?.currencyNote || "" };
    case "elapsed-day": {
      const days = Number(data.days ?? 0);
      const elapsed = project.progress?.elapsed;
      const progress = elapsed ? `${elapsed.completedDays} of ${elapsed.requiredDays} days` : "";
      return { change: `Advance Day added ${days} ${days === 1 ? "day" : "days"}`, result: progress };
    }
    case "effort-applied":
      return { change: `Recorded ${data.hours} ${Number(data.hours) === 1 ? "hour" : "hours"} of progress`, result: "" };
    case "xge-check": {
      const dc = data.dc == null ? "" : ` vs DC ${data.dc}`;
      const result = data.success == null ? "" : data.success ? "Success" : "Failure";
      return { change: `${data.label} ${data.total}${dc}`, result };
    }
    case "xge-resolved":
      return {
        change: "Outcome recorded",
        result: [data.summary, data.complication ? `Complication: ${data.complication}` : ""].filter(Boolean).join(" ")
      };
    case "presence-focus":
      return { change: data.active ? "Marked Active" : "Marked Inactive", result: data.summary || "" };
    case "completed":
      return { change: data.status === "awaiting-collection" ? "Ready for collection" : "Project completed", result: "" };
    case "cancelled":
      return { change: "Project cancelled", result: data.reason || "" };
    case "source-item-resolved":
      return {
        change: data.success ? "Item sourced" : "Search failed",
        result: `Total ${data.total} vs DC ${data.dc}${data.alternativeCount ? `. ${data.alternativeCount} alternatives` : ""}`
      };
    case "source-item-persuasion": {
      const percent = Math.round(Number(data.adjustment) * 100);
      return { change: "Price changed", result: `${percent > 0 ? "+" : ""}${percent}% after a Persuasion total of ${data.total}` };
    }
    case "proficiency-awarded":
      return { change: "Training completed", result: project.metadata?.training?.proficiencyLabel || "" };
    case "updated":
      return { change: "Project details changed", result: "" };
    default:
      return null;
  }
}

function amountLabel(allocation) {
  const hours = Number(allocation.hours);
  if (Number.isFinite(hours) && hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Number(allocation.days);
  if (Number.isFinite(days) && days > 0) return `${days} ${days === 1 ? "day" : "days"}`;
  return "0 hours";
}
