import { appendHistory, createProject } from "../../domain/project.mjs";
import {
  XGE_DAYS,
  complicationLine,
  complicationOccurs,
  locationHasCapability,
  relaxationBenefits,
  researchBonus,
  resolveXgeOutcome,
  xgeActivity,
  xgeChecks,
  xgeCost
} from "./xge-rules.mjs";

const CAPABILITY_LABEL = { temple: "Temple", library: "Library" };

export function buildXgeProject(data = {}, { isGm = false, location = null, idFactory, now } = {}) {
  const activityType = String(data.activityType ?? "").trim();
  const activity = xgeActivity(activityType);
  if (!activity) throw new Error("Unknown downtime activity.");
  const locationId = String(data.locationId ?? "").trim();
  if (!locationId) throw new Error(`${activity.name} requires a Location.`);
  if (!locationHasCapability(location, activity.capability)) {
    throw new Error(`${activity.name} requires a location with a ${CAPABILITY_LABEL[activity.capability]}.`);
  }
  if (activityType === "carousing") {
    if (!String(data.npcNames ?? "").trim()) throw new Error("Name the NPCs you carouse with.");
    if (data.socialClass === "upper" && data.nobilityAccess !== true) {
      throw new Error("Upper-class carousing needs access to the local nobility. A GM must confirm that access.");
    }
    if (data.nobilityAccess === true && !isGm) throw new Error("Only a GM can confirm access to the local nobility.");
  }
  if (activityType === "crime" && !String(data.crimeNotes ?? "").trim()) throw new Error("Describe the crime.");
  if (activityType === "lore-research" && !String(data.question ?? "").trim()) throw new Error("Write the research question.");
  if (activityType === "lore-research") researchBonus(data.extraGp);
  const costGp = xgeCost(activityType, data, { isGm });
  const checks = xgeChecks(activityType, data);
  const priorMetadata = { ...(data.metadata ?? {}) };
  if (priorMetadata.xge?.waiveLocation != null) {
    const { waiveLocation: _dropped, ...xgeRest } = priorMetadata.xge;
    priorMetadata.xge = xgeRest;
  }
  const project = createProject({
    ...data,
    name: data.name ?? activity.name,
    activityType,
    status: data.status ?? "active",
    locationId,
    progress: { mode: "elapsed", elapsed: { requiredDays: XGE_DAYS, completedDays: Number(data.completedDays ?? 0) } },
    costs: costGp ? [{ type: "currency", denomination: "gp", amount: costGp, purpose: activityType }] : [],
    metadata: {
      ...priorMetadata,
      xge: {
        npcNames: String(data.npcNames ?? "").trim(),
        socialClass: data.socialClass ?? null,
        nobilityAccess: data.nobilityAccess === true,
        crimeDc: data.crimeDc == null ? null : Number(data.crimeDc),
        crimeNotes: String(data.crimeNotes ?? "").trim(),
        thirdSkill: data.thirdSkill ?? null,
        stakeGp: activityType === "gambling" ? costGp : null,
        question: String(data.question ?? "").trim(),
        extraGp: Number(data.extraGp ?? 0),
        skill: data.skill ?? null,
        costGp,
        checks,
        outcome: null,
        complication: null,
        currencyNote: null
      }
    }
  }, { idFactory, now });
  return { project, costGp, activity };
}

export function assignOppositionDc(project, dice) {
  const next = structuredClone(project);
  const waiting = next.metadata.xge.checks.find(entry => entry.total == null && entry.dc == null);
  if (!waiting) return next;
  const [first, second] = dice;
  waiting.dc = 5 + Number(first) + Number(second);
  return next;
}

export function applyXgeCheck(project, total, { d100 = null, d6 = null, at = Date.now() } = {}) {
  const next = structuredClone(project);
  const xge = next.metadata?.xge;
  if (!xge) throw new Error("This Project is not an Xanathar downtime activity.");
  if (xge.outcome) return { project: next, done: true };
  const index = xge.checks.findIndex(entry => entry.total == null);
  if (index < 0) throw new Error("This activity has no check waiting.");
  if (["crime", "gambling", "pit-fighting"].includes(next.activityType) && xge.checks[index].dc == null) {
    throw new Error("This check does not have a DC yet.");
  }
  const score = Number(total);
  if (!Number.isFinite(score)) throw new Error("The check total is missing.");
  xge.checks[index].total = score;
  if (xge.checks.some(entry => entry.total == null)) return { project: next, done: false };
  const outcome = resolveXgeOutcome(next);
  xge.outcome = outcome;
  if (complicationOccurs(next.activityType, { successes: outcome.successes ?? 0, d100 })) {
    xge.complication = { face: Number(d6), summary: complicationLine(next.activityType, d6) };
  }
  appendHistory(next, "xge-resolved", { summary: outcome.summary, complication: xge.complication?.summary ?? null }, at);
  return { project: next, done: true, outcome };
}

export function completeRelaxation(project, { at = Date.now() } = {}) {
  const next = structuredClone(project);
  const benefits = relaxationBenefits();
  next.metadata.xge.outcome = { ...benefits, payoutGp: 0, debtGp: 0, fineGp: 0 };
  next.metadata.xge.complication = null;
  appendHistory(next, "xge-resolved", { summary: benefits.summary, complication: null }, at);
  return next;
}

export function maybeComplication(project, { d100 = null, d6 = null, at = Date.now() } = {}) {
  if (project.activityType !== "relaxation" || project.metadata?.xge?.complication || project.metadata?.xge?.complicationRolled) return project;
  const next = structuredClone(project);
  next.metadata.xge.complicationRolled = true;
  if (complicationOccurs("relaxation", { d100 })) {
    next.metadata.xge.complication = { face: Number(d6), summary: complicationLine("relaxation", d6) };
    appendHistory(next, "xge-resolved", { summary: next.metadata.xge.outcome?.summary, complication: next.metadata.xge.complication.summary }, at);
  }
  return next;
}
