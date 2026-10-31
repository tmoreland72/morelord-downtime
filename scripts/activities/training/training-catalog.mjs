/**
 * D&D 2024 (SRD 5.2 / 2024 PHB) training subjects.
 * Ids are the dnd5e proficiency keys. Labels are the 2024 names.
 * This list does not follow Configure Sources.
 * A weapon mastery uses the same id as that weapon.
 */

const SKILL = "Skill Proficiency";
const LANGUAGE = "Language";
const TOOL = "Tool Proficiency";
const WEAPON = "Weapon Proficiency";
const ARMOR = "Armor Training";
const MASTERY = "Weapon Mastery";

const CATEGORY_BY_KIND = Object.freeze({
  skillProficiency: SKILL,
  language: LANGUAGE,
  toolProficiency: TOOL,
  artisanTool: TOOL,
  tool: TOOL,
  weaponProficiency: WEAPON,
  armorProficiency: ARMOR,
  weaponMastery: MASTERY
});

function choice(kind, id, label, category) {
  return Object.freeze({ kind, id, label, category, value: `${kind}:${id}` });
}

function choices(kind, category, entries) {
  return entries.map(([id, label]) => choice(kind, id, label, category));
}

const SKILLS = choices("skillProficiency", SKILL, [
  ["acr", "Acrobatics"],
  ["ani", "Animal Handling"],
  ["arc", "Arcana"],
  ["ath", "Athletics"],
  ["dec", "Deception"],
  ["his", "History"],
  ["ins", "Insight"],
  ["itm", "Intimidation"],
  ["inv", "Investigation"],
  ["med", "Medicine"],
  ["nat", "Nature"],
  ["prc", "Perception"],
  ["prf", "Performance"],
  ["per", "Persuasion"],
  ["rel", "Religion"],
  ["slt", "Sleight of Hand"],
  ["ste", "Stealth"],
  ["sur", "Survival"]
]);

const LANGUAGES = choices("language", LANGUAGE, [
  ["common", "Common"],
  ["sign", "Common Sign Language"],
  ["draconic", "Draconic"],
  ["dwarvish", "Dwarvish"],
  ["elvish", "Elvish"],
  ["giant", "Giant"],
  ["gnomish", "Gnomish"],
  ["goblin", "Goblin"],
  ["halfling", "Halfling"],
  ["orc", "Orc"],
  ["abyssal", "Abyssal"],
  ["celestial", "Celestial"],
  ["deep", "Deep Speech"],
  ["druidic", "Druidic"],
  ["infernal", "Infernal"],
  ["primordial", "Primordial"],
  ["sylvan", "Sylvan"],
  ["cant", "Thieves' Cant"],
  ["undercommon", "Undercommon"]
]);

const TOOLS = choices("toolProficiency", TOOL, [
  ["alchemist", "Alchemist's Supplies"],
  ["brewer", "Brewer's Supplies"],
  ["calligrapher", "Calligrapher's Supplies"],
  ["carpenter", "Carpenter's Tools"],
  ["cartographer", "Cartographer's Tools"],
  ["cobbler", "Cobbler's Tools"],
  ["cook", "Cook's Utensils"],
  ["glassblower", "Glassblower's Tools"],
  ["jeweler", "Jeweler's Tools"],
  ["leatherworker", "Leatherworker's Tools"],
  ["mason", "Mason's Tools"],
  ["painter", "Painter's Supplies"],
  ["potter", "Potter's Tools"],
  ["smith", "Smith's Tools"],
  ["tinker", "Tinker's Tools"],
  ["weaver", "Weaver's Tools"],
  ["woodcarver", "Woodcarver's Tools"],
  ["disg", "Disguise Kit"],
  ["forg", "Forgery Kit"],
  ["herb", "Herbalism Kit"],
  ["navg", "Navigator's Tools"],
  ["pois", "Poisoner's Kit"],
  ["thief", "Thieves' Tools"],
  ["dice", "Dice"],
  ["chess", "Dragonchess"],
  ["card", "Playing Cards"],
  ["threedragon", "Three-Dragon Ante"],
  ["bagpipes", "Bagpipes"],
  ["drum", "Drum"],
  ["dulcimer", "Dulcimer"],
  ["flute", "Flute"],
  ["horn", "Horn"],
  ["lute", "Lute"],
  ["lyre", "Lyre"],
  ["panflute", "Pan Flute"],
  ["shawm", "Shawm"],
  ["viol", "Viol"]
]);

