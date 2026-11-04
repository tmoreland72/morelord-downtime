import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { itemCard as coreItemCard } from "../../morelord-core/scripts/ui/item-card.js";
import { createSourceItemProject } from "../scripts/activities/source-item/source-item-activity.mjs";
import { SourceItemResolutionService } from "../scripts/activities/source-item/source-item-resolution-service.mjs";

const input = {
  owner: { uuid: "Actor.hero", name: "Hero" },
  target: { uuid: "Compendium.magic.Item.sword", name: "Flame Tongue", rarity: "rare" },
  locationId: "neverwinter",
  checkSkill: "inv",
  investmentGp: 100,
  weeks: 1
};

function priceLabel(priceGp) {
  return `${Number(priceGp).toLocaleString()} gp`;
}

function installChat({ itemCard = null } = {}) {
  const posted = [];
  const rendered = [];
  const calls = [];
  const previous = {
    game: globalThis.game,
    Roll: globalThis.Roll,
    ChatMessage: globalThis.ChatMessage,
    foundry: globalThis.foundry,
    MorelordCore: globalThis.MorelordCore
  };
  globalThis.game = { messages: { get: () => null } };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { return { total: this.formula === "1d4" ? 1 : 500 }; }
  };
  globalThis.ChatMessage = { create: async message => posted.push(message), getSpeaker: () => ({}) };
  globalThis.foundry = {
    applications: {
      handlebars: {
        renderTemplate: async (path, data) => {
          rendered.push({ path, data });
          return `<section class="ml-chat-card ml-source-item-chat">${data.projectName ?? ""} ${data.itemsHTML ?? ""}</section>`;
        }
      }
    }
  };
  if (itemCard) {
    globalThis.MorelordCore = {
      ui: {
        itemCard(opts) {
          calls.push(structuredClone(opts));
          return itemCard(opts);
        }
      }
    };
  } else if (itemCard === null) delete globalThis.MorelordCore;
  return {
    posted,
    rendered,
    calls,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  };
}

function project(locationId = "neverwinter") {
  return createSourceItemProject({ ...input, locationId }, { idFactory: () => "source", now: () => 1 });
}

function assertRowsOnly(call, rows) {
  assert.deepEqual(Object.keys(call).sort(), ["emptyText", "items"]);
  assert.equal(rows.includes("ml-award-card__header"), false);
  assert.equal(rows.includes("ml-award-card__title"), false);
  assert.equal(rows.includes("ml-award-card__subtitle"), false);
  assert.match(rows, /ml-award-card__items|ml-award-card__empty/);
}

test("the result card keeps its text and uses item rows for the offers", async () => {
  const chat = installChat({ itemCard: coreItemCard });
  try {
    const service = new SourceItemResolutionService({
      catalog: { randomItems: async () => [] },
      commit: async resolved => resolved,
      getLocation: () => ({ id: "neverwinter", name: "Neverwinter & Co" })
    });
    const saved = await service.applyRoll(project(), { naturalRoll: 18, skillModifier: 4 });
    const value = priceLabel(saved.metadata.sourceItem.outcome.targetPriceGp);
    const result = chat.rendered.find(entry => String(entry.path).endsWith("source-item-result.hbs"));
    assert.equal(chat.calls.length, 1);
    assert.deepEqual(chat.calls[0], {
      items: [{
        uuid: "Compendium.magic.Item.sword",
        name: "Flame Tongue",
        img: "",
        rarity: "rare",
        quantity: 1,
        value
      }],
      emptyText: "No eligible alternatives were available."
    });
    assertRowsOnly(chat.calls[0], result.data.itemsHTML);
    assert.equal(result.data.success, true);
    assert.equal(result.data.ownerName, "Hero");
    assert.equal(result.data.total, 22);
    assert.equal(result.data.dc, 20);
    assert.equal(result.data.collectionMessage, "The item must be picked up at Neverwinter & Co.");
    assert.ok(result.data.itemsHTML.includes(`ml-award-card__item-value">${value}`));
    assert.match(chat.posted[0].content, /ml-chat-card ml-source-item-chat/);
    assert.equal(chat.posted[0].content.includes("ml-award-card__header"), false);
    assert.equal(chat.posted[0].content.includes("<section class=\"ml-chat-card ml-award-card\">"), false);

    chat.calls.length = 0;
    chat.rendered.length = 0;
    const missed = await service.applyRoll(
      createSourceItemProject(input, { idFactory: () => "missed", now: () => 1 }),
      { naturalRoll: 1, skillModifier: 0 }
    );
    const failed = chat.rendered.at(-1);
    assert.equal(missed.metadata.sourceItem.outcome.alternatives.length, 0);
    assert.deepEqual(chat.calls[0], { items: [], emptyText: "No eligible alternatives were available." });
    assert.equal(failed.data.success, false);
    assert.equal(failed.data.collectionMessage, null);
    assert.match(failed.data.itemsHTML, /<p class="ml-award-card__empty">No eligible alternatives were available\.<\/p>/);
    assert.equal(failed.data.itemsHTML.includes("ml-award-card__header"), false);
  } finally {
    chat.restore();
  }
});

