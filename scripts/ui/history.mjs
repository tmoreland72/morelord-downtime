import { logLabel, logValue } from "../../../morelord-core/scripts/ui/log-formatting.js";

const fieldLabel = field => ({ collectionLocationId: "Collection location", locationId: "Location",
  availableActivities: "Available project types", plannedProjectIds: "Planned projects",
  segmentIds: "Time pools", metadata: "Activity details" })[field] ?? logLabel(field);

/** Format existing records on read; never rewrite campaign history. */
export async function formatHistory(history, services, record = {}) {
  const actorName = uuid => globalThis.game?.actors?.get(String(uuid).split(".").at(-1))?.name
    ?? (record.owner?.uuid === uuid ? record.owner.name : null)
    ?? record.participants?.find(actor => actor.actorUuid === uuid)?.name ?? "Unavailable character";
  return Promise.all(history.slice().reverse().map(async entry => {
    const data = entry.data ?? {};
    let details;
    switch (entry.type) {
      case "effort-applied":
        details = `${data.participantActorUuid ? actorName(data.participantActorUuid) : "A participant"} contributed ${data.hours} ${data.hours === 1 ? "hour" : "hours"}.`;
        break;
      case "elapsed-day": details = `${data.days} ${data.days === 1 ? "day" : "days"} of progress recorded.`; break;
      case "updated": details = `Changed: ${(data.fields ?? []).map(fieldLabel).join(", ") || "Details"}.`; break;
      case "completed": details = data.status === "awaiting-collection" ? "Work finished; ready for collection." : "Project completed."; break;
      case "cancelled": details = data.reason ? `Reason: ${data.reason}` : "Cancelled."; break;
      case "collected": {
        const location = services.locations()?.list?.().find(location => location.id === data.locationId);
        details = location ? `Collected at ${location.name}.` : "Commission collected.";
        break;
      }
      case "project-planned": details = `Planned project: ${(await services.projects.get(data.projectId))?.name ?? "Unavailable project"}.`; break;
      case "segment-added": details = `Time pool added: ${(await services.segments.get(data.segmentId))?.name ?? "Unavailable time pool"}.`; break;
      case "source-item-resolved": details = `${data.success ? "Item found" : "Item not found"}. Check total: ${data.total}; difficulty: ${data.dc}. Alternative offers: ${data.alternativeCount}.`; break;
      case "source-item-persuasion": details = `Persuasion total: ${data.total}. Price adjustment: ${data.adjustment > 0 ? "+" : ""}${Math.round(data.adjustment * 100)}%.`; break;
      case "proficiency-awarded": details = `${actorName(data.actorUuid)} learned ${record.metadata?.training?.proficiencyLabel ?? logLabel(data.proficiencyId)} (${logLabel(data.kind)}).`; break;
      case "proficiency-award-skipped": details = `Proficiency was not awarded: ${logLabel(data.reason ?? "No reason recorded")}.`; break;
      default: details = Object.keys(data).length ? logValue(data) : null;
    }
    return { ...entry, label: logLabel(entry.type), when: new Date(entry.at).toLocaleString(), details };
  }));
}