const WEAPONS = choices("weaponProficiency", WEAPON, [
  ["sim", "Simple Weapons"],
  ["mar", "Martial Weapons"],
  ["battleaxe", "Battleaxe"],
  ["blowgun", "Blowgun"],
  ["club", "Club"],
  ["dagger", "Dagger"],
  ["dart", "Dart"],
  ["flail", "Flail"],
  ["glaive", "Glaive"],
  ["greataxe", "Greataxe"],
  ["greatclub", "Greatclub"],
  ["greatsword", "Greatsword"],
  ["halberd", "Halberd"],
  ["handaxe", "Handaxe"],
  ["handcrossbow", "Hand Crossbow"],
  ["heavycrossbow", "Heavy Crossbow"],
  ["javelin", "Javelin"],
  ["lance", "Lance"],
  ["lightcrossbow", "Light Crossbow"],
  ["lighthammer", "Light Hammer"],
  ["longbow", "Longbow"],
  ["longsword", "Longsword"],
  ["mace", "Mace"],
  ["maul", "Maul"],
  ["morningstar", "Morningstar"],
  ["musket", "Musket"],
  ["pike", "Pike"],
  ["pistol", "Pistol"],
  ["quarterstaff", "Quarterstaff"],
  ["rapier", "Rapier"],
  ["scimitar", "Scimitar"],
  ["shortbow", "Shortbow"],
  ["shortsword", "Shortsword"],
  ["sickle", "Sickle"],
  ["sling", "Sling"],
  ["spear", "Spear"],
  ["trident", "Trident"],
  ["warpick", "War Pick"],
  ["warhammer", "Warhammer"],
  ["whip", "Whip"]
]);

const ARMOR_CHOICES = choices("armorProficiency", ARMOR, [
  ["lgt", "Light Armor"],
  ["med", "Medium Armor"],
  ["hvy", "Heavy Armor"],
  ["shl", "Shields"],
  ["padded", "Padded Armor"],
  ["leather", "Leather Armor"],
  ["studded", "Studded Leather Armor"],
  ["hide", "Hide Armor"],
  ["chainshirt", "Chain Shirt"],
  ["scalemail", "Scale Mail"],
  ["breastplate", "Breastplate"],
  ["halfplate", "Half Plate Armor"],
  ["ringmail", "Ring Mail"],
  ["chainmail", "Chain Mail"],
  ["splint", "Splint Armor"],
  ["plate", "Plate Armor"],
  ["shield", "Shield"]
]);

const MASTERIES = WEAPONS
  .filter(entry => entry.id !== "sim" && entry.id !== "mar")
  .map(entry => choice("weaponMastery", entry.id, entry.label, MASTERY));

const TOOL_ABILITIES = Object.freeze({
  dice: "wis",
  chess: "wis",
  card: "wis",
  threedragon: "wis"
});

function byLabel(left, right) {
  return left.label.localeCompare(right.label)
    || left.category.localeCompare(right.category)
    || left.kind.localeCompare(right.kind)
    || left.id.localeCompare(right.id);
}

export const TRAINING_CATALOG = Object.freeze(
  [...SKILLS, ...LANGUAGES, ...TOOLS, ...WEAPONS, ...ARMOR_CHOICES, ...MASTERIES].sort(byLabel)
);

const CATALOG_KEYS = new Set(TRAINING_CATALOG.map(entry => entry.value));

export function trainingCatalogKind(kind) {
  if (kind === "artisanTool" || kind === "tool") return "toolProficiency";
  return String(kind ?? "");
}

export function isOfferedTraining(kind, id) {
  return CATALOG_KEYS.has(`${trainingCatalogKind(kind)}:${String(id ?? "").trim()}`);
}

export function trainingToolAbility(id) {
  return TOOL_ABILITIES[id] ?? null;
}

/** A saved subject that is no longer offered. New projects do not receive one. */
export function retainedTrainingChoice(training) {
  const id = String(training?.proficiencyId ?? "").trim();
  if (!id) return null;
  const kind = trainingCatalogKind(training.kind);
  if (!CATEGORY_BY_KIND[kind] || isOfferedTraining(kind, id)) return null;
  const label = String(training.proficiencyLabel ?? "").trim() || id;
  return {
    kind,
    id,
    label,
    category: CATEGORY_BY_KIND[kind],
    value: `${kind}:${id}`,
    retained: true
  };
}