test("a missed search lists alternative prices in the item rows", async () => {
  const chat = installChat({ itemCard: coreItemCard });
  try {
    const service = new SourceItemResolutionService({
      catalog: {
        randomItems: async () => [
          { uuid: "Item.a", name: "A & B", img: "icons/a.webp", rarity: "common" },
          { uuid: "Item.b", name: "Cloak", rarity: "uncommon", rarityLabel: "Uncommon" }
        ]
      },
      commit: async resolved => resolved,
      getLocation: () => ({ id: "neverwinter", name: "Neverwinter" })
    });
    const saved = await service.applyRoll(project(), { naturalRoll: 1, skillModifier: 0 });
    const offers = saved.metadata.sourceItem.outcome.alternatives;
    const result = chat.rendered[0];
    assert.equal(result.data.success, false);
    assert.equal(result.data.collectionMessage, null);
    assert.deepEqual(chat.calls[0].items, [
      { uuid: "Item.a", name: "A & B", img: "icons/a.webp", rarity: "common", quantity: 1, value: priceLabel(offers[0].priceGp) },
      { uuid: "Item.b", name: "Cloak", img: "", rarity: "uncommon", quantity: 1, value: priceLabel(offers[1].priceGp) }
    ]);
    assertRowsOnly(chat.calls[0], result.data.itemsHTML);
    assert.ok(result.data.itemsHTML.includes(`ml-award-card__item-value">${priceLabel(offers[0].priceGp)}`));
    assert.match(result.data.itemsHTML, /@UUID\[Item\.a\]\{A &amp; B\}/);
    assert.match(result.data.itemsHTML, /ml-award-card__item-rarity">Uncommon</);
  } finally {
    chat.restore();
  }
});

test("the persuasion outcome keeps its text and uses item rows for the adjusted prices", async () => {
  const chat = installChat({ itemCard: coreItemCard });
  try {
    const service = new SourceItemResolutionService({
      catalog: {},
      commit: async resolved => resolved
    });
    const current = project();
    current.metadata.sourceItem.outcome = { success: true, targetPriceGp: 1000, alternatives: [] };
    const saved = await service.applyPersuasion(current, { naturalRoll: 15, skillModifier: 0 });
    const persuasion = chat.rendered.find(entry => String(entry.path).endsWith("source-item-persuasion.hbs"));
    assert.equal(saved.metadata.sourceItem.outcome.targetPriceGp, 1100);
    assert.equal(persuasion.data.ownerName, "Hero");
    assert.equal(persuasion.data.total, 15);
    assert.equal(persuasion.data.dc, 20);
    assert.equal(persuasion.data.tierLabel, "Fail by 5 or more");
    assert.equal(persuasion.data.adjustmentLabel, "+10%");
    assert.deepEqual(chat.calls[0], {
      items: [{
        uuid: "Compendium.magic.Item.sword",
        name: "Flame Tongue",
        img: "",
        rarity: "rare",
        quantity: 1,
        value: priceLabel(1100)
      }],
      emptyText: "No offers were adjusted."
    });
    assertRowsOnly(chat.calls[0], persuasion.data.itemsHTML);
    assert.ok(persuasion.data.itemsHTML.includes(`ml-award-card__item-value">${priceLabel(1100)}`));
    assert.match(chat.posted[0].content, /ml-source-item-chat/);
    assert.equal(chat.posted[0].content.includes("ml-award-card__header"), false);
  } finally {
    chat.restore();
  }
});

test("without itemCard the result and persuasion cards keep their templates", async () => {
  const chat = installChat({ itemCard: false });
  globalThis.MorelordCore = { ui: {} };
  try {
    const service = new SourceItemResolutionService({
      catalog: { randomItems: async () => [{ uuid: "Item.a", name: "Torch", img: "icons/torch.webp", rarity: "common", rarityLabel: "Common" }] },
      commit: async resolved => resolved,
      getLocation: () => ({ id: "neverwinter", name: "Neverwinter" })
    });
    const found = await service.applyRoll(project(), { naturalRoll: 18, skillModifier: 4 });
    const result = chat.rendered.find(entry => String(entry.path).endsWith("source-item-result.hbs"));
    assert.equal(chat.calls.length, 0);
    assert.equal(result.data.itemsHTML, undefined);
    assert.equal(result.data.success, true);
    assert.equal(result.data.ownerName, "Hero");
    assert.equal(result.data.collectionMessage, "The item must be picked up at Neverwinter.");
    assert.equal(result.data.total, 22);
    assert.equal(result.data.dc, 20);
    assert.equal(result.data.items[0].priceLabel, priceLabel(found.metadata.sourceItem.outcome.targetPriceGp));
    assert.equal(result.data.items[0].name, "Flame Tongue");
    assert.match(chat.posted[0].content, /ml-source-item-chat/);

    chat.rendered.length = 0;
    const missed = await service.applyRoll(project(), { naturalRoll: 1, skillModifier: 0 });
    const failed = chat.rendered.at(-1);
    assert.equal(failed.data.itemsHTML, undefined);
    assert.equal(failed.data.success, false);
    assert.equal(failed.data.collectionMessage, null);
    assert.equal(failed.data.items[0].rarityLabel, "Common");
    assert.equal(failed.data.items[0].priceLabel, priceLabel(missed.metadata.sourceItem.outcome.alternatives[0].priceGp));

    chat.rendered.length = 0;
    const negotiated = project();
    negotiated.metadata.sourceItem.outcome = { success: false, targetPriceGp: null, alternatives: [{ uuid: "Item.a", name: "Torch", rarity: "common", rarityLabel: "Common", priceGp: 40 }] };
    await service.applyPersuasion(negotiated, { naturalRoll: 25, skillModifier: 0 });
    const persuasion = chat.rendered.find(entry => String(entry.path).endsWith("source-item-persuasion.hbs"));
    assert.equal(persuasion.data.itemsHTML, undefined);
    assert.equal(persuasion.data.tierLabel, "Beat the DC by 5 to 9");
    assert.equal(persuasion.data.adjustmentLabel, "-10%");
    assert.equal(persuasion.data.total, 25);
    assert.equal(persuasion.data.dc, 20);
    assert.equal(persuasion.data.items[0].priceLabel, priceLabel(36));
  } finally {
    chat.restore();
  }
});

test("the chat templates keep their headers and the roll requests stay off itemCard", async () => {
  const result = await readFile(new URL("../templates/chat/source-item-result.hbs", import.meta.url), "utf8");
  const persuasion = await readFile(new URL("../templates/chat/source-item-persuasion.hbs", import.meta.url), "utf8");
  const rolls = await readFile(new URL("../scripts/activities/source-item/source-item-roll-request.mjs", import.meta.url), "utf8");
  assert.match(result, /<h2>\{\{projectName\}\}<\/h2><p>\{\{ownerName\}\} rolled \{\{total\}\} against DC \{\{dc\}\}\.<\/p>/);
  assert.match(result, /Requested item found\./);
  assert.match(result, /\{\{collectionMessage\}\}/);
  assert.match(result, /\{\{#if itemsHTML\}\}\{\{\{itemsHTML\}\}\}\{\{else\}\}/);
  assert.match(result, /ml-source-item-chat__items/);
  assert.match(persuasion, /rolled Persuasion \{\{total\}\} against DC \{\{dc\}\}/);
  assert.match(persuasion, /\{\{tierLabel\}\}\. Price adjustment \{\{adjustmentLabel\}\}/);
  assert.match(persuasion, /\{\{#if itemsHTML\}\}\{\{\{itemsHTML\}\}\}\{\{else\}\}/);
  assert.equal(rolls.includes("itemCard"), false);
  assert.match(rolls, /actionLabel: "Roll"/);
});
