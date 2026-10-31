import { applySourceItemPersuasion, resolveSourceItemProject, sourceItemPriceFormula } from "./source-item-activity.mjs";
import { sourceItemRollCard } from "./source-item-roll-request.mjs";
import { completeChatRoll } from "../../../../morelord-core/scripts/services/chat-roll-requests.js";

export class SourceItemResolutionService {
  constructor({ catalog, getRequests = () => null, commit = async project => project }) {
    this.catalog = catalog;
    this.getRequests = getRequests;
    this.commit = commit;
  }

  /** Post Core's roll request instead of rolling the skill check for the player. */
  async requestRoll(project) {
    if (project.metadata?.sourceItem?.outcome) return project;
    const requests = this.getRequests();
    if (typeof requests?.create !== "function") throw new Error("Morelord Core roll requests are unavailable. Update and enable Morelord Core.");
    await requests.create(sourceItemRollCard(project));
    const pending = structuredClone(project);
    pending.metadata.sourceItem.pendingRoll = true;
    return pending;
  }

  async applyRoll(project, check, { messageId = null } = {}) {
    if (project.metadata?.sourceItem?.outcome) return project;
    const resolved = await resolveSourceItemProject(project, {
      skillModifier: check.skillModifier,
      rollD20: async () => check.naturalRoll,
      rollPrice: rarity => this.#rollPrice(rarity),
      rollAlternativeCount: async () => (await new Roll("1d4").evaluate()).total,
      getAlternatives: (rarity, excludeUuid, count) => this.catalog.randomItems({ maxRarity: rarity, count, excludeUuids: [excludeUuid] })
    });
    resolved.metadata.sourceItem.pendingRoll = false;
    const saved = await this.commit(resolved);
    await this.#postResult(saved);
    if (messageId && globalThis.game?.messages?.get) {
      const message = game.messages.get(messageId);
      if (message) await completeChatRoll(message, "");
    }
    return saved;
  }

  async negotiate(project, roll) {
    return applySourceItemPersuasion(project, { naturalRoll: roll?.naturalRoll, skillModifier: roll?.rollModifier });
  }

  async #rollPrice(rarity) {
    const formula = sourceItemPriceFormula(rarity);
    if (!formula) throw new Error(`No Source Item price formula exists for '${rarity}'.`);
    const base = Number((await new Roll(formula).evaluate()).total);
    const variance = Math.random() < 0.5 ? 0.95 : 1.05;
    return Math.max(1, Math.round(base * variance));
  }

  async #postResult(project) {
    const sourceItem = project.metadata.sourceItem;
    const items = sourceItem.outcome.success
      ? [{ ...sourceItem.target, priceGp: sourceItem.outcome.targetPriceGp }]
      : sourceItem.outcome.alternatives;
    const content = await foundry.applications.handlebars.renderTemplate("modules/morelord-downtime/templates/chat/source-item-result.hbs", {
      projectName: project.name,
      ownerName: project.owner.name ?? "Character",
      success: sourceItem.outcome.success,
      total: sourceItem.outcome.total,
      dc: sourceItem.dc,
      items: items.map(item => ({ ...item, priceLabel: `${Number(item.priceGp).toLocaleString()} gp` }))
    });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ alias: project.owner.name ?? "Source Item" }), content });
  }
}
