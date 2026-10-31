import test from "node:test";
import assert from "node:assert/strict";
import { createSourceItemProject } from "../scripts/activities/source-item/source-item-activity.mjs";
import { SourceItemResolutionService } from "../scripts/activities/source-item/source-item-resolution-service.mjs";
import {
  SOURCE_ITEM_ROLL_TYPE,
  installSourceItemRollCards,
  skillCheckFromRoll,
  sourceItemRollCard
} from "../scripts/activities/source-item/source-item-roll-request.mjs";

const input = {
  owner: { uuid: "Actor.hero", name: "Hero" },
  target: { uuid: "Compendium.magic.Item.sword", name: "Flame Tongue", rarity: "rare" },
  locationId: "city",
  checkSkill: "inv",
  investmentGp: 100,
  weeks: 1
};

test("a finished Source Item search requests the owner's Investigation roll", async () => {
  const project = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  const cards = [];
  const service = new SourceItemResolutionService({
    catalog: { randomItems: async () => [] },
    getRequests: () => ({ create: async card => cards.push(card) })
  });
  const pending = await service.requestRoll(project);
  assert.equal(pending.metadata.sourceItem.outcome, null);
  assert.equal(pending.metadata.sourceItem.pendingRoll, true);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].type, SOURCE_ITEM_ROLL_TYPE);
  assert.equal(cards[0].actorUuid, "Actor.hero");
  assert.equal(cards[0].data.skill, "inv");
  assert.equal(cards[0].title, "Source Item · Investigation");
  assert.equal(cards[0].modes, false);
  assert.equal(sourceItemRollCard(project).key, "source-item:source");
});

test("the chat Roll button opens the native skill dialog and applies that roll", async () => {
  const previous = { game: globalThis.game, ui: globalThis.ui, Roll: globalThis.Roll, ChatMessage: globalThis.ChatMessage, foundry: globalThis.foundry };
  const gm = { id: "gm", active: true, isGM: true };
  globalThis.game = { user: gm, users: [gm], messages: { get: () => null } };
  globalThis.ui = { chat: { updateMessage() {} }, notifications: { error() {} } };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { return { total: this.formula === "1d4" ? 1 : 500 }; }
  };
  const posted = [];
  globalThis.ChatMessage = { create: async message => posted.push(message), getSpeaker: () => ({}) };
  globalThis.foundry = { applications: { handlebars: { renderTemplate: async () => "<p>result</p>" } } };
  const calls = [];
  const saved = [];
  const project = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  project.metadata.sourceItem.pendingRoll = true;
  const service = new SourceItemResolutionService({
    catalog: { randomItems: async () => [{ uuid: "a", name: "A", rarity: "common" }] },
    commit: async resolved => { saved.push(resolved); return resolved; }
  });
  const button = { closest(selector) { return selector === "[data-ml-core-roll]" ? button : null; } };
  const html = {
    dataset: {},
    listeners: [],
    addEventListener(_type, fn, capture) { this.listeners.push({ fn, capture }); }
  };
  const message = {
    id: "message-1",
    getFlag: () => sourceItemRollCard(project)
  };
  installSourceItemRollCards({
    hooks: { on(_event, fn) { fn(message, html); } },
    fromUuid: async () => ({ uuid: "Actor.hero", name: "Hero" }),
    rollSkill: async (actor, skill, options) => {
      calls.push({ actor, skill, options });
      return { cancelled: false, total: 18, naturalD20: 12 };
    },
    applyRoll: (projectId, roll, options) => service.applyRoll(project, roll, options)
  });
  assert.equal(html.listeners[0].capture, true);
  const event = { target: button, preventDefault() {}, stopPropagation() { event.stopped = true; } };
  await html.listeners[0].fn(event);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(event.stopped, true);
  assert.equal(calls[0].skill, "inv");
  assert.equal(calls[0].options.configure, true);
  assert.equal(calls[0].options.create, true);
  assert.deepEqual(skillCheckFromRoll(calls[0] && { cancelled: false, total: 18, naturalD20: 12 }), { naturalRoll: 12, skillModifier: 6 });
  assert.equal(saved[0].metadata.sourceItem.outcome.naturalRoll, 12);
  assert.equal(saved[0].metadata.sourceItem.outcome.skillModifier, 6);
  assert.equal(saved[0].metadata.sourceItem.outcome.total, 18);
  assert.equal(saved[0].metadata.sourceItem.outcome.success, false);
  assert.equal(saved[0].metadata.sourceItem.pendingRoll, false);
  assert.equal(posted.length, 1);
  assert.equal(skillCheckFromRoll({ cancelled: true }), null);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});
