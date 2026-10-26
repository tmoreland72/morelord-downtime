import { MODULE_ID } from "../constants.mjs";

export function openDowntimeSceneTool() {
  const api = globalThis.MorelordDowntime ?? game.modules.get(MODULE_ID)?.api;
  if (!api?.open) return ui.notifications.warn("Morelord Downtime is still initializing.");
  return api.open();
}

export const DOWNTIME_SCENE_TOOL = {
  id: MODULE_ID,
  title: "Morelord Downtime",
  icon: "fa-solid fa-timer",
  order: 40,
  visible: () => true,
  onClick: openDowntimeSceneTool
};
