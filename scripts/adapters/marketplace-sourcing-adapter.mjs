import { getModuleApi } from "../integrations/core-api.mjs";

export class MarketplaceSourcingAdapter {
  get api() { return getModuleApi("morelord-marketplace", "MorelordMarketplace")?.sourcing ?? null; }

  async listWishlist(actorUuid) {
    if (!this.api?.listWishlist) return [];
    return this.api.listWishlist(actorUuid);
  }

  async requireWishlistItem(actorUuid, itemUuid) {
    const item = (await this.listWishlist(actorUuid)).find(entry => entry.uuid === String(itemUuid));
    if (!item) throw new Error("Choose an available magic item from this character's Marketplace wishlist.");
    return item;
  }

  async randomItems(options) {
    if (!this.api?.randomItems) throw new Error("Marketplace sourcing services are unavailable.");
    return this.api.randomItems(options);
  }

  async spendInvestment(actorUuid, amountGp) {
    if (!this.api?.spendInvestment) throw new Error("Marketplace currency services are unavailable.");
    return this.api.spendInvestment({ actorUuid, amountGp });
  }

  async availableInvestmentGp(actorUuid) {
    return Number(await this.api?.availableInvestmentGp?.(actorUuid) ?? 0);
  }

  async refundInvestment(actorUuid, amountGp) {
    return this.api?.refundInvestment?.({ actorUuid, amountGp }) ?? false;
  }
}
