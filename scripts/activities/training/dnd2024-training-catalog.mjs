/**
 * Fixed D&D 2024 (SRD 5.2) training subjects.
 * Ids match Morelord Core's `api.locations.listTrainingSpecialties()`.
 * Labels are the 2024 names. This list does not read CONFIG.DND5E, Configure Sources, or compendium items.
 * A weapon mastery uses the same id as that weapon's proficiency.
 */

const SKILL = "Skill Proficiency";
const LANGUAGE = "Language";
const TOOL = "Tool Proficiency";
const WEAPON = "Weapon Proficiency";
const ARMOR = "Armor Proficiency";
const MASTERY = "Weapon Mastery";

function choice(kind, id, label, category) {
  return Object.freeze({ kind, id, label, category, trainingValue: `${kind}:${id}` });
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
  ["art", "Artisan's Tools"],
  ["game", "Gaming Set"],
  ["music", "Musical Instrument"],
  ["vehicle", "Vehicles"],
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
  ["dice", "Dice Set"],
  ["chess", "Dragonchess Set"],
  ["card", "Playing Card Set"],
  ["bagpipes", "Bagpipes"],
  ["drum", "Drum"],
  ["dulcimer", "Dulcimer"],
  ["flute", "Flute"],
  ["horn", "Horn"],
  ["lute", "Lute"],
  ["lyre", "Lyre"],
  ["panflute", "Pan Flute"],
  ["shawm", "Shawm"],
  ["viol", "Viol"],
  ["land", "Vehicles (Land)"],
  ["water", "Vehicles (Water)"]
]);

const WEAPON_PROFICIENCIES = choices("weaponProficiency", WEAPON, [
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

const ARMOR_PROFICIENCIES = choices("armorProficiency", ARMOR, [
  ["lgt", "Light Armor"],
  ["med", "Medium Armor"],
  ["hvy", "Heavy Armor"],
  ["shl", "Shields"],
  ["padded", "Padded Armor"],
  ["leather", "Leather Armor"],
  ["studded", "Studded Leather"],
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

const WEAPON_MASTERIES = WEAPON_PROFICIENCIES
  .filter(entry => entry.id !== "sim" && entry.id !== "mar")
  .map(entry => choice("weaponMastery", entry.id, entry.label, MASTERY));

function bySpecialty(left, right) {
  return left.label.localeCompare(right.label)
    || left.category.localeCompare(right.category)
    || left.kind.localeCompare(right.kind)
    || left.id.localeCompare(right.id);
}

export const DND2024_TRAINING_CHOICES = Object.freeze(
  [...SKILLS, ...LANGUAGES, ...TOOLS, ...WEAPON_PROFICIENCIES, ...ARMOR_PROFICIENCIES, ...WEAPON_MASTERIES]
    .sort(bySpecialty)
);

export function coreTrainingCatalog() {
  try {
    const list = globalThis.game?.modules?.get?.("morelord-core")?.api?.locations?.listTrainingSpecialties
      ?? globalThis.MorelordCore?.locations?.listTrainingSpecialties
      ?? null;
    const entries = typeof list === "function" ? list() : null;
    if (!Array.isArray(entries) || !entries.length) return null;
    if (!entries.every(entry => entry?.id && entry?.kind && entry?.label)) return null;
    return entries;
  } catch {
    return null;
  }
}

export function trainingCatalogEntries(catalog = null) {
  const provided = typeof catalog === "function" ? catalog() : catalog;
  if (Array.isArray(provided) && provided.length) return provided;
  return coreTrainingCatalog() ?? DND2024_TRAINING_CHOICES;
}
