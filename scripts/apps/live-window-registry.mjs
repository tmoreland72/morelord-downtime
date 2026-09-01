const liveWindows = new Set();
let refreshTimer = null;

export function registerLiveWindow(app) {
  liveWindows.add(app);
  return app;
}

export function unregisterLiveWindow(app) {
  liveWindows.delete(app);
}

export async function refreshLiveWindows() {
  const results = await Promise.allSettled(Array.from(liveWindows, app => app.render({ force: true })));
  for (const result of results) {
    if (result.status === "rejected") console.error("morelord-downtime | Could not refresh an open Downtime window.", result.reason);
  }
}

export function queueLiveWindowRefresh({ delayMs = 25 } = {}) {
  if (refreshTimer !== null) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshLiveWindows();
  }, delayMs);
}
