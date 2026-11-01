import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GAMBLING_CHECKS,
  SOURCE_ITEM_CHECKS,
  actorCheckModifier,
  applyCheckLabels,
  labelChecks,
  labelForCheck
} from "../scripts/ui/check-label.mjs";

const proficient = {
  system: {
    attributes: { prof: 3 },
    abilities: { dex: { mod: 2 }, wis: { mod: 1 }, con: { mod: 4 } },
    skills: {
      rel: { mod: 1, total: 5 },
      per: { mod: 1, total: -2 },
      ste: { mod: 2, total: 5 }
    },
    tools: {
      thief: { ability: "dex", value: 1, total: 4 },
      dice: { ability: "wis", value: 2 }
    }
  }
};

test("check menus show the character's total and omit it when no character is chosen", () => {
  assert.equal(labelForCheck(null, { kind: "skill", id: "rel", name: "Religion" }), "Religion");
  assert.equal(labelForCheck(proficient, { kind: "skill", id: "rel", name: "Religion" }), "Religion (+5)");
  assert.equal(labelForCheck(proficient, { kind: "skill", id: "per", name: "Persuasion" }), "Persuasion (-2)");
  assert.equal(labelForCheck(proficient, { kind: "tool", id: "thief", name: "Thieves' Tools" }), "Thieves' Tools (+4)");
  assert.equal(labelForCheck(proficient, { kind: "tool", id: "dice", name: "Dice" }), "Dice (+7)");
  assert.equal(labelForCheck(proficient, { kind: "ability", id: "con", name: "Constitution" }), "Constitution (+4)");
  assert.equal(labelChecks(null, SOURCE_ITEM_CHECKS).map(check => check.label).join(", "), "Arcana, Investigation");
  assert.equal(actorCheckModifier(null, { kind: "skill", id: "rel" }), null);
});

test("a skill total from Core is used, including expertise already in that total", () => {
  const previous = globalThis.MorelordCore;
  globalThis.MorelordCore = { rolls: { skillModifier: () => 9 } };
  try {
    assert.equal(labelForCheck(proficient, { kind: "skill", id: "rel", name: "Religion" }), "Religion (+9)");
  } finally {
    if (previous === undefined) delete globalThis.MorelordCore;
    else globalThis.MorelordCore = previous;
  }
});

test("changing the character rewrites the option labels without stacking bonuses", () => {
  const insight = {
    dataset: { checkKind: "skill", checkId: "ins", checkLabel: "Insight" },
    value: "0",
    textContent: "Insight"
  };
  const none = {
    dataset: {},
    value: "",
    textContent: "No gaming set"
  };
  const root = { querySelectorAll: selector => selector.includes("data-check-kind") ? [insight] : [] };
  applyCheckLabels(root, { system: { skills: { ins: { total: 5 } } } });
  assert.equal(insight.textContent, "Insight (+5)");
  assert.equal(GAMBLING_CHECKS[0].value, "0");
  applyCheckLabels(root, null);
  assert.equal(insight.textContent, "Insight");
  assert.equal(none.textContent, "No gaming set");
  applyCheckLabels(root, { system: { skills: { ins: { total: 1 } } } });
  assert.equal(insight.textContent, "Insight (+1)");
});

test("every check menu is wired to the shared bonus label", () => {
  const xge = readFileSync(new URL("../templates/create-xge.hbs", import.meta.url), "utf8");
  const source = readFileSync(new URL("../templates/create-source-item.hbs", import.meta.url), "utf8");
  const training = readFileSync(new URL("../templates/create-training.hbs", import.meta.url), "utf8");
  for (const name of ["religiousChecks", "crimeChecks", "gamblingChecks", "gamblingTools", "pitChecks", "researchChecks"]) {
    assert.match(xge, new RegExp(`\\{\\{#each ${name}\\}\\}`));
  }
  assert.match(xge, /data-check-kind="\{\{kind\}\}" data-check-id="\{\{id\}\}" data-check-label="\{\{name\}\}"/);
  assert.equal(xge.includes(">Religion<"), false);
  assert.match(source, /\{\{#each sourceChecks\}\}/);
  assert.match(source, /data-check-label="\{\{name\}\}"/);
  assert.equal(source.includes("arcanaModifier"), false);
  assert.equal(training.includes("data-check-kind"), false);
  assert.equal(xge.includes('name="socialClass"') && xge.includes("data-check-kind=\"social"), false);
});
