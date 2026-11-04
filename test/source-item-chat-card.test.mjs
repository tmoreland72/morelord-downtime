import test from "node:test";
import assert from "node:assert/strict";
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
    applications: { handlebars: { renderTemplate: async (path, data) => { rendered.push({ path, data }); return "<p>template</p>"; } } }
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

test("the result card uses itemCard and puts each offer price in value", async () => {
  const chat = installChat({ itemCard: coreItemCard });
  try {
    const service = new SourceItemResolutionService({
      catalog: { randomItems: async () => [] },
      commit: async resolved => resolved,
      getLocation: () => ({ id: "neverwinter", name: "Neverwinter & Co" })
    });
    const saved = await service.applyRoll(project(), { naturalRoll: 18, skillModifier: 4 });
    const value = priceLabel(saved.metadata.sourceItem.outcome.targetPriceGp);
    assert.equal(chat.rendered.length, 0);
    assert.equal(chat.calls.length, 1);
    assert.equal(chat.calls[0].actionsHTML, undefined);
    assert.deepEqual(chat.calls[0], {
      title: "Source Flame Tongue",
      icon: "fa-solid fa-suitcase",
      recipientName: "Hero",
      subtitle: "Hero rolled 22 against DC 20.",
      items: [{
        uuid: "Compendium.magic.Item.sword",
        name: "Flame Tongue",
        img: "",
        rarity: "rare",
        quantity: 1,
        value
      }],
      emptyText: "No eligible alternatives were available.",
      bodyHTML: "<p><strong>Requested item found.</strong></p><p>The item must be picked up at Neverwinter &amp; Co.</p>"
    });
    assert.match(chat.posted[0].content, /<section class="ml-chat-card ml-award-card">/);
    assert.ok(chat.posted[0].content.includes(`ml-award-card__item-value">${value}`));
    assert.equal(chat.posted[0].content.includes("ml-source-item-chat"), false);

    chat.calls.length = 0;
    chat.posted.length = 0;
    const missed = await service.applyRoll(
      createSourceItemProject(input, { idFactory: () => "missed", now: () => 1 }),
      { naturalRoll: 1, skillModifier: 0 }
    );
    const offers = missed.metadata.sourceItem.outcome.alternatives;
    assert.equal(chat.rendered.length, 0);
    assert.equal(chat.calls[0].subtitle, "Hero rolled 1 against DC 20.");
    assert.deepEqual(chat.calls[0].items, []);
    assert.equal(chat.calls[0].emptyText, "No eligible alternatives were available.");
    assert.equal(chat.calls[0].bodyHTML, "<p><strong>Requested item not found; alternative offers are available.</strong></p>");
    assert.equal(offers.length, 0);
    assert.match(chat.posted[0].content, /ml-award-card__empty">No eligible alternatives were available\./);
  } finally {
    chat.restore();
  }
});

test("a missed search lists alternative prices in value", async () => {
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
    assert.equal(chat.rendered.length, 0);
    assert.deepEqual(chat.calls[0].items, [
      { uuid: "Item.a", name: "A & B", img: "icons/a.webp", rarity: "common", quantity: 1, value: priceLabel(offers[0].priceGp) },
      { uuid: "Item.b", name: "Cloak", img: "", rarity: "uncommon", quantity: 1, value: priceLabel(offers[1].priceGp) }
    ]);
    assert.equal(chat.calls[0].bodyHTML, "<p><strong>Requested item not found; alternative offers are available.</strong></p>");
    assert.ok(chat.posted[0].content.includes(`ml-award-card__item-value">${priceLabel(offers[0].priceGp)}`));
    assert.match(chat.posted[0].content, /@UUID\[Item\.a\]\{A &amp; B\}/);
    assert.match(chat.posted[0].content, /ml-award-card__item-rarity">Uncommon</);
  } finally {
    chat.restore();
  }
});

test("the persuasion card uses itemCard and puts the adjusted price in value", async () => {
  const chat = installChat({ itemCard: coreItemCard });
  try {
    const service = new SourceItemResolutionService({
      catalog: {},
      commit: async resolved => resolved
    });
    const current = project();
    current.metadata.sourceItem.outcome = { success: true, targetPriceGp: 1000, alternatives: [] };
    const saved = await service.applyPersuasion(current, { naturalRoll: 15, skillModifier: 0 });
    assert.equal(saved.metadata.sourceItem.outcome.targetPriceGp, 1100);
    assert.equal(chat.rendered.length, 0);
    assert.deepEqual(chat.calls[0], {
      title: "Source Flame Tongue",
      icon: "fa-solid fa-suitcase",
      recipientName: "Hero",
      subtitle: "Hero rolled Persuasion 15 against DC 20.",
      items: [{
        uuid: "Compendium.magic.Item.sword",
        name: "Flame Tongue",
        img: "",
        rarity: "rare",
        quantity: 1,
        value: priceLabel(1100)
      }],
      emptyText: "No offers were adjusted.",
      bodyHTML: "<p><strong>Fail by 5 or more. Price adjustment +10%.</strong></p>"
    });
    assert.match(chat.posted[0].content, /<section class="ml-chat-card ml-award-card">/);
    assert.ok(chat.posted[0].content.includes(`ml-award-card__item-value">${priceLabel(1100)}`));
    assert.match(chat.posted[0].content, /Fail by 5 or more\. Price adjustment \+10%\./);
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
    assert.equal(chat.posted[0].content, "<p>template</p>");
    assert.equal(result.data.success, true);
    assert.equal(result.data.ownerName, "Hero");
    assert.equal(result.data.collectionMessage, "The item must be picked up at Neverwinter.");
    assert.equal(result.data.total, 22);
    assert.equal(result.data.dc, 20);
    assert.equal(result.data.items[0].priceLabel, priceLabel(found.metadata.sourceItem.outcome.targetPriceGp));
    assert.equal(result.data.items[0].name, "Flame Tongue");

    chat.rendered.length = 0;
    chat.posted.length = 0;
    const missed = await service.applyRoll(project(), { naturalRoll: 1, skillModifier: 0 });
    const failed = chat.rendered.at(-1);
    assert.equal(String(failed.path).endsWith("source-item-result.hbs"), true);
    assert.equal(failed.data.success, false);
    assert.equal(failed.data.collectionMessage, null);
    assert.equal(failed.data.items[0].rarityLabel, "Common");
    assert.equal(failed.data.items[0].priceLabel, priceLabel(missed.metadata.sourceItem.outcome.alternatives[0].priceGp));

    chat.rendered.length = 0;
    const negotiated = project();
    negotiated.metadata.sourceItem.outcome = { success: false, targetPriceGp: null, alternatives: [{ uuid: "Item.a", name: "Torch", rarity: "common", rarityLabel: "Common", priceGp: 40 }] };
    await service.applyPersuasion(negotiated, { naturalRoll: 25, skillModifier: 0 });
    const persuasion = chat.rendered.find(entry => String(entry.path).endsWith("source-item-persuasion.hbs"));
    assert.equal(persuasion.data.tierLabel, "Beat the DC by 5 to 9");
    assert.equal(persuasion.data.adjustmentLabel, "-10%");
    assert.equal(persuasion.data.total, 25);
    assert.equal(persuasion.data.dc, 20);
    assert.equal(persuasion.data.items[0].priceLabel, priceLabel(36));
    assert.equal(chat.posted.at(-1).content, "<p>template</p>");
  } finally {
    chat.restore();
  }
});
