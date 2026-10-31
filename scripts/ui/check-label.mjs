/**
 * Labels for a check the player or GM is choosing.
 * Skills use Core's prepared total when Core is loaded. Tools and ability checks
 * use the same dnd5e total, including proficiency and expertise.
 */

const TOOL_ABILITY = Object.freeze({
  alchemist: "int",
  brewer: "int",
  calligrapher: "dex",
  carpenter: "str",
  cartographer: "wis",
  cobbler: "dex",
  cook: "wis",
  glassblower: "int",
  jeweler: "int",
  leatherworker: "dex",
  mason: "str",
  painter: "wis",
  potter: "int",
  smith: "str",
  tinker: "dex",
  weaver: "dex",
  woodcarver: "dex",
  disg: "cha",
  forg: "dex",
  herb: "int",
  navg: "wis",
  pois: "int",
  thief: "dex",
  dice: "wis",
  chess: "wis",
  card: "wis",
  threedragon: "wis",
  bagpipes: "cha",
  drum: "cha",
  dulcimer: "cha",
  flute: "cha",
  horn: "cha",
  lute: "cha",
  lyre: "cha",
  panflute: "cha",
  shawm: "cha",
  viol: "cha"
});

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function preparedTotal(record) {
  if (!record || typeof record !== "object") return null;
  return finite(record.total) ?? finite(record.mod);
}

function coreSkillModifier(actor, skillId) {
  const api = globalThis.game?.modules?.get?.("morelord-core")?.api ?? globalThis.MorelordCore ?? null;
  const read = api?.rolls?.skillModifier;
  if (typeof read !== "function") return null;
  return finite(read(actor, skillId));
}

function proficiencyBonus(actor, rank) {
  const prof = Number(actor?.system?.attributes?.prof ?? 0);
  const value = Number(rank ?? 0);
  if (!Number.isFinite(prof) || !Number.isFinite(value) || value <= 0) return 0;
  const multiplier = value >= 2 ? 2 : value;
  return Math.floor(prof * multiplier);
}

function derivedToolModifier(actor, id, tool) {
  const abilityId = String(tool?.ability ?? TOOL_ABILITY[id] ?? "").trim();
  if (!abilityId) return null;
  const abilityMod = finite(actor?.system?.abilities?.[abilityId]?.mod);
  if (abilityMod == null) return null;
  const bonus = finite(tool?.bonuses?.check) ?? finite(tool?.bonus) ?? 0;
  return abilityMod + proficiencyBonus(actor, tool?.value) + bonus;
}

/** The character's check bonus, or null when no character is chosen. */
export function actorCheckModifier(actor, { kind, id } = {}) {
  if (!actor || !id) return null;
  if (kind === "skill") {
    return coreSkillModifier(actor, id) ?? preparedTotal(actor.system?.skills?.[id]);
  }
  if (kind === "tool") {
    const tool = actor.system?.tools?.[id];
    return preparedTotal(tool) ?? derivedToolModifier(actor, id, tool);
  }
  if (kind === "ability") {
    const ability = actor.system?.abilities?.[id];
    return finite(ability?.check?.mod) ?? finite(ability?.mod);
  }
  return null;
}

export function formatCheckLabel(name, modifier) {
  const label = String(name ?? "").trim();
  if (modifier == null || !Number.isFinite(Number(modifier))) return label;
  const value = Number(modifier);
  return `${label} (${value >= 0 ? `+${value}` : value})`;
}

export function labelForCheck(actor, check) {
  return formatCheckLabel(check?.name, actorCheckModifier(actor, check));
}

export function labelChecks(actor, checks = []) {
  return checks.map(check => ({
    ...check,
    value: check.value ?? check.id,
    label: labelForCheck(actor, check)
  }));
}

export const RELIGIOUS_CHECKS = Object.freeze([
  { kind: "skill", id: "rel", name: "Religion" },
  { kind: "skill", id: "per", name: "Persuasion" }
]);

export const RESEARCH_CHECKS = Object.freeze([
  { kind: "skill", id: "his", name: "History" },
  { kind: "skill", id: "arc", name: "Arcana" },
  { kind: "skill", id: "rel", name: "Religion" },
  { kind: "skill", id: "nat", name: "Nature" },
  { kind: "skill", id: "inv", name: "Investigation" }
]);

export const CRIME_THIRD_CHECKS = Object.freeze([
  { kind: "skill", id: "inv", name: "Investigation" },
  { kind: "skill", id: "prc", name: "Perception" },
  { kind: "skill", id: "dec", name: "Deception" }
]);

export const GAMBLING_CHECKS = Object.freeze([
  { kind: "skill", id: "ins", value: "0", name: "Insight" },
  { kind: "skill", id: "dec", value: "1", name: "Deception" },
  { kind: "skill", id: "itm", value: "2", name: "Intimidation" }
]);

export const GAMBLING_TOOLS = Object.freeze([
  { kind: "tool", id: "dice", name: "Dice" },
  { kind: "tool", id: "card", name: "Playing cards" }
]);

export const PIT_CHECKS = Object.freeze([
  { kind: "skill", id: "ath", name: "Athletics" },
  { kind: "skill", id: "acr", name: "Acrobatics" },
  { kind: "ability", id: "con", name: "Constitution" }
]);

export const SOURCE_ITEM_CHECKS = Object.freeze([
  { kind: "skill", id: "arc", name: "Arcana" },
  { kind: "skill", id: "inv", name: "Investigation" }
]);

export function applyCheckLabels(root, actor) {
  if (!root?.querySelectorAll) return;
  for (const option of root.querySelectorAll("[data-check-kind][data-check-label]")) {
    option.textContent = labelForCheck(actor, {
      kind: option.dataset.checkKind,
      id: option.dataset.checkId || option.value,
      name: option.dataset.checkLabel
    });
  }
}

export async function actorFromUuid(uuid) {
  const value = String(uuid ?? "").trim();
  if (!value) return null;
  if (typeof globalThis.fromUuid === "function") {
    try {
      const actor = await fromUuid(value);
      if (actor) return actor;
    } catch { /* Fall through to the actors collection. */ }
  }
  return globalThis.game?.actors?.get?.(value.split(".").at(-1)) ?? null;
}
