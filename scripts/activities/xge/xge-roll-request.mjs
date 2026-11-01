import { canRollForActor, submitChatRoll } from "../../../../morelord-core/scripts/services/chat-roll-requests.js";
import { skillCheckFromRoll } from "../source-item/source-item-roll-request.mjs";

export const XGE_ROLL_TYPE = "downtime.xge";

export function xgeRollCard(project) {
  const check = project.metadata.xge.checks.find(entry => entry.total == null);
  const index = project.metadata.xge.checks.indexOf(check);
  const activity = project.name;
  return {
    type: XGE_ROLL_TYPE,
    key: `xge:${project.id}:${index}`,
    title: `${activity} · ${check?.label ?? "Check"}`,
    actorUuid: project.owner?.uuid ?? null,
    dc: check?.dc ?? null,
    modes: false,
    actionLabel: "Roll",
    data: {
      projectId: project.id,
      index,
      kind: check?.kind ?? "skill",
      skill: check?.skill ?? null,
      ability: check?.ability ?? null,
      tool: check?.tool ?? null,
      weaponUuid: check?.weaponUuid ?? null,
      title: `${activity} · ${check?.label ?? "Check"}`
    }
  };
}

export function installXgeRollCards({ hooks, rollSkill, applyRoll, fromUuid = globalThis.fromUuid, rollDie = null } = {}) {
  hooks.on("renderChatMessageHTML", (message, html) => {
    const request = message.getFlag?.("morelord-core", "rollRequest");
    if (request?.type !== XGE_ROLL_TYPE || html?.dataset?.xgeRollBound === "true") return;
    html.dataset.xgeRollBound = "true";
    html.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-ml-core-roll]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const row = button.closest("[data-ml-roll-entry]");
      const entryKey = row?.dataset.mlRollEntry ?? "";
      void submitChatRoll(message, entryKey, row, async () => {
        const entry = request;
        const actor = entry.actorUuid ? await fromUuid(entry.actorUuid) : null;
        if (!canRollForActor(actor)) throw new Error("This request is assigned to another user.");
        const rolled = await rollForEntry(actor, entry.data, { rollSkill, fromUuid, rollDie });
        const check = skillCheckFromRoll(rolled) ?? totalFromRoll(rolled);
        if (!check) throw new Error("The roll was cancelled.");
        await applyRoll(entry.data.projectId, check.total ?? rolled.total, { messageId: message.id });
      });
    }, true);
  });
}

async function rollForEntry(actor, data, { rollSkill, fromUuid, rollDie }) {
  if (data.kind === "skill") return rollSkill(actor, data.skill, { configure: true, create: true, flavor: data.title });
  if (data.kind === "ability" || data.kind === "constitution") {
    const rolled = await actor.rollAbilityCheck(data.ability ?? "con", { configure: true, create: true });
    if (data.kind === "constitution" && rolled && !rolled.cancelled) {
      const faces = largestHitDie(actor);
      const die = rollDie ? await rollDie(faces) : Number((await new Roll(`1d${faces}`).evaluate()).total);
      rolled.total = Number(rolled.total) + Number(die);
    }
    return rolled;
  }
  if (data.kind === "tool") return actor.rollToolCheck(data.tool, { configure: true, create: true });
  if (data.kind === "attack") {
    const weapon = data.weaponUuid ? await fromUuid(data.weaponUuid) : null;
    if (!weapon?.rollAttack) throw new Error("Choose a weapon for the attack roll.");
    return weapon.rollAttack({ configure: true, create: true });
  }
  throw new Error("This downtime check cannot be rolled.");
}

function totalFromRoll(rolled) {
  if (!rolled || rolled.cancelled) return null;
  const total = Number(rolled.total);
  if (!Number.isFinite(total)) return null;
  return { total };
}

export function largestHitDie(actor) {
  const dice = [];
  for (const item of actor?.items ?? []) {
    if (item?.type === "class" && Number(item.system?.hitDie) > 0) dice.push(Number(item.system.hitDie));
  }
  return dice.length ? Math.max(...dice) : 8;
}
