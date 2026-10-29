import { MODULE_ID } from "../constants.mjs";
import { queueLiveWindowRefresh } from "../apps/live-window-registry.mjs";

/** Foundry may deliver flag edits nested or as dotted update keys. */
export function craftingActorChanged(changes) {
  if (!changes || typeof changes !== "object") return false;
  const flags = changes.flags;
  if (flags && (Object.prototype.hasOwnProperty.call(flags, "morelord-craftworks") || flags["morelord-craftworks"])) return true;
  return Object.keys(changes).some(key => key === "flags.morelord-craftworks" || key.startsWith("flags.morelord-craftworks."));
}

export function registerCraftTimeTracking(craftTime, { refresh = queueLiveWindowRefresh } = {}) {
  Hooks.on("updateActor", (actor, changes) => {
    if (!craftingActorChanged(changes)) return;
    refresh();
    void craftTime.reconcileActor(actor).then(() => refresh(), error => {
      console.error(`${MODULE_ID} | Could not record crafting time.`, error);
      globalThis.ui?.notifications?.error?.(`Morelord Downtime could not record crafting time: ${error.message}`);
      refresh();
    });
  });
}
