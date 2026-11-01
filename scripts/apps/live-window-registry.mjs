import { MODULE_ID, STATE_SETTING } from "../constants.mjs";
import { getCoreApi } from "../integrations/core-api.mjs";

const liveWindows = new Set();
let refreshTimer = null;

export function registerLiveWindow(app) {
  liveWindows.add(app);
  return app;
}

export function unregisterLiveWindow(app) {
  liveWindows.delete(app);
}

function backgroundRender() {
  try {
    return getCoreApi()?.ui?.renderInBackground ?? null;
  } catch {
    return null;
  }
}

/** Re-render open windows in place. Core 0.9.0 keeps them from moving to the front. */
export async function refreshLiveWindows({ renderInBackground = backgroundRender() } = {}) {
  const results = await Promise.allSettled(Array.from(liveWindows, app => {
    if (!app?.rendered) return null;
    if (typeof renderInBackground === "function") return renderInBackground(app);
    return app.render({ force: false });
  }));
  for (const result of results) {
    if (result.status === "rejected") console.error(`${MODULE_ID} | Could not refresh an open Downtime window.`, result.reason);
  }
}

/** Trailing refresh so an actor update and the later Session write render once, after both land. */
export function queueLiveWindowRefresh({ delayMs = 25, refresh = refreshLiveWindows } = {}) {
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh();
  }, delayMs);
}

export function downtimeStateSettingChanged(setting) {
  const key = typeof setting === "string" ? setting : setting?.key;
  return key === `${MODULE_ID}.${STATE_SETTING}`;
}
