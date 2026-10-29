import { MODULE_ID } from "../constants.mjs";
import { queueLiveWindowRefresh } from "../apps/live-window-registry.mjs";

export function registerCraftTimeTracking(craftTime, { refresh = queueLiveWindowRefresh } = {}) {
  Hooks.on("updateActor", (actor, changes) => {
    const flags = changes?.flags;
    if (!flags || !Object.prototype.hasOwnProperty.call(flags, "morelord-craftworks")) return;
    refresh();
    void craftTime.reconcileActor(actor).catch(error => {
      console.error(`${MODULE_ID} | Could not record crafting time.`, error);
      globalThis.ui?.notifications?.error?.(`Morelord Downtime could not record crafting time: ${error.message}`);
    });
  });
}
