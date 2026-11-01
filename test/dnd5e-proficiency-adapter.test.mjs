import test from "node:test";
import assert from "node:assert/strict";
import { Dnd5eProficiencyAdapter } from "../scripts/adapters/dnd5e-proficiency-adapter.mjs";
import { createTrainingProject, trainingSummary } from "../scripts/activities/training/training-activity.mjs";

const config = {
  skills: { ste: { label: "Stealth" }, prc: { label: "Perception" }, honor: { label: "Honor" } },
  enrichmentLookup: {
    languages: {
      common: "Common",
      dwarvish: "Dwarvish",
      thievescant: "Thieves' Cant",
      aarakocra: "Aarakocra",
      gith: "Gith",
      gnoll: "Gnoll",
      aquan: "Aquan",
      auran: "Auran",
      ignan: "Ignan",
      terran: "Terran"
    }
  },
  armorProficiencies: { lgt: "Light Armor" },
  armorIds: { plate: "Item.plate", net: "Item.net" },
  shieldIds: {},
  weaponProficiencies: { sim: "Simple Weapons" },
  weaponIds: { dagger: "Item.dagger", net: "Item.net" },
  toolProficiencies: { art: "Artisan's Tools", game: "Gaming Set", music: "Musical Instrument", vehicle: "Vehicles" },
  tools: {
    thief: { id: "Item.thief", ability: "dex" },
    disguisekit: { id: "Item.disguise", ability: "cha", label: "Disguise Kit" },
    land: { id: "Item.land", label: "Vehicles (Land)" },
    water: { id: "Item.water", label: "Vehicles (Water)" },
    air: { id: "Item.air", label: "Vehicles (Air)" },
    space: { id: "Item.space", label: "Vehicles (Space)" }
  }
};
const documents = {
  "Item.plate": { name: "Plate" },
  "Item.dagger": { name: "Dagger" },
  "Item.net": { name: "Net" },
  "Item.thief": { name: "Thieves' tools" },
  "Item.disguise": { name: "Disguise Kit" }
};
let resolved = 0;
const adapter = new Dnd5eProficiencyAdapter({
  config,
  resolveUuid: () => { resolved += 1; return null; },
  localize: value => value
});

const REMOVED = [
  "language:thievescant",
  "language:aarakocra",
  "language:gith",
  "language:gnoll",
  "language:aquan",
  "language:auran",
  "language:ignan",
  "language:terran",
  "toolProficiency:art",
  "toolProficiency:game",
  "toolProficiency:music",
  "toolProficiency:vehicle",
  "toolProficiency:land",
  "toolProficiency:water",
  "toolProficiency:air",
  "toolProficiency:space",
  "toolProficiency:disguisekit",
  "weaponProficiency:net",
  "weaponMastery:net",
  "armorProficiency:net",
  "skillProficiency:honor"
];

test("training choices are the 2024 list and ignore Configure Sources", async () => {
  const actor = {
    uuid: "Actor.instructor",
    system: {
      skills: { ste: { value: 1 } },
      tools: { thief: { value: 1 } },
      traits: {
        languages: { value: new Set(["dwarvish"]) },
        armorProf: { value: new Set(["lgt"]) },
        weaponProf: { value: new Set(["sim"]), mastery: { value: new Set(["dagger"]) } }
      }
    }
  };
  const choices = await adapter.listTrainingChoices({ actors: [actor] });
  const values = new Set(choices.map(choice => choice.value));
  assert.equal(resolved, 0);
  assert.equal(values.has("skillProficiency:prc"), true);
  assert.equal(choices.find(choice => choice.value === "language:sign")?.label, "Common Sign Language");
  assert.equal(choices.find(choice => choice.value === "language:cant")?.label, "Thieves' Cant");
  assert.equal(choices.find(choice => choice.value === "toolProficiency:disg")?.label, "Disguise Kit");
  assert.equal(choices.find(choice => choice.value === "toolProficiency:threedragon")?.label, "Three-Dragon Ante");
  assert.equal(choices.find(choice => choice.value === "armorProficiency:studded")?.label, "Studded Leather Armor");
  assert.equal(choices.find(choice => choice.value === "armorProficiency:plate")?.label, "Plate Armor");
  assert.equal(choices.find(choice => choice.value === "armorProficiency:plate")?.category, "Armor Training");
  assert.equal(choices.find(choice => choice.value === "weaponProficiency:musket")?.label, "Musket");
  assert.equal(choices.find(choice => choice.value === "weaponProficiency:pistol")?.label, "Pistol");
  assert.equal(values.has("weaponMastery:dagger"), true);
  assert.equal(values.has("weaponProficiency:net"), false);
  for (const value of REMOVED) assert.equal(values.has(value), false, value);
  assert.equal(choices.find(choice => choice.value === "language:dwarvish")?.instructorUuids, actor.uuid);
  assert.equal(choices.find(choice => choice.value === "toolProficiency:thief")?.instructorUuids, actor.uuid);
  assert.equal(choices.find(choice => choice.value === "weaponMastery:dagger")?.instructorUuids, actor.uuid);
  assert.equal(choices.find(choice => choice.value === "armorProficiency:plate")?.instructorUuids, "");
});

test("a saved project keeps a removed training subject and its label", async () => {
  const offered = await adapter.listTrainingChoices();
  assert.equal(offered.some(choice => choice.id === "aarakocra"), false);
  const kept = await adapter.listTrainingChoices({
    retain: { kind: "language", proficiencyId: "aarakocra", proficiencyLabel: "Aarakocra" }
  });
  const saved = kept.find(choice => choice.value === "language:aarakocra");
  assert.equal(saved.label, "Aarakocra");
  assert.equal(saved.category, "Language");
  assert.equal(saved.retained, true);
  assert.equal(kept.filter(choice => choice.value === "language:aarakocra").length, 1);

  const project = createTrainingProject({
    kind: "language",
    proficiencyId: "aarakocra",
    proficiencyLabel: "Aarakocra",
    owner: { uuid: "Actor.student", name: "Student" },
    instructor: { mode: "npc", name: "Tutor" }
  }, { idFactory: () => "old-language", now: () => 1 });
  assert.equal(project.metadata.training.proficiencyLabel, "Aarakocra");
  assert.match(trainingSummary(project), /Aarakocra/);
  assert.equal(project.name.includes("undefined"), false);
});

test("adapter awards set and mapping proficiencies, creating a missing tool record", async () => {
  const updates = [];
  const actor = {
    uuid: "Actor.student",
    system: { tools: {}, skills: { ste: { value: 0 } }, traits: { armorProf: { value: new Set(["lgt"]) }, languages: { value: new Set() } } },
    update: async update => updates.push(update)
  };
  assert.equal((await adapter.award(actor, "toolProficiency", "thief")).awarded, true);
  assert.deepEqual(updates[0], { "system.tools.thief": { value: 1, ability: "dex" } });
  assert.equal((await adapter.award(actor, "toolProficiency", "threedragon")).awarded, true);
  assert.deepEqual(updates[1], { "system.tools.threedragon": { value: 1, ability: "wis" } });
  await adapter.award(actor, "skillProficiency", "ste");
  assert.deepEqual(updates[2], { "system.skills.ste.value": 1 });
  await adapter.award(actor, "armorProficiency", "plate");
  assert.deepEqual(updates[3], { "system.traits.armorProf.value": ["lgt", "plate"] });
  assert.equal((await adapter.award(actor, "language", "aarakocra")).awarded, true);
});
