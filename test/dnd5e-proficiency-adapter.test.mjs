import test from "node:test";
import assert from "node:assert/strict";
import { Dnd5eProficiencyAdapter } from "../scripts/adapters/dnd5e-proficiency-adapter.mjs";

const config = {
  skills: { ste: { label: "Stealth" } },
  enrichmentLookup: { languages: { common: "Common", dwarvish: "Dwarvish" } },
  armorProficiencies: { lgt: "Light Armor" }, armorIds: { plate: "Item.plate" }, shieldIds: {},
  weaponProficiencies: { sim: "Simple Weapons" }, weaponIds: { dagger: "Item.dagger" },
  toolProficiencies: { art: "Artisan's Tools" }, tools: { thief: { id: "Item.thief", ability: "dex" } }
};
const documents = { "Item.plate": { name: "Plate Armor" }, "Item.dagger": { name: "Dagger" }, "Item.thief": { name: "Thieves' Tools" } };
const adapter = new Dnd5eProficiencyAdapter({ config, resolveUuid: uuid => documents[uuid], localize: value => value });

test("training choices use the fixed 2024 list and ignore CONFIG extras and compendium names", async () => {
  const actor = {
    uuid: "Actor.instructor",
    system: {
      skills: { ste: { value: 1 }, homebrew: { value: 1 } }, tools: { thief: { value: 1 } },
      traits: { languages: { value: new Set(["dwarvish"]) }, armorProf: { value: new Set(["lgt"]) }, weaponProf: { value: new Set(["sim"]), mastery: { value: new Set(["dagger"]) } } }
    }
  };
  const choices = await adapter.listTrainingChoices({ actors: [actor] });
  assert.equal(choices.some(choice => choice.id === "homebrew" || choice.label === "Sneaking"), false);
  assert.equal(choices.find(choice => choice.value === "skillProficiency:ste").label, "Stealth");
  assert.equal(choices.find(choice => choice.value === "language:sign").label, "Common Sign Language");
  assert.equal(choices.find(choice => choice.value === "language:dwarvish").instructorUuids, actor.uuid);
  assert.equal(choices.find(choice => choice.value === "toolProficiency:thief").label, "Thieves' Tools");
  assert.equal(choices.find(choice => choice.value === "toolProficiency:thief").instructorUuids, actor.uuid);
  assert.equal(choices.find(choice => choice.value === "weaponMastery:dagger").id, choices.find(choice => choice.value === "weaponProficiency:dagger").id);
  assert.equal(choices.find(choice => choice.value === "weaponMastery:dagger").instructorUuids, actor.uuid);
  assert.equal(choices.find(choice => choice.value === "armorProficiency:plate").label, "Plate Armor");
  assert.equal(choices.find(choice => choice.value === "armorProficiency:plate").instructorUuids, "");
});

test("training choices prefer Core's catalog when it is exposed", async () => {
  const coreAdapter = new Dnd5eProficiencyAdapter({
    catalog: () => [{ kind: "language", id: "sign", label: "Common Sign Language", category: "Language" }]
  });
  const choices = await coreAdapter.listTrainingChoices();
  assert.deepEqual(choices.map(choice => choice.value), ["language:sign"]);
});

test("adapter awards set and mapping proficiencies, creating a missing tool record", async () => {
  const updates = [];
  const actor = {
    uuid: "Actor.student",
    system: { tools: {}, skills: { ste: { value: 0 } }, traits: { armorProf: { value: new Set(["lgt"]) } } },
    update: async update => updates.push(update)
  };
  assert.equal((await adapter.award(actor, "toolProficiency", "thief")).awarded, true);
  assert.deepEqual(updates[0], { "system.tools.thief": { value: 1, ability: "dex" } });
  await adapter.award(actor, "skillProficiency", "ste");
  assert.deepEqual(updates[1], { "system.skills.ste.value": 1 });
  await adapter.award(actor, "armorProficiency", "plate");
  assert.deepEqual(updates[2], { "system.traits.armorProf.value": ["lgt", "plate"] });
});
