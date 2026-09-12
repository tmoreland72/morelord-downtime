import { projectManagementActions, projectManagementContext } from "./project-management.mjs";
import { LiveDowntimeApplication } from "./downtime-application.mjs";
import { titleCase } from "../ui/formatting.mjs";
import { getCoreApi } from "../integrations/core-api.mjs";

const formatHistory = history => history.slice().reverse().map(entry => ({
  ...entry,
  label: titleCase(entry.type),
  when: new Date(entry.at).toLocaleString(),
  details: Object.keys(entry.data ?? {}).length ? JSON.stringify(entry.data) : null
}));

class DetailApplication extends LiveDowntimeApplication {}

export class SessionDetailApp extends DetailApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-session-detail",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "section",
    position: { width: 720, height: 680 },
    window: { title: "Downtime Session Details", icon: "fa-solid fa-calendar-days", resizable: true }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/session-detail.hbs" } };

  constructor(options = {}) {
    super(options);
    this.sessionId = options.sessionId;
  }

  async _prepareContext(options) {
    const session = await this.constructor.services.sessions.get(this.sessionId);
    if (!session) throw new Error("Session not found.");
    const locations = this.constructor.services.locations()?.list?.() ?? [];
    return {
      ...await super._prepareContext(options),
      session: {
        ...session,
        locationName: locations.find(location => location.id === session.locationId)?.name ?? "No Location",
        participantSummary: session.participants.map(entry => entry.name ?? entry.actorUuid).join(", "),
        activitySummary: session.availableActivities.map(id => this.constructor.services.activities.get(id)?.name ?? titleCase(id)).join(", ") || "No new Projects",
        history: formatHistory(session.history)
      }
    };
  }
}

