import { itemRarity } from "../../../morelord-core/scripts/services/item-rarity.js";

export function trainingDefault(kind, intelligenceModifier = 0) {
  const modifier = Number(intelligenceModifier);
  const weeks = Math.max(1, 10 - Math.max(0, Number.isFinite(modifier) ? modifier : 0));
  const published = ["language", "artisanTool", "tool", "toolProficiency"].includes(kind);
  return {
    hours: weeks * 40,
    guidance: published
      ? `Xanathar's Guide to Everything, Training: 10 workweeks minus a positive Intelligence modifier (${weeks} workweeks × 5 days × 8 hours). GM may adjust.`
      : `GM-defined training: uses the language/tool baseline (${weeks} workweeks × 40 hours). Published training rules do not assign a duration to this proficiency or mastery; the GM may adjust.`
  };
}

export function commissionDefault(item) {
  const rarity = itemRarity(item?.system);
  const days = { common: 5, uncommon: 10, rare: 50, veryrare: 125, legendary: 250 }[rarity];
  const subtype = item?.system?.type?.value;
  if (subtype === "scroll" || rarity === "artifact") return { days: null, guidance: "This item uses special crafting rules. The GM must set the labor days." };
  if (days) {
    const consumable = item.type === "consumable";
    return { days: Math.ceil(days / (consumable ? 2 : 1)), guidance: `2024 magic-item crafting guideline: ${days} days by rarity${consumable ? ", halved for a consumable and rounded up to whole labor days" : ""}. Special recipes, materials, assistants, and commissioning terms may change the estimate.` };
  }
  const price = item?.system?.price;
  const gp = typeof price === "number" ? price : Number(price?.value ?? 0) * ({ cp: .01, sp: .1, ep: .5, gp: 1, pp: 10 }[price?.denomination ?? "gp"] ?? 1);
  return { days: Math.max(1, Math.ceil(gp / 10)), guidance: "2024 mundane crafting guideline: list price in gp ÷ 10, rounded up to at least one 8-hour labor day. GM may adjust." };
}
