import { applySourceItemPersuasion, resolveSourceItemProject, sourceItemPriceFormula } from "./source-item-activity.mjs";

export class SourceItemResolutionService {
  constructor({ catalog }) { this.catalog = catalog; }

  async resolve(project) {
    const actor = await fromUuid(project.owner.uuid);
    if (!actor) throw new Error("The Source Item owner could not be resolved.");
    const skill = project.metadata.sourceItem.checkSkill;
    const skillModifier = Number(actor.system?.skills?.[skill]?.total ?? actor.system?.skills?.[skill]?.mod ?? 0);
    const resolved = await resolveSourceItemProject(project, {
      skillModifier,
      rollD20: async () => (await new Roll("1d20").evaluate()).total,
      rollPrice: rarity => this.#rollPrice(rarity),
      rollAlternativeCount: async () => (await new Roll("1d4").evaluate()).total,
      getAlternatives: (rarity, excludeUuid, count) => this.catalog.randomItems({ maxRarity: rarity, count, excludeUuids: [excludeUuid] })
    });
    await this.#postResult(resolved);
    return resolved;
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
