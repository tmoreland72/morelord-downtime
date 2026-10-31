/**
 * The GM who may commit world downtime changes.
 * Core's user list omits ignored users. An ignored GM, such as the Dev1 GM,
 * must still be primary when they are the first active Foundry GM.
 */
export function isPrimaryActiveGm({ user = globalThis.game?.user, users = globalThis.game?.users } = {}) {
  if (user?.isGM !== true) return false;
  const activeGms = Array.from(users ?? [])
    .filter(entry => entry?.active && entry.isGM)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return !activeGms.length || activeGms[0].id === user.id;
}
