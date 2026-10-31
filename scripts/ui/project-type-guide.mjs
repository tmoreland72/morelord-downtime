/** Facts for the New Project help dialog. Wording matches the activity rules. */

const FIELDS = ["What it does", "Time", "Cost", "Checks", "Location and Session", "Outcome", "Complications"];

function entry(id, name, texts) {
  if (texts.length !== FIELDS.length) throw new Error(`${name} help is missing a section.`);
  return { id, name, fields: FIELDS.map((label, index) => ({ label, text: texts[index] })) };
}

export function projectTypeEntries() {
  return [
    entry("crafting", "Crafting", [
      "Opens Craftworks. Recipes you mark and jobs already underway appear in Downtime Projects. Downtime records the time; Craftworks owns the recipe, the materials, and the item.",
      "Hours spent in Craftworks, including a failed check and a recipe that finishes without a check. While the Session is Active and Crafting is enabled, those hours are added to that character's Session time.",
      "Downtime does not add a fee. Materials and gold stay in Craftworks.",
      "Craftworks makes the crafting checks. Downtime does not roll them.",
      "A recipe stays listed when the scene being viewed, or the active Session's place, can support it. Session hours are recorded only when the character is a participant and Crafting is under Available Activities. Hours spent with no such Session are not added later.",
      "The finished item comes from Craftworks. Downtime shows the progress and, when failed checks make the hours higher than that progress, the hours spent.",
      "None in Downtime. A failed check still spends its hours, and cancelling the craft does not return time already recorded."
    ]),
    entry("training", "Training", [
      "The student learns one skill, language, tool, weapon, armor, or weapon mastery from the world's Configure Sources list.",
      "Languages and tools take (10 minus a positive Intelligence modifier) workweeks, at least one, times 40 hours. An Intelligence modifier of 0 or less is 400 hours. Other subjects use that same hour count, and only a GM can change Required Hours. A character instructor spends the same hours as the student.",
      "No gold.",
      "No check. Finishing applies the proficiency to the student.",
      "Project Location is optional and can stay on No fixed Location. An NPC instructor is limited to that location's Instructor specialties once a location applies. Hours come from an active Session that includes the characters and has Training enabled. The instructor sees the project read-only, labeled Instructing the student.",
      "The student gains the chosen proficiency.",
      "None. Cancelling or deleting the project returns the Session hours to the student and the instructor."
    ]),
    entry("source-item", "Source Item", [
      "Searches for one Common through Legendary magic item on the character's Marketplace wishlist.",
      "At least one week, which is 7 days. Each extra week adds 2 to the check. Advance Day moves the project. When the active Session includes the character and Source Item, each day that progresses spends 8 Session hours.",
      "At least 100 gp, paid when the project starts and not refunded. Each extra 250 gp adds 2 to the check.",
      "When the weeks end, the owner rolls Arcana or Investigation from a chat request. A GM can roll it if that player is offline. Request Persuasion Roll is a second chat check against the sourcing DC. Failing by 5 or more raises the price 10%. Failing by 1 to 4 raises it 5%. Meeting the DC, or beating it by less than 5, leaves it unchanged. Beating it by 5 to 9 lowers it 10%, by 10 to 14 lowers it 20%, and by 15 or more lowers it 25%. The price cannot rise by more than 10% or fall by more than 25%.",
      "A Location is required. The project advances on Advance Day. Session hours are spent only while that Session includes the character and Source Item.",
      "A success offers the requested item and says it must be picked up at the project's Location, naming that place. A failure offers 1d4 Marketplace alternatives of the same or lower rarity.",
      "None beyond a failed search and the Persuasion price change. The first investment is not returned."
    ]),
    entry("religious-service", "Religious Service", [
      "A week of service at a temple. The result is a recorded favor, not a spell the module casts.",
      "7 days.",
      "No gold.",
      "The player chooses Religion or Persuasion. One check, rolled from chat when the week ends.",
      "The Location must have a Temple. The week advances only while an active Session is at that Location, the character is a participant, and Religious Service is enabled. It does not advance while the character is away.",
      "10 or less grants no favor. 11 to 20 grants one favor. 21 or more grants two favors.",
      "A 10% chance, on a d100 roll of 1 to 10. The complication is a short note for the GM."
    ]),
    entry("carousing", "Carousing", [
      "A week spent with people the player names. Those names are notes, not actors.",
      "7 days.",
      "Lower class is 10 gp, middle class is 50 gp, and upper class is 250 gp. Upper class also needs a GM to confirm access to the local nobility. The gold is taken from the character when the project starts.",
      "One Persuasion check, rolled from chat when the week ends.",
      "Any Location. The week advances only while an active Session is at the project's Location, the character is a participant, and Carousing is enabled. It does not advance while the character is away.",
      "5 or less adds one hostile contact. 6 to 10 adds none. 11 to 15 adds one allied contact. 16 to 20 adds two. 21 or more adds three.",
      "A 10% chance, on a d100 roll of 1 to 10. The complication is a short note for the GM."
    ]),
    entry("crime", "Crime", [
      "A week spent on a job the player describes.",
      "7 days.",
      "25 gp, taken from the character when the project starts.",
      "The player picks DC 10, 15, 20, or 25. Three checks use that DC: Stealth, Thieves' Tools, and one of Investigation, Perception, or Deception.",
      "Any Location. The week advances only while an active Session is at the project's Location, the character is a participant, and Crime is enabled. It does not advance while the character is away.",
      "The chosen DC pays 50, 100, 200, or 1,000 gp. No successes: the fine equals that amount, and the jail term is that amount divided by 25 weeks, recorded for the GM. One success: no loot. Two successes: half the loot, rounded down. Three successes: the full loot.",
      "Only on exactly one success. Zero successes and two or three successes do not roll a complication."
    ]),
    entry("gambling", "Gambling", [
      "A week of games. The stake is paid at the start, and the result pays the character or records a debt.",
      "7 days.",
      "A whole number of gp from 10 to 1,000. A higher stake needs a GM. The stake is taken from the character when the project starts.",
      "Insight, Deception, and Intimidation. A dice set or a card set can replace one of them. Each DC is 5 plus 2d10, set when that check is requested.",
      "Any Location. The week advances only while an active Session is at the project's Location, the character is a participant, and Gambling is enabled. It does not advance while the character is away.",
      "No successes: a debt equal to the stake, collected up to the cash on hand. One success: half the stake, rounded down, is returned. Two successes: the stake plus half the stake, rounded down, is paid. Three successes: double the stake is paid.",
      "A 10% chance, on a d100 roll of 1 to 10. The complication is a short note for the GM."
    ]),
    entry("pit-fighting", "Pit Fighting", [
      "A week of bouts. The purse is paid to the character. No arena has to be added to the Location.",
      "7 days.",
      "No gold to enter.",
      "Athletics, Acrobatics, and Constitution. A weapon attack can replace one of them. Constitution is an ability check plus one roll of the largest class Hit Die, or a d8 when the character has none. Each DC is 5 plus 2d10.",
      "Any Location. The week advances only while an active Session is at the project's Location, the character is a participant, and Pit Fighting is enabled. It does not advance while the character is away.",
      "The purse is 0, 50, 100, or 200 gp for zero, one, two, or three successes.",
      "A 10% chance, on a d100 roll of 1 to 10. The complication is a short note for the GM."
    ]),
    entry("relaxation", "Relaxation", [
      "A quiet week. It clears Exhaustion and records the other benefits of the rest for the GM.",
      "7 days.",
      "7 gp, one modest day for each day, taken from the character when the project starts.",
      "No check.",
      "Any Location. This one advances on Advance Day, and on elapsed travel days, even when no Session is active and even when the character is away.",
      "Every Exhaustion level is removed. During the rest, saves against long-acting diseases and poisons have advantage. The GM may end one effect that prevents regaining hit points, or restore one reduced ability score. Those two choices are recorded and are not applied automatically.",
      "A 10% chance, on a d100 roll of 1 to 10, because this rest has no set trigger. The complication is a short note for the GM."
    ]),
    entry("lore-research", "Research", [
      "A week spent answering one question the player writes. This is separate from Research Drakkenheim Recipes.",
      "7 days.",
      "50 gp, plus extra gold in steps of 100 up to 600 gp. Each 100 gp adds 1 to the check, to a maximum of 6. The gold is taken from the character when the project starts.",
      "The player chooses History, Arcana, Religion, Nature, or Investigation. The extra-gold bonus is added to that total.",
      "The Location must have a Library. This one advances on Advance Day, and on elapsed travel days, even when no Session is active and even when the character is away.",
      "5 or less turns up nothing useful. 6 to 10 turns up one fact. 11 to 20 turns up two. 21 or more turns up three.",
      "A 10% chance, on a d100 roll of 1 to 10. The complication is a short note for the GM."
    ]),
    entry("commission", "Commission", [
      "Tracks contracted work. Choosing an item does not buy it, craft it, or deliver it.",
      "Labor days. The starting estimate is 5, 10, 50, 125, or 250 days for Common, Uncommon, Rare, Very Rare, or Legendary, halved and rounded up for a consumable. A mundane item uses its list price in gp divided by 10, rounded up to at least one day. Scrolls and artifacts need a GM estimate. Advance Day moves the project. A progressed day does not spend Session hours.",
      "Payment and materials are notes on the project. Downtime does not take gold for them.",
      "No check.",
      "A Location is required, and finished work is collected there. Commission is not an Available Activities choice. It advances on Advance Day with no Session hour charge.",
      "Finished work waits at the Location until it is collected.",
      "None."
    ]),
    entry("research-drakkenheim-recipes", "Research Drakkenheim Recipes", [
      "Studies one monster component from the character's inventory, or from a party they belong to, and records matching recipes. This choice appears only while that content pack is available.",
      "One hour, allocated in a Session that allows Research Drakkenheim Recipes. The component is not consumed.",
      "No gold.",
      "No check.",
      "The Session must be active, include the character, and have this activity enabled. It does not advance on Advance Day by itself.",
      "Up to five distinct recipes that match the component. Fewer matches returns all of them. The recipes become known, and View Recipe opens one in Craftworks. Research does not supply the ingredients.",
      "None. Repeating the search is a new project and can return a recipe already seen."
    ])
  ];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

export function projectTypeGuideShell(entries = projectTypeEntries()) {
  const sections = entries.map(item => `<section class="ml-stack" data-gap="2"><h2>${escapeHtml(item.name)}</h2><dl class="ml-data-list">${
    item.fields.map(field => `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.text)}</dd></div>`).join("")
  }</dl></section>`).join("");
  return `<div class="ml-app ml-app-shell ml-dialog-shell ml-stack" data-gap="4"><header class="ml-hero"><i class="fa-regular fa-circle-question ml-hero__icon" aria-hidden="true"></i><div class="ml-hero__body"><h1>Project Types</h1><p>What each New Project choice does, what it costs, and when it advances.</p></div></header>${sections}</div>`;
}

/** DialogV2 content. The outer element has no attributes. */
export function projectTypeDialogContent(entries = projectTypeEntries()) {
  return `<div>${projectTypeGuideShell(entries)}</div>`;
}

export function openProjectTypeGuide() {
  return foundry.applications.api.DialogV2.wait({
    id: "morelord-downtime-project-types",
    classes: ["ml-window", "ml-downtime-module"],
    window: { title: "Project Types", icon: "fa-regular fa-circle-question", resizable: true },
    position: { width: 720, height: 640 },
    rejectClose: false,
    content: projectTypeDialogContent(),
    buttons: [{ action: "close", label: "Close", default: true }]
  });
}
