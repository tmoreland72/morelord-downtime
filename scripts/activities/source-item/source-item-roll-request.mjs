import { canRollForActor, submitChatRoll } from "../../../../morelord-core/scripts/services/chat-roll-requests.js";

export const SOURCE_ITEM_ROLL_TYPE = "downtime.source-item";

export function sourceItemSkillLabel(skill) {
  return skill === "inv" ? "Investigation" : "Arcana";
}

/** Core chat-roll card. One Roll button; the native skill dialog handles advantage and modifiers. */
export function sourceItemRollCard(project) {
  const sourceItem = project?.metadata?.sourceItem ?? {};
  const skill = sourceItem.checkSkill === "inv" ? "inv" : "arc";
  const label = sourceItemSkillLabel(skill);
  return {
    type: SOURCE_ITEM_ROLL_TYPE,
    key: `source-item:${project.id}`,
    title: `Source Item · ${label}`,
    actorUuid: project.owner?.uuid ?? null,
    modes: false,
    actionLabel: "Roll",
    data: { projectId: project.id, skill, title: `Source Item · ${label}` }
  };
}

/** Map a native skill-roll result onto the sourcing check. Cancelled rolls return null. */
export function skillCheckFromRoll(roll) {
  if (!roll || roll.cancelled) return null;
  const naturalRoll = Number(roll.naturalD20);
  const total = Number(roll.total);
  if (!Number.isFinite(naturalRoll) || !Number.isFinite(total)) return null;
  return { naturalRoll, skillModifier: total - naturalRoll };
}

/**
 * The card is Core's shared roll request. Clicking Roll opens the dnd5e skill dialog
 * on this client, for the owning player or for a GM when that player is offline.
 */
export function installSourceItemRollCards({ hooks, rollSkill, applyRoll, fromUuid = globalThis.fromUuid } = {}) {
  hooks.on("renderChatMessageHTML", (message, html) => {
    const request = message.getFlag?.("morelord-core", "rollRequest");
    const entry = request?.type === SOURCE_ITEM_ROLL_TYPE ? request : null;
    if (!entry || html?.dataset?.sourceItemRollBound === "true") return;
    html.dataset.sourceItemRollBound = "true";
    html.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-ml-core-roll]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const row = button.closest("[data-ml-roll-entry]");
      const entryKey = row?.dataset.mlRollEntry ?? "";
      void submitChatRoll(message, entryKey, row, async () => {
        const actor = entry.actorUuid ? await fromUuid(entry.actorUuid) : null;
        if (!canRollForActor(actor)) throw new Error("This request is assigned to another user.");
        const rolled = await rollSkill(actor, entry.data?.skill, {
          configure: true,
          create: true,
          flavor: entry.data?.title ?? entry.title
        });
        const check = skillCheckFromRoll(rolled);
        if (!check) throw new Error("The sourcing roll was cancelled.");
        await applyRoll(entry.data.projectId, check, { messageId: message.id });
      }).catch(error => {
        globalThis.ui?.notifications?.error?.(error.message);
      });
    }, true);
  });
}
