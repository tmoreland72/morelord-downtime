import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { queueLiveWindowRefresh, refreshLiveWindows, registerLiveWindow, unregisterLiveWindow } from "../scripts/apps/live-window-registry.mjs";

test("open windows re-render through Core without forcing focus", async () => {
  const seen = [];
  const app = { rendered: true, render: () => { throw new Error("direct render"); }, bringToFront() { seen.push("front"); } };
  registerLiveWindow(app);
  try {
    await refreshLiveWindows({ renderInBackground: application => { seen.push(application); return "background"; } });
    assert.deepEqual(seen, [app]);
  } finally {
    unregisterLiveWindow(app);
  }
});

test("without Core, a background refresh uses force false", async () => {
  const calls = [];
  const app = { rendered: true, render(options) { calls.push(options); return this; } };
  registerLiveWindow(app);
  const previousGame = globalThis.game;
  const previousCore = globalThis.MorelordCore;
  globalThis.game = { modules: { get: () => null } };
  globalThis.MorelordCore = undefined;
  try {
    await refreshLiveWindows();
    assert.deepEqual(calls, [{ force: false }]);
  } finally {
    unregisterLiveWindow(app);
    globalThis.game = previousGame;
    globalThis.MorelordCore = previousCore;
  }
});

test("a burst of crafting updates refreshes once after the last change", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const runs = [];
  try {
    queueLiveWindowRefresh({ delayMs: 25, refresh: () => runs.push("actor") });
    queueLiveWindowRefresh({ delayMs: 25, refresh: () => runs.push("session") });
    assert.deepEqual(runs, []);
    mock.timers.tick(24);
    assert.deepEqual(runs, []);
    mock.timers.tick(1);
    assert.deepEqual(runs, ["session"]);
  } finally {
    mock.timers.reset();
  }
});
