import { appendHistory, createProject } from "../../domain/project.mjs";

export const SOURCE_ITEM_ACTIVITY_ID = "source-item";
export const SOURCE_ITEM_RARITIES = Object.freeze([
  { id: "common", label: "Common", dc: 10, order: 0 },
  { id: "uncommon", label: "Uncommon", dc: 15, order: 1 },
  { id: "rare", label: "Rare", dc: 20, order: 2 },
  { id: "veryrare", label: "Very Rare", dc: 25, order: 3 },
  { id: "legendary", label: "Legendary", dc: 30, order: 4 }
]);

const rarityDefinition = rarity => SOURCE_ITEM_RARITIES.find(entry => entry.id === String(rarity).toLowerCase());

export function sourcingBonus({ investmentGp = 100, weeks = 1 } = {}) {
  const goldSteps = Math.floor(Math.max(0, Number(investmentGp) - 100) / 250);
  const weekSteps = Math.max(0, Number(weeks) - 1);
  return (goldSteps + weekSteps) * 2;
}

export function persuasionPriceAdjustment(total) {
  const value = Number(total);
  if (value <= 1) return 0.25;
  if (value <= 5) return 0.20;
  if (value <= 8) return 0.10;
  if (value <= 11) return 0;
  if (value <= 13) return -0.05;
  if (value <= 15) return -0.10;
  if (value <= 17) return -0.15;
  if (value <= 19) return -0.20;
  return -0.25;
}

export function sourceItemPriceFormula(rarity) {
  return ({
    common: "(1d6 + 1) * 10",
    uncommon: "1d6 * 100",
    rare: "2d10 * 1000",
    veryrare: "(1d4 + 1) * 10000",
    legendary: "2d6 * 25000"
  })[String(rarity).toLowerCase()] ?? null;
}

export function createSourceItemProject(data = {}, options = {}) {
  const target = data.target ?? {};
  const rarity = rarityDefinition(target.rarity);
  const ownerUuid = String(data.owner?.uuid ?? "").trim();
  const locationId = String(data.locationId ?? "").trim();
  const checkSkill = String(data.checkSkill ?? "").trim();
  const investmentGp = Number(data.investmentGp ?? 0);
  const weeks = Number(data.weeks ?? 0);
  if (!ownerUuid) throw new Error("Source Item requires a character owner.");
  if (!String(target.uuid ?? "").trim() || !String(target.name ?? "").trim()) throw new Error("Choose a magic item to source.");
  if (!rarity) throw new Error("Source Item supports Common through Legendary items.");
  if (!locationId) throw new Error("Source Item requires a Location.");
  if (!["arc", "inv"].includes(checkSkill)) throw new Error("Choose Arcana or Investigation for the sourcing check.");
  if (!Number.isFinite(investmentGp) || investmentGp < 100) throw new Error("The minimum sourcing investment is 100 gp.");
  if (!Number.isInteger(weeks) || weeks < 1) throw new Error("Source Item requires at least one whole week.");
  return createProject({
    ...data,
    name: data.name ?? `Source ${target.name}`,
    activityType: SOURCE_ITEM_ACTIVITY_ID,
    status: data.status ?? "active",
    locationId,
    collectionLocationId: null,
    progress: { mode: "elapsed", elapsed: { requiredDays: weeks * 7, completedDays: Number(data.completedDays ?? 0) } },
    costs: [{ type: "currency", denomination: "gp", amount: investmentGp, purpose: "sourcing-investment" }],
    metadata: {
      ...(data.metadata ?? {}),
      sourceItem: {
        target: { uuid: String(target.uuid), name: String(target.name), img: String(target.img ?? ""), rarity: rarity.id, rarityLabel: rarity.label },
        checkSkill,
        investmentGp,
        weeks,
        dc: rarity.dc,
        bonus: sourcingBonus({ investmentGp, weeks }),
        outcome: data.metadata?.sourceItem?.outcome ?? null,
        persuasion: data.metadata?.sourceItem?.persuasion ?? null
      }
    }
  }, options);
}

export async function resolveSourceItemProject(project, { skillModifier = 0, rollD20, rollPrice, rollAlternativeCount, getAlternatives } = {}) {
  const sourceItem = project.metadata?.sourceItem;
  if (!sourceItem || sourceItem.outcome) return project;
  const naturalRoll = Number(await rollD20());
  const appliedModifier = Number(skillModifier);
  const checkTotal = naturalRoll + appliedModifier;
  const total = checkTotal + Number(sourceItem.bonus);
  const success = total >= Number(sourceItem.dc);
  const targetPriceGp = success ? Number(await rollPrice(sourceItem.target.rarity)) : null;
  let alternatives = [];
  if (!success) {
    const count = Number(await rollAlternativeCount());
    const selected = await getAlternatives(sourceItem.target.rarity, sourceItem.target.uuid, count);
    alternatives = await Promise.all(selected.map(async item => ({
      ...item,
      priceGp: Number(await rollPrice(item.rarity))
    })));
  }
  const resolved = structuredClone(project);
  resolved.metadata.sourceItem.outcome = { success, naturalRoll, skillModifier: appliedModifier, checkTotal, investmentBonus: Number(sourceItem.bonus), total, dc: Number(sourceItem.dc), targetPriceGp, alternatives };
  appendHistory(resolved, "source-item-resolved", { success, total, dc: Number(sourceItem.dc), alternativeCount: alternatives.length });
  return resolved;
}

export function applySourceItemPersuasion(project, { naturalRoll, skillModifier = 0 } = {}) {
  const sourceItem = project.metadata?.sourceItem;
  if (!sourceItem?.outcome) throw new Error("The sourcing result has not been revealed.");
  if (sourceItem.persuasion) throw new Error("Persuasion has already been attempted for this offer.");
  const resolved = structuredClone(project);
  const total = Number(naturalRoll) + Number(skillModifier);
  const adjustment = persuasionPriceAdjustment(total);
  const adjust = price => Math.max(1, Math.round(Number(price) * (1 + adjustment)));
  const outcome = resolved.metadata.sourceItem.outcome;
  if (outcome.targetPriceGp != null) outcome.targetPriceGp = adjust(outcome.targetPriceGp);
  outcome.alternatives = outcome.alternatives.map(item => ({ ...item, priceGp: adjust(item.priceGp) }));
  resolved.metadata.sourceItem.persuasion = { naturalRoll: Number(naturalRoll), skillModifier: Number(skillModifier), total, adjustment };
  appendHistory(resolved, "source-item-persuasion", { total, adjustment });
  return resolved;
}

export function sourceItemSummary(project) {
  const sourceItem = project.metadata?.sourceItem;
  const elapsed = project.progress.elapsed;
  if (sourceItem?.outcome) return `${sourceItem.target.name}: ${sourceItem.outcome.success ? "found" : `${sourceItem.outcome.alternatives.length} alternatives offered`}`;
  return `${sourceItem?.target?.name ?? project.name}: ${elapsed.completedDays} / ${elapsed.requiredDays} days`;
}
