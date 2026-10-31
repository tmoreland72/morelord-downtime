/** Seven Xanathar downtime activities. Numbers are the book's; wording is ours. */

export const XGE_DAYS = 7;

export const XGE_ACTIVITIES = Object.freeze({
  "religious-service": { name: "Religious Service", presence: true, capability: "temple" },
  carousing: { name: "Carousing", presence: true, capability: null },
  crime: { name: "Crime", presence: true, capability: null },
  gambling: { name: "Gambling", presence: true, capability: null },
  "pit-fighting": { name: "Pit Fighting", presence: true, capability: null },
  relaxation: { name: "Relaxation", presence: false, capability: null },
  "lore-research": { name: "Research", presence: false, capability: "library" }
});

export const XGE_ACTIVITY_IDS = Object.freeze(Object.keys(XGE_ACTIVITIES));

const CRIME_LOOT = Object.freeze({ 10: 50, 15: 100, 20: 200, 25: 1000 });
const CAROUSING_COST = Object.freeze({ lower: 10, middle: 50, upper: 250 });

export function xgeActivity(activityType) {
  return XGE_ACTIVITIES[activityType] ?? null;
}

export function xgePolicy(activityType) {
  const activity = xgeActivity(activityType);
  if (!activity) return null;
  return activity.presence ? "present" : "away";
}

export function locationHasCapability(location, type) {
  if (!type) return true;
  return (location?.capabilities ?? []).some(capability => String(capability?.type ?? capability?.id ?? "") === type);
}

export function presenceAllows(project, session) {
  if (!session || session.status !== "active") return false;
  if (!project?.locationId || session.locationId !== project.locationId) return false;
  if (!session.participants?.some(entry => entry.actorUuid === project.owner?.uuid)) return false;
  if (!session.availableActivities?.includes(project.activityType)) return false;
  return true;
}

/** Away activities ignore the session day cap. Everyone else stops when that cap is spent. */
export function elapsedDayApplies(project, { session = null, sessionDaysBlocked = false } = {}) {
  const policy = xgePolicy(project?.activityType);
  if (policy === "away") return true;
  if (policy === "present") return !sessionDaysBlocked && presenceAllows(project, session);
  return !sessionDaysBlocked;
}

export function carousingCost(socialClass) {
  const cost = CAROUSING_COST[socialClass];
  if (!cost) throw new Error("Choose lower, middle, or upper class.");
  return cost;
}

export function crimeLoot(dc) {
  const loot = CRIME_LOOT[Number(dc)];
  if (!loot) throw new Error("Crime difficulty must be 10, 15, 20, or 25.");
  return loot;
}

export function researchBonus(extraGp) {
  const extra = Number(extraGp ?? 0);
  if (!Number.isInteger(extra) || extra < 0 || extra > 600 || extra % 100 !== 0) {
    throw new Error("Extra research spending must be 0 to 600 gp, in steps of 100.");
  }
  return extra / 100;
}

export function gamblingStake(stakeGp, { allowHighStake = false } = {}) {
  const stake = Number(stakeGp);
  if (!Number.isInteger(stake) || stake < 10) throw new Error("The bet must be a whole number of at least 10 gp.");
  if (stake > 1000 && !allowHighStake) throw new Error("The bet cannot be more than 1,000 gp unless a GM allows it.");
  return stake;
}

export function oppositionDc(first, second) {
  const a = Number(first);
  const b = Number(second);
  if (!Number.isInteger(a) || a < 1 || a > 10 || !Number.isInteger(b) || b < 1 || b > 10) {
    throw new Error("Opposition uses two d10 rolls.");
  }
  return 5 + a + b;
}

export function contactResult(total) {
  const score = Number(total);
  if (score <= 5) return { hostile: 1, allied: 0, summary: "One hostile contact." };
  if (score <= 10) return { hostile: 0, allied: 0, summary: "No new contacts." };
  if (score <= 15) return { hostile: 0, allied: 1, summary: "One allied contact." };
  if (score <= 20) return { hostile: 0, allied: 2, summary: "Two allied contacts." };
  return { hostile: 0, allied: 3, summary: "Three allied contacts." };
}

export function favorResult(total) {
  const score = Number(total);
  if (score <= 10) return { favors: 0, summary: "The temple grants no favor." };
  if (score <= 20) return { favors: 1, summary: "The temple grants one favor." };
  return { favors: 2, summary: "The temple grants two favors." };
}

export function loreResult(total) {
  const score = Number(total);
  if (score <= 5) return { lore: 0, summary: "The research turns up nothing useful." };
  if (score <= 10) return { lore: 1, summary: "The research turns up one useful fact." };
  if (score <= 20) return { lore: 2, summary: "The research turns up two useful facts." };
  return { lore: 3, summary: "The research turns up three useful facts." };
}

