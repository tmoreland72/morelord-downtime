import test from "node:test";
import assert from "node:assert/strict";
import { createSourceItemProject } from "../scripts/activities/source-item/source-item-activity.mjs";
import { sourceItemApi } from "../scripts/activities/source-item/source-item-api.mjs";
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

test("applying Persuasion commits the negotiated Project and rejects a total that is not a number", async () => {
  const previous = { ChatMessage: globalThis.ChatMessage, foundry: globalThis.foundry, game: globalThis.game };
  globalThis.game = { messages: { get: () => null } };
  globalThis.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
  globalThis.foundry = { applications: { handlebars: { renderTemplate: async () => "<p>persuasion</p>" } } };
  const committed = [];
  const service = new SourceItemResolutionService({
    catalog: {},
    commit: async project => {
      if (project == null || typeof project.then === "function" || !project.id) throw new Error("Project not found.");
      committed.push(project);
      return project;
    }
  });
  const project = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  project.metadata.sourceItem.outcome = { success: true, targetPriceGp: 1000, alternatives: [] };
  const saved = await service.applyPersuasion(project, { naturalRoll: 15, skillModifier: 0 });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, "source");
  assert.equal(saved.metadata.sourceItem.persuasion.total, 15);
  assert.equal(saved.metadata.sourceItem.outcome.targetPriceGp, 1100);
  const untouched = structuredClone(project);
  await assert.rejects(() => service.applyPersuasion(untouched, { naturalRoll: Number.NaN }), /not a number/);
  assert.equal(untouched.metadata.sourceItem.outcome.targetPriceGp, 1000);
  assert.equal(untouched.metadata.sourceItem.persuasion, null);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

test("public Source Item negotiate passes the roll through", async () => {
  const calls = [];
  const api = sourceItemApi({
    createSourceItem: async () => null,
    negotiateSourceItem: async (projectId, roll) => {
      calls.push({ projectId, roll });
      return { projectId, roll };
    }
  });
  const roll = { naturalRoll: 12, skillModifier: 3 };
  const result = await api.negotiate("source-1", roll);
  assert.deepEqual(calls, [{ projectId: "source-1", roll }]);
  assert.equal(result.roll.naturalRoll, 12);
  assert.equal(result.roll.skillModifier, 3);
});

test("the success chat card names the pickup location and a blank location omits that line", async () => {
  const previous = { Roll: globalThis.Roll, ChatMessage: globalThis.ChatMessage, foundry: globalThis.foundry, game: globalThis.game };
  globalThis.game = { messages: { get: () => null } };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { return { total: this.formula === "1d4" ? 1 : 500 }; }
  };
  globalThis.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
  const rendered = [];
  globalThis.foundry = {
    applications: { handlebars: { renderTemplate: async (path, data) => { rendered.push({ path, data }); return "<p>result</p>"; } } }
  };
  const service = new SourceItemResolutionService({
    catalog: { randomItems: async () => [{ uuid: "a", name: "A", rarity: "common" }] },
    commit: async resolved => resolved,
    getLocation: id => ({ id, name: id === "neverwinter" ? "Neverwinter" : "City" })
  });
  const found = createSourceItemProject({ ...input, locationId: "neverwinter" }, { idFactory: () => "source", now: () => 1 });
  await service.applyRoll(found, { naturalRoll: 18, skillModifier: 4 });
  const successCard = rendered.find(entry => String(entry.path).endsWith("source-item-result.hbs"));
  assert.equal(successCard.data.success, true);
  assert.equal(successCard.data.collectionMessage, "The item must be picked up at Neverwinter.");

  rendered.length = 0;
  const unassigned = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  unassigned.locationId = null;
  await service.applyRoll(unassigned, { naturalRoll: 18, skillModifier: 4 });
  const blankCard = rendered.find(entry => String(entry.path).endsWith("source-item-result.hbs"));
  assert.equal(blankCard.data.success, true);
  assert.equal(blankCard.data.collectionMessage, "No location is assigned.");
  assert.equal(String(blankCard.data.collectionMessage).includes("picked up"), false);

  rendered.length = 0;
  const missed = createSourceItemProject({ ...input, locationId: "neverwinter" }, { idFactory: () => "source", now: () => 1 });
  await service.applyRoll(missed, { naturalRoll: 1, skillModifier: 0 });
  const failedCard = rendered.find(entry => String(entry.path).endsWith("source-item-result.hbs"));
  assert.equal(failedCard.data.success, false);
  assert.equal(failedCard.data.collectionMessage, null);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});
