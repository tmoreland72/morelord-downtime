import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addMorelordTool, morelordToolKey } from "../scripts/integrations/core-api.mjs";
import { DOWNTIME_SCENE_TOOL, openDowntimeSceneTool } from "../scripts/integrations/downtime-scene-tool.mjs";

const previous = {};

function rememberGlobals() {
  for (const name of ["Hooks", "game", "ui", "MorelordCore", "MorelordDowntime"]) {
    previous[name] = globalThis[name];
  }
}

function restoreGlobals() {
  for (const [name, value] of Object.entries(previous)) globalThis[name] = value;
}

function hookBus() {
  const once = [];
  const on = [];
  globalThis.Hooks = {
    once(event, callback) { once.push({ event, callback }); },
    on(event, callback) { on.push({ event, callback }); }
  };
  return {
    fire(event, ...args) {
      for (const entry of [...once, ...on]) {
        if (entry.event === event) entry.callback(...args);
      }
    },
    on
  };
}

describe("Morelord Tools registration", { concurrency: false }, () => {
  test("scene-control keys keep today's Token palette names", () => {
    assert.equal(morelordToolKey("morelord-downtime"), "morelordDowntime");
    assert.equal(morelordToolKey("morelord-craftworks"), "morelordCraftworks");
  });

  test("Downtime stays visible to everyone at order 40", () => {
    assert.equal(DOWNTIME_SCENE_TOOL.id, "morelord-downtime");
    assert.equal(DOWNTIME_SCENE_TOOL.title, "Morelord Downtime");
    assert.equal(DOWNTIME_SCENE_TOOL.icon, "fa-solid fa-timer");
    assert.equal(DOWNTIME_SCENE_TOOL.order, 40);
    assert.equal(DOWNTIME_SCENE_TOOL.visible(), true);
    assert.equal(DOWNTIME_SCENE_TOOL.onClick, openDowntimeSceneTool);
  });

  test("requires Morelord Core 0.6.0", () => {
    const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    const core = manifest.relationships.requires.find(entry => entry.id === "morelord-core");
    assert.equal(manifest.version, "0.2.0");
    assert.equal(core.compatibility.minimum, "0.6.0");
  });

  test("registers with Core tools when the registry exists", () => {
    rememberGlobals();
    try {
      const bus = hookBus();
      const registered = [];
      const ignored = [];
      globalThis.game = {
        modules: {
          get: id => (id === "morelord-core" ? { api: { tools: { register: definition => registered.push(definition) } } } : null)
        }
      };
      globalThis.MorelordCore = { tools: { register: definition => ignored.push(definition) } };
      addMorelordTool(DOWNTIME_SCENE_TOOL);
      bus.fire("setup");
      assert.deepEqual(registered, [DOWNTIME_SCENE_TOOL]);
      assert.deepEqual(ignored, []);
      assert.equal(bus.on.length, 0);
    } finally {
      restoreGlobals();
    }
  });

  test("uses the MorelordCore tools global when the module api has no registry", () => {
    rememberGlobals();
    try {
      const bus = hookBus();
      const registered = [];
      globalThis.game = { modules: { get: () => ({ api: {} }) } };
      globalThis.MorelordCore = { tools: { register: definition => registered.push(definition) } };
      addMorelordTool(DOWNTIME_SCENE_TOOL);
      bus.fire("setup");
      assert.deepEqual(registered, [DOWNTIME_SCENE_TOOL]);
      assert.equal(bus.on.length, 0);
    } finally {
      restoreGlobals();
    }
  });

  test("keeps the Token palette button when Core is older than 0.6.0", () => {
    rememberGlobals();
    try {
      const bus = hookBus();
      const warnings = [];
      const opened = [];
      globalThis.game = { modules: { get: () => ({ api: { locations: {} } }) } };
      globalThis.MorelordCore = {};
      globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
      addMorelordTool(DOWNTIME_SCENE_TOOL);
      bus.fire("setup");
      const controls = { tokens: { tools: { select: {}, target: {} } } };
      bus.fire("getSceneControlButtons", controls);
      bus.fire("getSceneControlButtons", {});
      const tool = controls.tokens.tools.morelordDowntime;
      assert.equal(tool.name, "morelordDowntime");
      assert.equal(tool.title, "Morelord Downtime");
      assert.equal(tool.icon, "fa-solid fa-timer");
      assert.equal(tool.button, true);
      assert.equal(tool.visible, true);
      assert.equal(tool.order, 2);
      tool.onChange({ type: "click" });
      assert.deepEqual(warnings, ["Morelord Downtime is still initializing."]);
      globalThis.MorelordDowntime = { open: () => opened.push("dashboard") };
      tool.onChange({ type: "click" });
      assert.deepEqual(opened, ["dashboard"]);
    } finally {
      restoreGlobals();
    }
  });

  test("hides a legacy tool when its visibility check returns false", () => {
    rememberGlobals();
    try {
      const bus = hookBus();
      globalThis.game = { modules: { get: () => null } };
      delete globalThis.MorelordCore;
      addMorelordTool({
        id: "morelord-downtime",
        title: "Morelord Downtime",
        icon: "fa-solid fa-timer",
        order: 40,
        visible: () => false,
        onClick: () => {}
      });
      bus.fire("setup");
      const controls = { tokens: { tools: {} } };
      bus.fire("getSceneControlButtons", controls);
      assert.equal(controls.tokens.tools.morelordDowntime.visible, false);
      assert.equal(controls.tokens.tools.morelordDowntime.order, 0);
    } finally {
      restoreGlobals();
    }
  });

  test("open uses the module api and warns until it is ready", () => {
    rememberGlobals();
    try {
      const warnings = [];
      const opened = [];
      globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
      globalThis.game = { modules: { get: () => null } };
      delete globalThis.MorelordDowntime;
      openDowntimeSceneTool();
      assert.deepEqual(warnings, ["Morelord Downtime is still initializing."]);
      globalThis.MorelordDowntime = {};
      openDowntimeSceneTool();
      assert.equal(warnings.length, 2);
      delete globalThis.MorelordDowntime;
      globalThis.game = {
        modules: {
          get: id => (id === "morelord-downtime" ? { api: { open: () => opened.push(id) } } : null)
        }
      };
      openDowntimeSceneTool();
      assert.deepEqual(opened, ["morelord-downtime"]);
    } finally {
      restoreGlobals();
    }
  });
});
