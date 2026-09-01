import { createProject } from "../../domain/project.mjs";

export const COMMISSION_ACTIVITY_ID = "commission";

export function createCommissionProject(data = {}, options = {}) {
  const contractorName = String(data.contractorName ?? "").trim();
  const itemDescription = String(data.itemDescription ?? "").trim();
  const locationId = String(data.locationId ?? "").trim();
  const requiredDays = Number(data.requiredDays ?? 0);
  if (!contractorName) throw new Error("Commission requires a contractor name.");
  if (!itemDescription) throw new Error("Commission requires an item description.");
  if (!locationId) throw new Error("Commission requires a Location.");
  if (!Number.isInteger(requiredDays) || requiredDays <= 0) throw new Error("Total labor days must be a positive whole number.");
  return createProject({
    ...data,
    name: data.name ?? itemDescription,
    activityType: COMMISSION_ACTIVITY_ID,
    status: data.status ?? "active",
    locationId,
    collectionLocationId: locationId,
    progress: {
      mode: "elapsed",
      elapsed: { requiredDays, completedDays: Number(data.completedDays ?? 0) }
    },
    metadata: {
      ...(data.metadata ?? {}),
      commission: {
        contractorName,
        itemDescription,
        notes: String(data.notes ?? "")
      }
    }
  }, options);
}

export function commissionSummary(project) {
  const elapsed = project.progress.elapsed;
  return `${project.metadata?.commission?.itemDescription ?? project.name}: ${elapsed.completedDays} / ${elapsed.requiredDays} days`;
}