export class ProjectDetailApp extends DetailApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-project-detail",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "section",
    position: { width: 720, height: 680 },
    window: { title: "Project Details", icon: "fa-solid fa-folder-open", resizable: true },
    actions: {
      ...projectManagementActions,
      allocate: ProjectDetailApp.allocate,
      planProject: ProjectDetailApp.planProject,
      negotiateSourceItem: ProjectDetailApp.negotiateSourceItem,
      openSourceItem: ProjectDetailApp.openSourceItem,
      collectCommission: ProjectDetailApp.collectCommission
    }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/project-detail.hbs" } };

  constructor(options = {}) {
    super(options);
    this.projectId = options.projectId;
  }

  async _prepareContext(options) {
    const project = await this.constructor.services.projects.get(this.projectId);
    if (!project) throw new Error("Project not found.");
    const effort = project.progress.effort;
    const elapsed = project.progress.elapsed;
    const training = project.metadata?.training;
    const commission = project.metadata?.commission;
    const sourceItem = project.metadata?.sourceItem;
    const locations = this.constructor.services.locations()?.list?.() ?? [];
    const ownedActorUuids = new Set(Array.from(game.actors ?? []).filter(actor => actor.type === "character" && actor.isOwner).map(actor => actor.uuid));
    const activeSessions = await this.constructor.services.sessions.list({ status: "active" });
    const openPools = (await this.constructor.services.segments.list({ status: "open" }))
      .filter(pool => game.user.isGM || pool.participants.some(participant => ownedActorUuids.has(participant.actorUuid)))
      .filter(pool => {
        if (!pool.metadata?.sessionId) return true;
        const session = activeSessions.find(entry => entry.id === pool.metadata.sessionId);
        return session?.availableActivities.includes(project.activityType) === true;
      });
    const allocationPool = openPools.at(-1) ?? null;
    const requiredActors = new Set([project.owner.uuid, ...project.participants.map(participant => participant.actorUuid)]);
    const upcomingSession = (await this.constructor.services.sessions.list({ status: "upcoming", participantActorUuid: project.owner.uuid }))
      .find(session => session.availableActivities.includes(project.activityType));
    const canManage = game.user.isGM || ownedActorUuids.has(project.owner.uuid);
    const effortRemaining = Math.max(0, effort.requiredHours - effort.completedHours);
    return {
      ...await super._prepareContext(options),
      ...await projectManagementContext(project, this.constructor.services),
      project: {
        ...project,
        activityLabel: this.constructor.services.activities.get(project.activityType)?.name ?? titleCase(project.activityType),
        ownerName: project.owner.name ?? project.owner.uuid,
        locationName: locations.find(location => location.id === project.locationId)?.name ?? "Any Location",
        instructorName: training ? (training.instructor?.mode === "npc"
          ? training.instructor.name
          : game.actors.get(training.instructor?.actorUuid?.split(".").at(-1))?.name ?? "Not assigned") : null,
        participantSummary: project.participants.map(entry =>
          entry.name
          ?? game.actors.get(String(entry.actorUuid ?? "").split(".").at(-1))?.name
          ?? "Unknown Actor"
        ).join(", ") || "None",
        effortLabel: `${effort.completedHours} / ${effort.requiredHours} hours`,
        elapsedLabel: `${elapsed.completedDays} / ${elapsed.requiredDays} days`,
        usesEffort: ["effort", "hybrid"].includes(project.progress.mode),
        usesElapsed: ["elapsed", "hybrid"].includes(project.progress.mode),
        canPlan: Boolean(upcomingSession && ["effort", "hybrid"].includes(project.progress.mode) && !upcomingSession.plannedProjectIds.includes(project.id) && canManage),
        plannedSessionId: upcomingSession?.id ?? null,
        canAllocate: Boolean(allocationPool && ["effort", "hybrid"].includes(project.progress.mode) && effortRemaining > 0 && canManage),
        allocationPoolId: allocationPool?.id ?? null,
        allocationParticipants: (allocationPool?.participants ?? []).map(participant => ({
          ...participant,
          remainingHours: Math.max(0, participant.availableHours - participant.allocatedHours),
          checked: requiredActors.has(participant.actorUuid)
        })),
        commission: commission ? {
          contractorName: commission.contractorName,
          itemDescription: commission.itemDescription,
          notes: commission.notes,
          canCollect: project.status === "awaiting-collection" && canManage
        } : null,
        sourceItem: sourceItem ? {
          ...sourceItem,
          checkLabel: sourceItem.checkSkill === "inv" ? "Investigation" : "Arcana",
          targetPriceLabel: sourceItem.outcome?.targetPriceGp == null ? null : `${sourceItem.outcome.targetPriceGp.toLocaleString()} gp`,
          alternatives: (sourceItem.outcome?.alternatives ?? []).map(item => ({ ...item, priceLabel: `${Number(item.priceGp).toLocaleString()} gp` })),
          persuasionLabel: sourceItem.persuasion ? `${sourceItem.persuasion.total} (${sourceItem.persuasion.adjustment > 0 ? "+" : ""}${Math.round(sourceItem.persuasion.adjustment * 100)}%)` : null,
          canNegotiate: Boolean(sourceItem.outcome && !sourceItem.persuasion && canManage)
        } : null,
        history: formatHistory(project.history)
      }
    };
  }

  static async allocate(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      const participantActorUuids = Array.from(this.element.querySelectorAll("[data-allocation-actor]:checked"), input => input.value);
      await this.constructor.services.allocationAuthority.allocate({
        segmentId: target.dataset.allocationPoolId,
        projectId: this.projectId,
        participantActorUuids,
        hours: Number(this.element.querySelector("[data-allocation-hours]")?.value ?? 0)
      });
      ui.notifications.info("Downtime hours allocated.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(`Could not allocate hours: ${error.message}`); }
    finally { target.disabled = false; }
  }

  static async planProject(event, target) {
    event.preventDefault();
    await this.constructor.services.allocationAuthority.planProject(target.dataset.sessionId, this.projectId);
    ui.notifications.info("Project planned for the upcoming Downtime Session.");
    await this.render({ force: true });
  }

  static async negotiateSourceItem(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      const project = await this.constructor.services.projects.get(this.projectId);
      const result = await getCoreApi().rolls.skill(await fromUuid(project.owner.uuid), "per", { flavor: `${project.name} — Persuasion` });
      if (result.cancelled) throw new Error("The Persuasion check was cancelled.");
      const roll = { naturalRoll: result.naturalD20, total: result.total, rollModifier: result.total - result.naturalD20 };
      await this.constructor.services.allocationAuthority.negotiateSourceItem(this.projectId, roll);
      ui.notifications.info("Persuasion resolved and offer prices updated.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`Could not negotiate the offer: ${error.message}`);
    } finally { target.disabled = false; }
  }

  static async openSourceItem(event, target) {
    event.preventDefault();
    const item = await fromUuid(target.dataset.uuid);
    if (!item) return ui.notifications.warn("That item is no longer available.");
    item.sheet?.render(true);
  }

  static async collectCommission(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      await this.constructor.services.allocationAuthority.collectProject(this.projectId);
      ui.notifications.info("Commission collected and completed.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(`Could not collect Commission: ${error.message}`); }
    finally { target.disabled = false; }
  }
}
