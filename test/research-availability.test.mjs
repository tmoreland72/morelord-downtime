import test from "node:test";
import assert from "node:assert/strict";
import { ActivityRegistry } from "../scripts/domain/activity-registry.mjs";
import { RecipeResearchService, RESEARCH_ACTIVITY_ID } from "../scripts/activities/research/research-activity.mjs";

test("research choices follow live content-pack availability while saved activity definitions survive", async () => {
  let enabled = false;
  const research = new RecipeResearchService({ integration: () => ({
    isResearchAvailable: () => enabled,
    getResearchComponents: async () => [], getResearchRecipes: async () => []
  }) });
  const registry = new ActivityRegistry();
  registry.register({ id: RESEARCH_ACTIVITY_ID, createProject: value => value, isAvailable: () => research.isAvailable() });
  assert.equal(registry.list({ availableOnly: true }).length, 0);
  assert.equal(registry.list().length, 1);
  await assert.rejects(() => research.createProject({}), /enabled Drakkenheim content pack/);
  enabled = true;
  assert.equal(registry.list({ availableOnly: true }).length, 1);
  enabled = false;
  assert.equal(registry.list({ availableOnly: true }).length, 0);
  assert.ok(registry.get(RESEARCH_ACTIVITY_ID));
  assert.equal(new RecipeResearchService({ integration: () => null }).isAvailable(), false);
});
