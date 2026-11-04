import { applySourceItemPersuasion, formatPriceAdjustment, resolveSourceItemProject, sourceItemCollectionNotice, sourceItemPriceFormula } from "./source-item-activity.mjs";
import { sourceItemPersuasionCard, sourceItemRollCard } from "./source-item-roll-request.mjs";
import { completeChatRoll } from "../../../../morelord-core/scripts/services/chat-roll-requests.js";

const RESULT_TEMPLATE = "modules/morelord-downtime/templates/chat/source-item-result.hbs";
const PERSUASION_TEMPLATE = "modules/morelord-downtime/templates/chat/source-item-persuasion.hbs";

export class SourceItemResolutionService {
  constructor({ catalog, getRequests = () => null, commit = async project => project, getLocation = () => null }) {
    this.catalog = catalog;
    this.getRequests = getRequests;
    this.commit = commit;
    this.getLocation = getLocation;
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

  async requestPersuasion(project) {
    const sourceItem = project.metadata?.sourceItem;
    if (!sourceItem?.outcome) throw new Error("The sourcing result has not been revealed.");
    if (sourceItem.persuasion) throw new Error("Persuasion has already been attempted for this offer.");
    const requests = this.getRequests();
    if (typeof requests?.create !== "function") throw new Error("Morelord Core roll requests are unavailable. Update and enable Morelord Core.");
    await requests.create(sourceItemPersuasionCard(project));
    const pending = structuredClone(project);
    pending.metadata.sourceItem.pendingPersuasion = true;
    return this.commit(pending);
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
    await this.#completeRequest(messageId);
    return saved;
  }

  async #completeRequest(messageId) {
    if (!messageId || !globalThis.game?.messages?.get) return;
    const message = game.messages.get(messageId);
    if (message) await completeChatRoll(message, "");
  }

  async negotiate(project, roll) {
    return applySourceItemPersuasion(project, { naturalRoll: roll?.naturalRoll, skillModifier: roll?.skillModifier ?? roll?.rollModifier });
  }

  async applyPersuasion(project, check, { messageId = null } = {}) {
    const resolved = await this.negotiate(project, check);
    const saved = await this.commit(resolved);
    await this.#postPersuasion(saved);
    await this.#completeRequest(messageId);
    return saved;
  }

  #collectionNotice(project) {
    const locationId = project.locationId;
    const location = locationId ? this.getLocation(locationId) : null;
    return sourceItemCollectionNotice({ locationId, locationName: location?.name });
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
    const success = sourceItem.outcome.success === true;
    const ownerName = project.owner.name ?? "Character";
    const collectionMessage = success ? this.#collectionNotice(project).message : null;
    const data = {
      projectName: project.name,
      ownerName,
      success,
      collectionMessage,
      total: sourceItem.outcome.total,
      dc: sourceItem.dc,
      items: pricedOffers(success
        ? [{ ...sourceItem.target, priceGp: sourceItem.outcome.targetPriceGp }]
        : sourceItem.outcome.alternatives)
    };
    await this.#postChat(project, await renderSourceItemChat(RESULT_TEMPLATE, data, "No eligible alternatives were available."));
  }

  async #postPersuasion(project) {
    const sourceItem = project.metadata.sourceItem;
    const persuasion = sourceItem.persuasion;
    const ownerName = project.owner.name ?? "Character";
    const adjustmentLabel = formatPriceAdjustment(persuasion.adjustment);
    const data = {
      projectName: project.name,
      ownerName,
      total: persuasion.total,
      dc: persuasion.dc,
      tierLabel: persuasion.tierLabel,
      adjustmentLabel,
      items: pricedOffers(sourceItem.outcome.success
        ? [{ ...sourceItem.target, priceGp: sourceItem.outcome.targetPriceGp }]
        : sourceItem.outcome.alternatives)
    };
    await this.#postChat(project, await renderSourceItemChat(PERSUASION_TEMPLATE, data, "No offers were adjusted."));
  }

  async #postChat(project, content) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ alias: project.owner.name ?? "Source Item" }), content });
  }
}

/** Keep the chat card text. Use Core's item rows for the offers when this Core build provides them. */
async function renderSourceItemChat(template, data, emptyText) {
  const itemCard = globalThis.MorelordCore?.ui?.itemCard;
  const context = { ...data };
  if (typeof itemCard === "function") {
    const rows = itemRows(itemCard({ items: cardItems(data.items), emptyText }));
    if (rows) context.itemsHTML = rows;
  }
  return foundry.applications.handlebars.renderTemplate(template, context);
}

/** itemCard returns a full card. These messages keep their own header, so only the rows are inserted. */
function itemRows(html) {
  const start = html.indexOf('<div class="ml-award-card__items">');
  if (start >= 0) return html.slice(start, html.lastIndexOf("</div>") + "</div>".length);
  const emptyStart = html.indexOf('<p class="ml-award-card__empty">');
  if (emptyStart >= 0) return html.slice(emptyStart, html.indexOf("</p>", emptyStart) + "</p>".length);
  return "";
}

function pricedOffers(items) {
  return (items ?? []).map(item => ({ ...item, priceLabel: `${Number(item.priceGp).toLocaleString()} gp` }));
}

function cardItems(items) {
  return items.map(item => ({
    uuid: item.uuid ?? "",
    name: item.name ?? "",
    img: item.img ?? "",
    rarity: item.rarity || item.rarityLabel || "",
    quantity: 1,
    value: item.priceLabel
  }));
}
