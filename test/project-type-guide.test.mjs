import test from "node:test";
import assert from "node:assert/strict";
import { openProjectTypeGuide, projectTypeDialogContent, projectTypeEntries } from "../scripts/ui/project-type-guide.mjs";

const text = () => projectTypeEntries().map(entry => `${entry.name}\n${entry.fields.map(field => `${field.label}: ${field.text}`).join("\n")}`).join("\n");

test("the New Project help explains every project type from the activity rules", () => {
  const guide = text();
  const ids = projectTypeEntries().map(entry => entry.id);
  assert.deepEqual(ids, [
    "crafting", "training", "source-item", "religious-service", "carousing", "crime",
    "gambling", "pit-fighting", "relaxation", "lore-research", "commission", "research-drakkenheim-recipes"
  ]);
  for (const label of ["What it does", "Time", "Cost", "Checks", "Location and Session", "Outcome", "Complications"]) {
    assert.equal(projectTypeEntries().every(entry => entry.fields.some(field => field.label === label)), true);
  }
  assert.match(guide, /Temple/);
  assert.match(guide, /Library/);
  assert.match(guide, /7 days/);
  assert.match(guide, /10 gp/);
  assert.match(guide, /50 gp/);
  assert.match(guide, /250 gp/);
  assert.match(guide, /Crime[\s\S]*25 gp/);
  assert.match(guide, /10 to 1,000/);
  assert.match(guide, /Research[\s\S]*50 gp/);
  assert.match(guide, /7 gp/);
  assert.match(guide, /Every Exhaustion level is removed/);
  assert.match(guide, /even when the character is away/);
  assert.match(guide, /does not advance while the character is away/);
  assert.match(guide, /Only on exactly one success/);
  assert.match(guide, /A 10% chance/);
  assert.match(guide, /No fixed Location/);
  assert.doesNotMatch(guide, /waive/i);
  assert.doesNotMatch(guide, /Not location specific/);

  const content = projectTypeDialogContent();
  assert.equal(content.startsWith("<div><div class=\"ml-app ml-app-shell ml-dialog-shell"), true);
  assert.equal(/^<div[\s>]/.test(content) && !/^<div\s/.test(content), true);
  assert.match(content, /class="ml-data-list"/);
  assert.match(content, /Religious Service/);
  assert.match(content, /Pit Fighting/);
});

test("the question mark opens that explanation in a Core dialog", async () => {
  let shown = null;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => { shown = options; return "close"; } } } } };
  assert.equal(await openProjectTypeGuide(), "close");
  assert.equal(shown.window.title, "Project Types");
  assert.equal(shown.classes.includes("ml-window"), true);
  assert.equal(shown.buttons[0].label, "Close");
  assert.equal(shown.content.startsWith("<div><div class=\"ml-app ml-app-shell ml-dialog-shell"), true);
  assert.equal(/^<div\s/.test(shown.content), false);
});
