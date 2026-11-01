import test from "node:test";
import assert from "node:assert/strict";
import { assertPlayerTrainingHours, trainingDefault, commissionDefault } from "../scripts/domain/project-defaults.mjs";

test("training defaults use positive Intelligence only and identify GM extensions", () => {
  assert.equal(trainingDefault("language", 3).hours, 280);
  assert.equal(trainingDefault("toolProficiency", -2).hours, 400);
  assert.equal(trainingDefault("language", 15).hours, 40);
  for (const kind of ["skillProficiency", "armorProficiency", "weaponProficiency", "weaponMastery"]) {
    assert.match(trainingDefault(kind, 2).guidance, /GM-defined/);
    assert.equal(trainingDefault(kind, 2).hours, 320);
  }
});

test("only a GM can change training required hours", () => {
  assert.doesNotThrow(() => assertPlayerTrainingHours({ isGm: false, requestedHours: 400, allowedHours: 400 }));
  assert.doesNotThrow(() => assertPlayerTrainingHours({ isGm: true, requestedHours: 12, allowedHours: 400 }));
  assert.throws(
    () => assertPlayerTrainingHours({ isGm: false, requestedHours: 12, allowedHours: 400 }),
    /Only a GM can change the training's required hours/
  );
});

test("commission estimates handle rarity formats, consumables, mundane prices and exceptions", () => {
  for (const [rarity, days] of Object.entries({ common: 5, uncommon: 10, rare: 50, veryrare: 125, legendary: 250 })) {
    assert.equal(commissionDefault({ type: "equipment", system: { rarities: new Set([rarity]) } }).days, days);
  }
  assert.equal(commissionDefault({ type: "consumable", system: { rarity: "rare" } }).days, 25);
  assert.equal(commissionDefault({ type: "equipment", system: { price: { value: 1500, denomination: "gp" } } }).days, 150);
  assert.equal(commissionDefault({ system: { price: { value: 50, denomination: "sp" } } }).days, 1);
  assert.equal(commissionDefault({ system: { rarity: "artifact" } }).days, null);
  assert.equal(commissionDefault({ system: { rarity: "rare", type: { value: "scroll" } } }).days, null);
});
