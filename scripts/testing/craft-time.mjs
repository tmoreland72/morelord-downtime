import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { listCharacterActors } from "../../../morelord-core/scripts/ui/actor-participation.js";
import { MODULE_ID, STATE_SETTING } from "../constants.mjs";

/**
 * Persist a failed crafting check the way Craftworks does and confirm the active Session records that time once.
 * Run as GM in Dev1:
 * `const { runCraftTimeTests } = await import("./modules/morelord-downtime/scripts/testing/craft-time.mjs"); await runCraftTimeTests()`
 */
export async function runCraftTimeTests() {
  return runInGameTests({ checks: [{ id: "downtime.craft-time-recorded", async run() {
    assert(game.user.isGM, "Run the crafting-time regression as a GM.");
    const craftworks = game.modules.get("morelord-craftworks")?.api ?? globalThis.MorelordCraftworks;
    assert(craftworks?.downtimeIntegration?.getProject, "Morelord Craftworks downtime integration is required.");
    assert(craftworks.craftingJobs?.start && craftworks.craftingJobs?.recordAttempt, "Morelord Craftworks crafting jobs are required.");
    const actor = listCharacterActors()[0];
    assert(actor, "A participant character is required.");
    const api = globalThis.MorelordDowntime;
    const snapshot = foundry.utils.deepClone(game.settings.get(MODULE_ID, STATE_SETTING));
    const recipeId = `downtime-craft-time-${foundry.utils.randomID()}`;
    try {
      const active = (await api.sessions.list({ status: "active" }))[0] ?? null;
      if (active && !active.participants.some(entry => entry.actorUuid === actor.uuid)) {
        throw new Error("The active Downtime Session does not include the regression character.");
      }
      let sessionId = active?.id ?? null;
      if (!sessionId) {
        const created = await api.sessions.create({
          name: "Craft time regression",
          plannedDurationHours: 8,
          participants: [{ actorUuid: actor.uuid, name: actor.name }],
          availableActivities: ["crafting"]
        });
        await api.sessions.publish(created.id);
        await api.sessions.start(created.id);
        sessionId = created.id;
      }
      const beforeSegment = (await api.segments.list({ status: "open", participantActorUuid: actor.uuid }))
        .find(segment => segment.metadata?.sessionId === sessionId);
      assert(beforeSegment, "The active Session has no open time pool for this character.");
      const beforeHours = beforeSegment.participants.find(entry => entry.actorUuid === actor.uuid).allocatedHours;

      await craftworks.craftingJobs.start({
        recipeId,
        crafter: actor,
        inventoryActorUuid: actor.uuid,
        hoursRequired: 8,
        consumedMaterials: [],
        materialPlanSummary: "Downtime craft-time regression"
      });
      await api.craftTime.reconcileActor(actor);
      await craftworks.craftingJobs.recordAttempt(recipeId, actor, actor.uuid, { success: false, progressDelta: 0 });
      await api.craftTime.reconcileActor(actor);
      const after = await api.segments.get(beforeSegment.id);
      const allocated = after.participants.find(entry => entry.actorUuid === actor.uuid).allocatedHours;
      assert(allocated === beforeHours + 2, "A failed crafting check's two spent hours were not added to Downtime.");
      await api.craftTime.reconcileActor(actor);
      const duplicate = await api.segments.get(beforeSegment.id);
      assert(duplicate.participants.find(entry => entry.actorUuid === actor.uuid).allocatedHours === allocated, "The same crafting time was recorded twice.");
      const session = await api.sessions.get(sessionId);
      const entry = session.history.find(item => item.type === "craft-time" && item.data?.hours === 2);
      assert(entry, "Session history does not describe the crafting time.");

      await craftworks.craftingJobs.recordAttempt(recipeId, actor, actor.uuid, { success: false, progressDelta: 0 });
      await api.craftTime.reconcileActor(actor);
      const second = await api.segments.get(beforeSegment.id);
      assert(second.participants.find(entry => entry.actorUuid === actor.uuid).allocatedHours === beforeHours + 4, "A second check's spent time was not recorded.");
    } finally {
      await craftworks?.craftingJobs?.clear?.(recipeId, actor);
      await api?.craftTime?.reconcileActor?.(actor);
      await game.settings.set(MODULE_ID, STATE_SETTING, snapshot);
    }
  } }] });
}
