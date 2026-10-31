import { clearExhaustion, collectDebt, grantGp, spendGp } from "./xge-actor.mjs";
import { applyXgeCheck, assignOppositionDc, buildXgeProject, completeRelaxation, maybeComplication } from "./xge-project.mjs";
import { xgeActivity } from "./xge-rules.mjs";
import { xgeRollCard } from "./xge-roll-request.mjs";

export class XgeResolutionService {
  constructor({ projects, getActor, getLocation, getRequests = () => null, rollDie = null, now = () => Date.now() }) {
    this.projects = projects;
    this.getActor = getActor;
    this.getLocation = getLocation;
    this.getRequests = getRequests;
    this.rollDie = rollDie ?? (async faces => Number((await new Roll(`1d${faces}`).evaluate()).total));
    this.now = now;
  }

  async createProject(data, { isGm = false } = {}) {
    const location = data.locationId ? await this.getLocation(data.locationId) : null;
    const built = buildXgeProject(data, { isGm, location, now: this.now });
    const actor = await this.getActor(built.project.owner.uuid);
    if (built.costGp > 0) {
      if (!actor?.update) throw new Error("The character could not be found to pay the cost.");
      const paid = await spendGp(actor, built.costGp, built.activity.name);
      built.project.metadata.xge.currencyNote = paid.note;
      await this.#chat(paid.note);
    }
    try {
      return await this.projects.create(built.project);
    } catch (error) {
      if (built.costGp > 0 && actor?.update) await grantGp(actor, built.costGp, `${built.activity.name} refund`);
      throw error;
    }
  }

  async onComplete(project) {
    if (project.activityType === "relaxation") return this.#finishRelaxation(project);
    return this.#requestPending(project);
  }

  async applyStoredRoll(projectId, total, options) {
    const project = await this.projects.get(projectId);
    if (!project) throw new Error("Project not found.");
    return this.applyRoll(project, total, options);
  }

  async applyRoll(project, total, { messageId = null } = {}) {
    let current = structuredClone(project);
    const waiting = current.metadata.xge.checks.find(entry => entry.total == null);
    if (waiting && waiting.dc == null) {
      current = assignOppositionDc(current, [await this.rollDie(10), await this.rollDie(10)]);
      current = await this.projects.commit(current);
    }
    const d100 = complicationRollNeeded(current, total) ? await this.rollDie(100) : null;
    const d6 = d100 != null && d100 <= 10 || crimeComplication(current, total) ? await this.rollDie(6) : null;
    const applied = applyXgeCheck(current, total, { d100, d6, at: this.now() });
    if (!applied.done) {
      const saved = await this.projects.commit(applied.project);
      await this.#requestPending(saved);
      await this.#completeRequest(messageId);
      return saved;
    }
    const noted = await this.#payOutcome(applied.project);
    const saved = await this.projects.commit(noted);
    await this.#postResult(saved);
    await this.#completeRequest(messageId);
    return saved;
  }

  async #finishRelaxation(project) {
    const actor = await this.getActor(project.owner.uuid);
    if (actor?.update) await clearExhaustion(actor);
    let next = completeRelaxation(project, { at: this.now() });
    const d100 = await this.rollDie(100);
    const d6 = d100 <= 10 ? await this.rollDie(6) : null;
    next = maybeComplication(next, { d100, d6, at: this.now() });
    await this.#postResult(next);
    return next;
  }

  async #payOutcome(project) {
    const outcome = project.metadata.xge.outcome;
    const actor = await this.getActor(project.owner.uuid);
    const reason = xgeActivity(project.activityType)?.name ?? "downtime";
    const notes = [];
    if (actor?.update && outcome.payoutGp > 0) notes.push((await grantGp(actor, outcome.payoutGp, reason)).note);
    if (actor?.update && outcome.fineGp > 0) notes.push((await collectDebt(actor, outcome.fineGp, `${reason} fine`)).note);
    if (actor?.update && outcome.debtGp > 0) notes.push((await collectDebt(actor, outcome.debtGp, `${reason} debt`)).note);
    project.metadata.xge.currencyNote = [project.metadata.xge.currencyNote, ...notes].filter(Boolean).join(" ");
    return project;
  }

  async #requestPending(project) {
    if (project.metadata?.xge?.outcome) return project;
    const waiting = project.metadata?.xge?.checks?.find(entry => entry.total == null);
    if (!waiting) return project;
    let current = project;
    if (waiting.dc == null && ["gambling", "pit-fighting"].includes(project.activityType)) {
      current = assignOppositionDc(structuredClone(project), [await this.rollDie(10), await this.rollDie(10)]);
    }
    const requests = this.getRequests();
    if (typeof requests?.create === "function") await requests.create(xgeRollCard(current));
    return current;
  }

  async #postResult(project) {
    const xge = project.metadata.xge;
    const lines = [xge.outcome?.summary, xge.complication?.summary, xge.currencyNote].filter(Boolean);
    await this.#chat(lines.join(" "));
  }

  async #chat(text) {
    if (!text || !globalThis.ChatMessage?.create) return;
    const content = `<section class="ml-chat-card"><p>${escapeHtml(text)}</p></section>`;
    await ChatMessage.create({ content });
  }

  async #completeRequest(messageId) {
    if (!messageId || !globalThis.game?.messages?.get) return;
    const message = game.messages.get(messageId);
    if (!message) return;
    const { completeChatRoll } = await import("../../../../morelord-core/scripts/services/chat-roll-requests.js");
    await completeChatRoll(message, "");
  }
}

function complicationRollNeeded(project, total) {
  const xge = project.metadata.xge;
  const finished = xge.checks.filter(entry => entry.total == null).length <= 1;
  if (!finished) return false;
  return ["carousing", "gambling", "pit-fighting", "religious-service", "lore-research"].includes(project.activityType) && Number.isFinite(Number(total));
}

function crimeComplication(project, total) {
  if (project.activityType !== "crime") return false;
  const totals = project.metadata.xge.checks.map((entry, index, all) => {
    if (entry.total == null && all.filter(item => item.total == null).length === 1) return Number(total);
    return Number(entry.total);
  });
  const dc = project.metadata.xge.crimeDc;
  return totals.filter(score => score >= dc).length === 1 && totals.every(score => Number.isFinite(score));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
}
