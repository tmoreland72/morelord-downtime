import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { TRAINING_ACTIVITY_ID, createTrainingProject } from "../scripts/activities/training/training-activity.mjs";
import { COMMISSION_ACTIVITY_ID, createCommissionProject } from "../scripts/activities/commission/commission-activity.mjs";
import { SOURCE_ITEM_ACTIVITY_ID, createSourceItemProject } from "../scripts/activities/source-item/source-item-activity.mjs";
import { RESEARCH_ACTIVITY_ID, RecipeResearchService } from "../scripts/activities/research/research-activity.mjs";
import { XgeResolutionService } from "../scripts/activities/xge/xge-resolution-service.mjs";
import { XGE_ACTIVITY_IDS } from "../scripts/activities/xge/xge-rules.mjs";
import { gpAmount } from "../../morelord-core/scripts/services/currency-service.js";

const owner = { uuid: "Actor.aric", name: "Aric" };
const locations = {
  town: { id: "town", capabilities: [] },
  chapel: { id: "chapel", capabilities: [{ type: "temple", tier: "common" }] },
  stacks: { id: "stacks", capabilities: [{ type: "library", tier: "common" }] }
};

function character() {
  const actor = {
    name: "Aric",
    system: { currency: { pp: 0, gp: 5000, ep: 0, sp: 0, cp: 0 } },
    update: async change => {
      if (change["system.currency"]) actor.system.currency = change["system.currency"];
    }
  };
  return actor;
}

async function harness(actor) {
  let stored = null;
  let sequence = 0;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const activities = new ActivityRegistry();
  const projects = new ProjectService({ repository, activityRegistry: activities, now: () => 1000 });
  let creates = 0;
  const original = projects.create.bind(projects);
  projects.create = async raw => {
    creates += 1;
    return original(raw);
  };
  const nextId = () => `project-${++sequence}`;
  const research = new RecipeResearchService({
    integration: () => ({
      getResearchComponents: async () => [{ uuid: "Item.bone", name: "Spine" }],
      getResearchRecipes: async () => [],
      isResearchAvailable: () => true
    })
  });
  activities.register({
    id: RESEARCH_ACTIVITY_ID,
    name: "Research Drakkenheim Recipes",
    createProject: data => research.createProject(data, { idFactory: nextId })
  });
  activities.register({
    id: TRAINING_ACTIVITY_ID,
    name: "Training",
    createProject: data => createTrainingProject(data, { idFactory: nextId })
  });
  activities.register({
    id: COMMISSION_ACTIVITY_ID,
    name: "Commission",
    createProject: data => createCommissionProject(data, { idFactory: nextId })
  });
  activities.register({
    id: SOURCE_ITEM_ACTIVITY_ID,
    name: "Source Item",
    createProject: data => createSourceItemProject(data, { idFactory: nextId })
  });
  activities.register({
    id: "crafting",
    name: "Crafting",
    launch: () => {}
  });
  if (!globalThis.foundry) {
    class ApplicationV2 {}
    globalThis.foundry = {
      applications: { api: { ApplicationV2, HandlebarsApplicationMixin: Base => class extends Base {} } }
    };
  }
  const { registerXgeActivities } = await import("../scripts/activities/xge/register-xge.mjs");
  const xge = new XgeResolutionService({
    projects,
    getActor: async () => actor,
    getLocation: async id => locations[id] ?? null
  });
  registerXgeActivities(activities, xge);
  const createProject = (id, data) => projects.createFromActivity(id, data, activities.get(id));
  return { createProject, creates: () => creates, projects };
}

const xgePayload = {
  "religious-service": { owner, locationId: "chapel", skill: "rel" },
  carousing: { owner, locationId: "town", socialClass: "lower", npcNames: "Mira" },
  crime: { owner, locationId: "town", crimeDc: 15, crimeNotes: "A warehouse job", thirdSkill: "inv" },
  gambling: { owner, locationId: "town", stakeGp: 10 },
  "pit-fighting": { owner, locationId: "town" },
  relaxation: { owner, locationId: "town" },
  "lore-research": { owner, locationId: "stacks", skill: "his", question: "Who built the gate?" }
};

test("activities.createProject creates one project and takes the activity id as the type", async () => {
  assert.deepEqual([...XGE_ACTIVITY_IDS].sort(), Object.keys(xgePayload).sort());
  const actor = character();
  const { createProject, creates, projects } = await harness(actor);
  const calls = [
    ["gambling", { owner, locationId: "town", stakeGp: 10 }],
    ["gambling", { owner, locationId: "town", stakeGp: 10, activityType: "crime" }],
    ...Object.entries(xgePayload).filter(([id]) => id !== "gambling"),
    [TRAINING_ACTIVITY_ID, {
      kind: "language",
      proficiencyId: "dwarvish",
      proficiencyLabel: "Dwarvish",
      owner,
      instructor: { mode: "participant", actorUuid: "Actor.brom", name: "Brom" }
    }],
    [COMMISSION_ACTIVITY_ID, {
      owner,
      contractorName: "Arlen the Smith",
      itemDescription: "Silvered longsword",
      locationId: "town",
      requiredDays: 2
    }],
    [SOURCE_ITEM_ACTIVITY_ID, {
      owner,
      target: { uuid: "Item.sword", name: "Flame Tongue", rarity: "rare" },
      locationId: "town",
      checkSkill: "inv",
      investmentGp: 100,
      weeks: 1
    }],
    [RESEARCH_ACTIVITY_ID, { owner, componentUuid: "Item.bone" }]
  ];

  const ids = [];
  for (const [activityId, data] of calls) {
    const before = creates();
    const suppliedType = data.activityType;
    const project = await createProject(activityId, data);
    assert.equal(data.activityType, suppliedType);
    assert.equal(project.activityType, activityId);
    assert.equal(creates(), before + 1);
    assert.equal((await projects.list()).filter(entry => entry.id === project.id).length, 1);
    ids.push(project.id);
  }

  assert.equal(new Set(ids).size, calls.length);
  assert.equal((await projects.list()).length, calls.length);
  assert.equal(creates(), calls.length);
  // Two gambling stakes, plus carousing, crime, relaxation, and lore research. Religious service and pit fighting cost nothing.
  assert.equal(gpAmount(actor), 5000 - 20 - 10 - 25 - 7 - 50);

  await assert.rejects(() => createProject("crafting", { owner, name: "Sword" }), /own Project workflow/);
  await assert.rejects(() => createProject("missing", { owner, name: "Sword" }), /not registered/);
  assert.equal(creates(), calls.length);
  assert.equal((await projects.list()).length, calls.length);
});

test("the public activities.createProject wrapper uses the single-create service path", () => {
  const source = readFileSync(new URL("../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(source, /createProject:\s*\(id,\s*data\)\s*=>\s*projects\.createFromActivity\(id,\s*data,\s*activities\.get\(id\)\)/);
  assert.doesNotMatch(source, /return projects\.create\(await activity\.createProject/);
});