export function crimeResult(dc, totals) {
  const loot = crimeLoot(dc);
  const successes = (totals ?? []).filter(total => Number(total) >= Number(dc)).length;
  if (successes <= 0) {
    return {
      successes,
      payoutGp: 0,
      fineGp: loot,
      jailWeeks: loot / 25,
      complication: false,
      summary: `Caught. The fine is ${loot} gp, and the jail term is ${loot / 25} weeks for the GM to apply.`
    };
  }
  if (successes === 1) {
    return {
      successes,
      payoutGp: 0,
      fineGp: 0,
      jailWeeks: 0,
      complication: true,
      summary: "The job fails, but you get away with nothing."
    };
  }
  const payoutGp = successes === 2 ? Math.floor(loot / 2) : loot;
  return {
    successes,
    payoutGp,
    fineGp: 0,
    jailWeeks: 0,
    complication: false,
    summary: successes === 2 ? `Partial success. The take is ${payoutGp} gp.` : `The job pays ${payoutGp} gp.`
  };
}

export function gamblingResult(stakeGp, totals, dcs) {
  const stake = Number(stakeGp);
  const successes = (totals ?? []).filter((total, index) => Number(total) >= Number(dcs[index])).length;
  if (successes <= 0) {
    return { successes, payoutGp: 0, debtGp: stake, summary: `You lose the ${stake} gp bet and owe another ${stake} gp.` };
  }
  if (successes === 1) {
    return { successes, payoutGp: Math.floor(stake / 2), debtGp: 0, summary: `You lose half the bet. ${Math.floor(stake / 2)} gp is returned.` };
  }
  if (successes === 2) {
    const payoutGp = stake + Math.floor(stake / 2);
    return { successes, payoutGp, debtGp: 0, summary: `You gain the bet plus half again: ${payoutGp} gp.` };
  }
  return { successes, payoutGp: stake * 2, debtGp: 0, summary: `You gain double the bet: ${stake * 2} gp.` };
}

export function pitFightingResult(totals, dcs) {
  const successes = (totals ?? []).filter((total, index) => Number(total) >= Number(dcs[index])).length;
  const purses = [0, 50, 100, 200];
  const payoutGp = purses[Math.min(3, successes)];
  const summary = payoutGp ? `You win ${payoutGp} gp.` : "You lose the bouts and earn nothing.";
  return { successes, payoutGp, debtGp: 0, summary };
}

const COMPLICATIONS = Object.freeze({
  carousing: [
    "A rumor sticks to you.",
    "A brawl leaves you responsible for the damage.",
    "You owe a small debt to someone at the gathering.",
    "A rival notices you and starts working against you.",
    "You are mistaken for someone else and pulled into their trouble.",
    "A contact expects a favor before they will help."
  ],
  crime: [
    "The watch has your description.",
    "The victim asks an ally to look into the theft.",
    "A fence will shortchange the next job.",
    "A rival claims you stepped on their work.",
    "A witness can identify you.",
    "The goods are marked and hard to sell."
  ],
  gambling: [
    "You are accused of cheating.",
    "The watch breaks up the game and holds you.",
    "A loser promises to get even.",
    "A thieves' guild wants its money back.",
    "A crime boss wants you at their table only.",
    "A high-stakes gambler demands another game."
  ],
  "pit-fighting": [
    "An opponent swears revenge.",
    "Someone offers to pay you to throw a match.",
    "Beating a favorite turns the crowd against you.",
    "A noble takes offense at the loss of their fighter.",
    "You are accused of cheating.",
    "A blow lands harder than you meant."
  ],
  "religious-service": [
    "A rival faith spreads a rumor about you.",
    "The temple asks for a service in return.",
    "An officiant questions your motives.",
    "A sacred object goes missing while you are there.",
    "Your devotion offends a local custom.",
    "A worshiper mistakes you for a messenger and will not let it go."
  ],
  "lore-research": [
    "A source is wrong and wastes the next lead.",
    "A book you needed is damaged.",
    "Someone else is researching the same question.",
    "The library wants the notes kept quiet.",
    "A name in the sources belongs to someone who would rather stay hidden.",
    "The useful volume is already in a rival's hands."
  ],
  relaxation: [
    "The rest is interrupted. The GM may shorten a recorded benefit.",
    "An extra modest expense comes due.",
    "A visitor brings news that cuts the quiet short.",
    "A minor illness slows the week. It does not add Exhaustion.",
    "A loud neighbor ruins a night of sleep.",
    "Someone asks for help and will not wait."
  ]
});

export function complicationLine(activityType, face) {
  const table = COMPLICATIONS[activityType] ?? [];
  const index = Number(face) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= table.length) throw new Error("Complication rolls use a d6.");
  return table[index];
}

/** Book triggers. Relaxation has none, so it uses a 10% chance. */
export function complicationOccurs(activityType, { successes = 0, d100 = null } = {}) {
  if (activityType === "crime") return successes === 1;
  if (!["carousing", "gambling", "pit-fighting", "religious-service", "lore-research", "relaxation"].includes(activityType)) return false;
  return Number(d100) >= 1 && Number(d100) <= 10;
}

