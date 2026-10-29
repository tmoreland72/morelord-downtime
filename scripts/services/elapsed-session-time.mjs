import { sessionHoursForElapsedDays } from "../domain/labor-time.mjs";

const ELAPSED_SESSION_ACTIVITIES = new Set(["commission", "source-item"]);

export async function recordElapsedSessionTime(sessionTime, result) {
  if (!result?.advanced) return [];
  const recorded = [];
  for (const project of result.projects ?? []) {
    if (!ELAPSED_SESSION_ACTIVITIES.has(project.activityType) || !(Number(project.elapsedDaysApplied) > 0)) continue;
    const owner = project.owner ?? {};
    recorded.push(await sessionTime.recordHours({
      actor: {
        id: String(owner.uuid ?? "").split(".").at(-1) || owner.uuid,
        uuid: owner.uuid,
        name: owner.name ?? null,
        type: "character"
      },
      activityId: project.activityType,
      hours: sessionHoursForElapsedDays(project.elapsedDaysApplied),
      label: project.name,
      projectId: project.id
    }));
  }
  return recorded;
}
