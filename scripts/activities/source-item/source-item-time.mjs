/** Hours a character spends sourcing an item, recorded on the active Session like crafting time. */
export function sourcingTimeEntry({ actorUuid, hours, itemName, projectId = null } = {}) {
  const ownerUuid = String(actorUuid ?? "").trim();
  const label = String(itemName ?? "").trim();
  const spent = Number(hours);
  if (!ownerUuid) throw new Error("Choose a character.");
  if (!label) throw new Error("Name the item being sourced.");
  if (!Number.isFinite(spent) || spent <= 0) throw new Error("Sourcing time must be greater than zero.");
  return {
    actorUuid: ownerUuid,
    hours: spent,
    label,
    projectId: projectId ? String(projectId) : `source-item:${ownerUuid}`
  };
}