export function relaxationBenefits() {
  return {
    exhaustionCleared: true,
    saveAdvantage: "While this rest is underway, saves against long-acting diseases and poisons have advantage.",
    recovery: "End one effect that prevents regaining hit points, or restore one ability score that has been reduced. The GM applies that choice.",
    summary: "All Exhaustion is removed. Saves against long-acting diseases and poisons had advantage during the rest. One effect that prevents regaining hit points can be ended, or one reduced ability score can be restored."
  };
}

export function xgeCost(activityType, data = {}, { isGm = false } = {}) {
  if (activityType === "carousing") return carousingCost(data.socialClass);
  if (activityType === "crime") return 25;
  if (activityType === "gambling") return gamblingStake(data.stakeGp, { allowHighStake: isGm && data.allowHighStake === true });
  if (activityType === "lore-research") return 50 + Number(data.extraGp ?? 0);
  if (activityType === "relaxation") return XGE_DAYS;
  return 0;
}

function check(spec) {
  return { dc: null, total: null, ...spec };
}

export function xgeChecks(activityType, data = {}) {
  if (activityType === "religious-service") {
    const skill = data.skill === "per" ? "per" : data.skill === "rel" ? "rel" : null;
    if (!skill) throw new Error("Choose Religion or Persuasion.");
    return [check({ kind: "skill", skill, label: skill === "per" ? "Persuasion" : "Religion" })];
  }
  if (activityType === "carousing") return [check({ kind: "skill", skill: "per", label: "Persuasion" })];
  if (activityType === "lore-research") {
    const skills = { his: "History", arc: "Arcana", rel: "Religion", nat: "Nature", inv: "Investigation" };
    if (!skills[data.skill]) throw new Error("Choose History, Arcana, Religion, Nature, or Investigation.");
    return [check({ kind: "skill", skill: data.skill, label: skills[data.skill], bonus: researchBonus(data.extraGp) })];
  }
  if (activityType === "crime") {
    crimeLoot(data.crimeDc);
    const third = { inv: "Investigation", prc: "Perception", dec: "Deception" }[data.thirdSkill];
    if (!third) throw new Error("Choose Investigation, Perception, or Deception for the third check.");
    return [
      check({ kind: "skill", skill: "ste", label: "Stealth", dc: Number(data.crimeDc) }),
      check({ kind: "tool", tool: "thief", label: "Thieves' Tools", dc: Number(data.crimeDc) }),
      check({ kind: "skill", skill: data.thirdSkill, label: third, dc: Number(data.crimeDc) })
    ];
  }
  if (activityType === "gambling") {
    const specs = [
      { kind: "skill", skill: "ins", label: "Insight" },
      { kind: "skill", skill: "dec", label: "Deception" },
      { kind: "skill", skill: "itm", label: "Intimidation" }
    ];
    if (data.gamingSet) {
      const index = Number(data.replaceIndex ?? 0);
      if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error("Choose which gambling check the gaming set replaces.");
      specs[index] = { kind: "tool", tool: String(data.gamingSet), label: "Gaming set" };
    }
    return specs.map(check);
  }
  if (activityType === "pit-fighting") {
    const specs = [
      { kind: "skill", skill: "ath", label: "Athletics" },
      { kind: "skill", skill: "acr", label: "Acrobatics" },
      { kind: "constitution", ability: "con", label: "Constitution" }
    ];
    if (data.replaceWithAttack) {
      const index = { ath: 0, acr: 1, con: 2 }[data.replaceWithAttack];
      if (index == null) throw new Error("Choose Athletics, Acrobatics, or Constitution to replace with an attack.");
      specs[index] = { kind: "attack", weaponUuid: data.weaponUuid ? String(data.weaponUuid) : null, label: "Weapon attack" };
    }
    return specs.map(check);
  }
  return [];
}

export function resolveXgeOutcome(project) {
  const xge = project.metadata.xge;
  const totals = xge.checks.map(entry => Number(entry.total) + Number(entry.bonus ?? 0));
  const dcs = xge.checks.map(entry => entry.dc);
  if (project.activityType === "carousing") return { ...contactResult(totals[0]), payoutGp: 0, debtGp: 0, fineGp: 0 };
  if (project.activityType === "religious-service") return { ...favorResult(totals[0]), payoutGp: 0, debtGp: 0, fineGp: 0 };
  if (project.activityType === "lore-research") return { ...loreResult(totals[0]), payoutGp: 0, debtGp: 0, fineGp: 0 };
  if (project.activityType === "crime") return crimeResult(xge.crimeDc, totals);
  if (project.activityType === "gambling") return gamblingResult(xge.stakeGp, totals, dcs);
  if (project.activityType === "pit-fighting") return pitFightingResult(totals, dcs);
  if (project.activityType === "relaxation") return { ...relaxationBenefits(), payoutGp: 0, debtGp: 0, fineGp: 0 };
  throw new Error("This Project has no downtime resolution.");
}

export function xgeSummary(project) {
  const outcome = project.metadata?.xge?.outcome;
  const elapsed = project.progress?.elapsed;
  if (outcome?.summary) return outcome.summary;
  if (!elapsed) return project.name;
  return `${elapsed.completedDays} / ${elapsed.requiredDays} days`;
}
