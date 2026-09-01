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

test("adapter flattens system proficiency families and filters by an instructor's actual data", async () => {
  const actor = {
    uuid: "Actor.instructor",
    system: {
      skills: { ste: { value: 1 } }, tools: { thief: { value: 1 } },
      traits: { languages: { value: new Set(["dwarvish"]) }, armorProf: { value: new Set(["lgt"]) }, weaponProf: { value: new Set(["sim"]), mastery: { value: new Set(["dagger"]) } } }
    }
  };
  const choices = await adapter.listTrainingChoices({ actors: [actor] });
  assert.ok(choices.some(choice => choice.value === "language:dwarvish" && choice.instructorUuids === actor.uuid));
  assert.ok(choices.some(choice => choice.value === "toolProficiency:thief" && choice.label === "Thieves' Tools" && choice.instructorUuids === actor.uuid));
  assert.ok(choices.some(choice => choice.value === "weaponMastery:dagger" && choice.instructorUuids === actor.uuid));
  assert.ok(choices.some(choice => choice.value === "armorProficiency:plate" && choice.instructorUuids === ""));
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
