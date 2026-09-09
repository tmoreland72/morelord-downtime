import test from "node:test";
import assert from "node:assert/strict";
import {
  applySourceItemPersuasion,
  createSourceItemProject,
  persuasionPriceAdjustment,
  resolveSourceItemProject,
  sourceItemPriceFormula,
  sourcingBonus
} from "../scripts/activities/source-item/source-item-activity.mjs";

const input = {
  owner: { uuid: "Actor.hero", name: "Hero" },
  target: { uuid: "Compendium.magic.Item.sword", name: "Flame Tongue", rarity: "rare" },
  locationId: "city",
  checkSkill: "inv",
  investmentGp: 600,
  weeks: 3
};

test("Source Item converts weeks to days and stacks investment bonuses", () => {
  const project = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  assert.equal(project.progress.elapsed.requiredDays, 21);
  assert.equal(project.metadata.sourceItem.dc, 20);
  assert.equal(project.metadata.sourceItem.bonus, 8);
  assert.equal(sourcingBonus({ investmentGp: 349, weeks: 1 }), 0);
  assert.equal(sourcingBonus({ investmentGp: 350, weeks: 2 }), 4);
});

test("successful sourcing reveals the hidden check and target price", async () => {
  const project = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  const resolved = await resolveSourceItemProject(project, {
    skillModifier: 5,
    rollD20: async () => 10,
    rollPrice: async () => 9500,
    rollAlternativeCount: async () => 4,
    getAlternatives: async () => { throw new Error("alternatives should not be requested"); }
  });
  assert.equal(resolved.metadata.sourceItem.outcome.success, true);
  assert.equal(resolved.metadata.sourceItem.outcome.total, 23);
  assert.equal(resolved.metadata.sourceItem.outcome.targetPriceGp, 9500);
});

test("failed sourcing requests Marketplace alternatives and prices each offer", async () => {
  const project = createSourceItemProject({ ...input, investmentGp: 100, weeks: 1 }, { idFactory: () => "source", now: () => 1 });
  const calls = [];
  const resolved = await resolveSourceItemProject(project, {
    skillModifier: 2,
    rollD20: async () => 5,
    rollPrice: async rarity => rarity === "uncommon" ? 300 : 40,
    rollAlternativeCount: async () => 2,
    getAlternatives: async (rarity, excludeUuid, count) => {
      calls.push({ rarity, excludeUuid, count });
      return [
        { uuid: "a", name: "A", rarity: "uncommon" },
        { uuid: "b", name: "B", rarity: "common" }
      ];
    }
  });
  assert.deepEqual(calls, [{ rarity: "rare", excludeUuid: input.target.uuid, count: 2 }]);
  assert.equal(resolved.metadata.sourceItem.outcome.success, false);
  assert.deepEqual(resolved.metadata.sourceItem.outcome.alternatives.map(item => item.priceGp), [300, 40]);
});

test("Persuasion bands adjust every revealed offer only once", () => {
  const project = createSourceItemProject(input, { idFactory: () => "source", now: () => 1 });
  project.metadata.sourceItem.outcome = { success: false, targetPriceGp: null, alternatives: [{ name: "A", priceGp: 1000 }] };
  const negotiated = applySourceItemPersuasion(project, { naturalRoll: 14, skillModifier: 4 });
  assert.equal(persuasionPriceAdjustment(18), -0.20);
  assert.equal(negotiated.metadata.sourceItem.outcome.alternatives[0].priceGp, 800);
  assert.throws(() => applySourceItemPersuasion(negotiated, { naturalRoll: 20 }), /already been attempted/);
});

test("rarity price formulas follow the sourcing table", () => {
  assert.equal(sourceItemPriceFormula("common"), "(1d6 + 1) * 10");
  assert.equal(sourceItemPriceFormula("uncommon"), "1d6 * 100");
  assert.equal(sourceItemPriceFormula("rare"), "2d10 * 1000");
  assert.equal(sourceItemPriceFormula("veryrare"), "(1d4 + 1) * 10000");
  assert.equal(sourceItemPriceFormula("legendary"), "2d6 * 25000");
});
