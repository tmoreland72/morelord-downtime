import { NewProjectApp, SessionEditorApp } from "./creation-apps.mjs";
import { LocationDetailApp, ProjectDetailApp, SessionDetailApp } from "./detail-apps.mjs";
import { registerLiveWindow, unregisterLiveWindow } from "./live-window-registry.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const titleCase = value => String(value ?? "")
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/(^|\s)\S/g, letter => letter.toUpperCase());

async function runSessionAction(app, target, operation, successMessage) {
  target.disabled = true;
  try {
    const id = target.closest("[data-session-id]")?.dataset.sessionId;
    const result = await operation(id);
    ui.notifications.info(successMessage);
    await app.render({ force: true });
  } catch (error) {
    ui.notifications.error(`Could not update Session: ${error.message}`);
  } finally { target.disabled = false; }
}

export class DowntimeDashboardApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static services = null;

  static configure(services) {
    this.services = services;
  }

  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-dashboard",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "form",
    position: { width: 960, height: 720 },
    window: { title: "Morelord Downtime", icon: "fa-solid fa-timer", resizable: true },
    form: { closeOnSubmit: false },
    actions: {
      newLocation: DowntimeDashboardApp.newLocation,
      viewLocation: DowntimeDashboardApp.viewLocation,
      editLocation: DowntimeDashboardApp.editLocation,
      deleteLocation: DowntimeDashboardApp.deleteLocation,
      openDocumentation: DowntimeDashboardApp.openDocumentation,
      newProject: DowntimeDashboardApp.newProject,
      openSession: DowntimeDashboardApp.openSession,
      viewSession: DowntimeDashboardApp.viewSession,
      viewProject: DowntimeDashboardApp.viewProject,
      openCrafting: DowntimeDashboardApp.openCrafting,
      editProject: DowntimeDashboardApp.editProject,
      deleteProject: DowntimeDashboardApp.deleteProject,
      editSession: DowntimeDashboardApp.editSession,
      publishSession: DowntimeDashboardApp.publishSession,
      startSession: DowntimeDashboardApp.startSession,
      finalizeSession: DowntimeDashboardApp.finalizeSession,
      cancelSession: DowntimeDashboardApp.cancelSession,
      deleteSession: DowntimeDashboardApp.deleteSession,
      advanceDay: DowntimeDashboardApp.advanceDay,
      allocate: DowntimeDashboardApp.allocate,
      planProject: DowntimeDashboardApp.planProject
    }
  };

  static PARTS = {
    content: { template: "modules/morelord-downtime/templates/downtime-dashboard.hbs" }
  };

  render(options = {}) {
    registerLiveWindow(this);
    const preserve = game.modules.get("morelord-core")?.api?.ui?.renderPreservingScroll;
    return preserve ? preserve(this, () => super.render(options)) : super.render(options);
  }

  close(options = {}) {
    unregisterLiveWindow(this);
    return super.close(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { projects, segments, sessions, locations, activities, craftworksProjects } = this.constructor.services;
    const [allProjects, allSegments, allSessions] = await Promise.all([projects.list(), segments.list(), sessions.list()]);
    const isGm = game.user.isGM;
    const ownedActorUuids = new Set(Array.from(game.actors ?? []).filter(actor => actor.type === "character" && actor.isOwner).map(actor => actor.uuid));
    const isParticipant = entries => entries.some(entry => ownedActorUuids.has(entry.actorUuid));
    const openSegments = allSegments.filter(segment => segment.status === "open" && (isGm || isParticipant(segment.participants)));
    const locationRecords = locations()?.list?.() ?? [];
    const projectIsUnused = project => project.progress.effort.completedHours === 0
      && project.progress.elapsed.completedDays === 0
      && !allSegments.some(segment => segment.allocations.some(allocation => allocation.projectId === project.id))
      && project.history.every(entry => ["created", "updated", "cancelled"].includes(entry.type));
    const visibleProjects = allProjects.filter(project => isGm
      || ownedActorUuids.has(project.owner.uuid)
      || isParticipant(project.participants));
    const visibleSessions = allSessions.filter(session => isGm
      || (["upcoming", "active", "finalized", "cancelled"].includes(session.status) && isParticipant(session.participants)));
    const activeOpportunity = visibleSessions.find(session => session.status === "active") ?? null;
    const activeLocation = activeOpportunity?.locationId
      ? locations()?.get?.(activeOpportunity.locationId) ?? null
      : activeOpportunity
        ? { id: "road", name: "On the Road", settlementType: "road", capabilities: [] }
        : locations()?.current?.() ?? null;
    const craftingActors = Array.from(game.actors ?? []).filter(actor => actor.type === "character" && (isGm || actor.isOwner));
    const externalProjects = await craftworksProjects.list({
      actors: craftingActors,
      locationName: activeLocation?.name ?? "Current Location",
      location: activeLocation
    });
    const opportunitySegments = activeOpportunity
      ? openSegments.filter(segment => segment.metadata?.sessionId === activeOpportunity.id)
      : [];
    const activityTypes = activities.list()
      .map(activity => ({ id: activity.id, name: activity.name, icon: activity.icon, description: activity.description }));
    const opportunity = opportunitySegments.reduce((summary, segment) => {
      for (const participant of segment.participants.filter(entry => ownedActorUuids.has(entry.actorUuid))) {
        summary.available += participant.availableHours;
        summary.allocated += participant.allocatedHours;
      }
      return summary;
    }, { name: activeOpportunity?.name ?? "", available: 0, allocated: 0 });
    const activeOpportunitySession = allSessions.find(session => session.status === "active"
      && openSegments.some(segment => segment.metadata?.sessionId === session.id));
    opportunity.name = activeOpportunitySession?.name ?? openSegments[0]?.name ?? "Current Opportunity";
    const totalAvailableHours = openSegments.reduce((total, segment) => total
      + segment.participants.reduce((subtotal, participant) => subtotal + participant.availableHours, 0), 0);
    const unallocatedHours = openSegments.reduce((total, segment) => total + segment.participants
      .reduce((subtotal, participant) => subtotal + Math.max(0, participant.availableHours - participant.allocatedHours), 0), 0);
    const waitingForGmCount = allProjects.filter(project => project.status === "waiting").length;
    const awaitingCollectionCount = allProjects.filter(project => project.status === "awaiting-collection").length;
    const upcomingCompletions = allProjects.filter(project => ["active", "paused", "waiting"].includes(project.status)).map(project => {
      const effortRemaining = Math.max(0, project.progress.effort.requiredHours - project.progress.effort.completedHours);
      const daysRemaining = Math.max(0, project.progress.elapsed.requiredDays - project.progress.elapsed.completedDays);
      return { id: project.id, name: project.name, effortRemaining, daysRemaining, hasEffort: effortRemaining > 0, hasDays: daysRemaining > 0 };
    }).filter(entry => entry.hasEffort || entry.hasDays).sort((left, right) => (left.daysRemaining || Infinity) - (right.daysRemaining || Infinity)).slice(0, 5);
    return {
      ...context,
      isGm,
      isPlayer: !isGm,
      hasActiveOpportunity: Boolean(activeOpportunity),
      opportunity,
      gmOperations: { unallocatedHours, totalAvailableHours, waitingForGmCount, awaitingCollectionCount },
      upcomingCompletions,
      hasUpcomingCompletions: upcomingCompletions.length > 0,
      canManageLocations: game.user.isGM && Boolean(locations()?.open),
      canOpenDocumentation: Boolean(game.modules.get("morelord-core")?.api?.ui?.documentation?.open),
      activityTypes,
      canStartActivities: activityTypes.length > 0,
      activeProjectCount: visibleProjects.filter(project => ["active", "paused", "waiting"].includes(project.status)).length + externalProjects.length,
      sessions: visibleSessions.map(session => ({
        ...session,
        locationName: locationRecords.find(location => location.id === session.locationId)?.name ?? "No Location",
        participantSummary: session.participants.map(entry => entry.name ?? entry.actorUuid).join(", "),
        activitySummary: session.availableActivities.map(id => activities.get(id)?.name ?? titleCase(id)).join(", ") || "No new activities",
        canPublish: session.status === "draft",
        canStart: session.status === "upcoming",
        canFinalize: session.status === "active",
        canEdit: ["draft", "upcoming", "active"].includes(session.status),
        isClosed: ["finalized", "cancelled"].includes(session.status),
        canDelete: isGm && ["draft", "cancelled"].includes(session.status)
          && !session.segmentIds.map(id => allSegments.find(segment => segment.id === id)).filter(Boolean)
            .some(segment => segment.allocations.length || segment.participants.some(participant => participant.allocatedHours > 0))
      })),
      hasSessions: visibleSessions.length > 0,
      locations: locationRecords,
      hasLocations: locationRecords.length > 0,
      projects: [...visibleProjects.map(project => {
        const effort = project.progress.effort;
        const elapsed = project.progress.elapsed;
        const usesElapsed = ["elapsed", "hybrid"].includes(project.progress.mode);
        return {
          ...project,
          activityLabel: titleCase(project.activityType),
          ownerName: project.owner.name ?? project.owner.uuid,
          locationName: locationRecords.find(location => location.id === project.locationId)?.name ?? "Any Location",
          progressLabel: usesElapsed ? `${elapsed.completedDays} / ${elapsed.requiredDays} days` : `${effort.completedHours} / ${effort.requiredHours} hours`,
          progressPercent: usesElapsed
            ? (elapsed.requiredDays ? Math.min(100, Math.round(elapsed.completedDays / elapsed.requiredDays * 100)) : 0)
            : (effort.requiredHours ? Math.min(100, Math.round(effort.completedHours / effort.requiredHours * 100)) : 0),
          canEditProject: typeof activities.get(project.activityType)?.edit === "function"
            && (["planned", "active", "paused", "waiting"].includes(project.status)
              || (project.activityType === "commission" && project.status === "awaiting-collection"))
            && (isGm || ownedActorUuids.has(project.owner.uuid)),
          canDeleteProject: projectIsUnused(project) && (isGm || ownedActorUuids.has(project.owner.uuid)),
          isClosed: ["completed", "cancelled", "failed"].includes(project.status)
            || (project.status === "awaiting-collection" && project.activityType !== "commission")
        };
      }), ...externalProjects],
      hasProjects: visibleProjects.length + externalProjects.length > 0
    };
  }

  static newLocation(event) {
    event.preventDefault();
    this.constructor.services.locations()?.open?.({ createNew: true });
  }

  static viewLocation(event, target) {
    event.preventDefault();
    new LocationDetailApp({ locationId: target.closest("[data-location-id]")?.dataset.locationId }).render({ force: true });
  }

  static editLocation(event, target) {
    event.preventDefault();
    this.constructor.services.locations()?.open?.({ locationId: target.closest("[data-location-id]")?.dataset.locationId });
  }

  static async deleteLocation(event, target) {
    event.preventDefault();
    const row = target.closest("[data-location-id]");
    const name = row?.dataset.locationName ?? "this Location";
    const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: "Delete Location" }, content: `<p>Delete <strong>${foundry.utils.escapeHTML(name)}</strong>? Existing Projects and Sessions may lose their Location reference.</p>`, modal: true });
    if (!confirmed) return;
    await this.constructor.services.locations().remove(row.dataset.locationId);
    ui.notifications.info("Location deleted.");
    await this.render({ force: true });
  }

  static openDocumentation(event) {
    event.preventDefault();
    game.modules.get("morelord-core")?.api?.ui?.documentation?.open("morelord-downtime");
  }

  static newProject(event) {
    event.preventDefault();
    new NewProjectApp().render({ force: true });
  }

  static openSession(event) {
    event.preventDefault();
    new SessionEditorApp().render({ force: true });
  }

  static editSession(event, target) {
    event.preventDefault();
    const sessionId = target.closest("[data-session-id]")?.dataset.sessionId;
    new SessionEditorApp({ sessionId }).render({ force: true });
  }

  static viewSession(event, target) {
    event.preventDefault();
    const sessionId = target.closest("[data-session-id]")?.dataset.sessionId;
    new SessionDetailApp({ sessionId }).render({ force: true });
  }

  static viewProject(event, target) {
    event.preventDefault();
    const projectId = target.closest("[data-project-id]")?.dataset.projectId;
    new ProjectDetailApp({ projectId }).render({ force: true });
  }

  static async openCrafting(event, target) {
    event.preventDefault();
    const row = target.closest("[data-project-id]");
    try {
      await this.constructor.services.craftworksProjects.open({
        ownerUuid: row?.dataset.ownerUuid,
        recipeId: row?.dataset.recipeId,
        inventoryActorUuid: row?.dataset.inventoryActorUuid || null
      });
    } catch (error) {
      ui.notifications.error(`Could not open Crafting: ${error.message}`);
    }
  }

  static async editProject(event, target) {
    event.preventDefault();
    const project = await this.constructor.services.projects.get(target.closest("[data-project-id]")?.dataset.projectId);
    const editor = this.constructor.services.activities.get(project?.activityType)?.edit;
    if (!editor) return ui.notifications.warn("This Project type does not provide an editor.");
    return editor(project);
  }

  static async deleteProject(event, target) {
    event.preventDefault();
    const row = target.closest("[data-project-id]");
    const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: "Delete Project" }, content: "<p>Delete this Project permanently? Projects with recorded progress cannot be deleted.</p>", modal: true });
    if (!confirmed) return;
    try {
      await this.constructor.services.allocationAuthority.deleteProject(row.dataset.projectId);
      ui.notifications.info("Project deleted.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(`Could not delete Project: ${error.message}`); }
  }

  static async advanceDay(event, target) {
    event.preventDefault();
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Advance Downtime Day" },
      content: "<p>Advance the campaign by one day for every active elapsed-time Project?</p><p>This reduces each applicable Project's remaining days by one and cannot be undone.</p>",
      modal: true
    });
    if (!confirmed) return;
    target.disabled = true;
    try {
      const result = await this.constructor.services.projects.advanceDay({
        idempotencyKey: `manual:${Date.now()}:${foundry.utils.randomID()}`,
        source: "manual",
        metadata: { userId: game.user.id }
      });
      Hooks.callAll("morelordDowntime.dayAdvanced", result);
      const count = result.projects.length;
      ui.notifications.info(`Downtime day advanced. ${count} Project${count === 1 ? "" : "s"} updated.`);
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`Could not advance the downtime day: ${error.message}`);
    } finally {
      target.disabled = false;
    }
  }

  static async publishSession(event, target) {
    event.preventDefault();
    await runSessionAction(this, target, id => this.constructor.services.sessions.publish(id), "Session published for player preview.");
  }

  static async startSession(event, target) {
    event.preventDefault();
    await runSessionAction(this, target, id => this.constructor.services.sessions.start(id), "Downtime Session started.");
  }

  static async finalizeSession(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      const id = target.closest("[data-session-id]")?.dataset.sessionId;
      let result = await this.constructor.services.sessions.finalize(id);
      if (!result.finalized) {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Finalize Downtime Session" },
          content: `<p>This Session still has ${result.warnings.length} unresolved condition${result.warnings.length === 1 ? "" : "s"}, such as unallocated hours or GM decisions. Finalize anyway?</p><p>Persistent Projects will remain intact.</p>`,
          modal: true
        });
        if (!confirmed) return;
        result = await this.constructor.services.sessions.finalize(id, { force: true });
      }
      ui.notifications.info("Downtime Session finalized.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`Could not finalize Session: ${error.message}`);
    } finally { target.disabled = false; }
  }

  static async cancelSession(event, target) {
    event.preventDefault();
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Cancel Downtime Session" },
      content: "<p>Cancel this Session? Its lifecycle record will remain available from Session Details.</p><p>Persistent Projects will not be cancelled.</p>",
      modal: true
    });
    if (!confirmed) return;
    await runSessionAction(this, target, id => this.constructor.services.sessions.cancel(id), "Downtime Session cancelled.");
  }

  static async deleteSession(event, target) {
    event.preventDefault();
    const row = target.closest("[data-session-id]");
    const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: "Delete Downtime Session" }, content: "<p>Delete this Session permanently? Only drafts or cancelled Sessions without allocations can be deleted.</p>", modal: true });
    if (!confirmed) return;
    try {
      await this.constructor.services.sessions.removeUnused(row.dataset.sessionId);
      ui.notifications.info("Downtime Session deleted.");
      await this.render({ force: true });
    } catch (error) { ui.notifications.error(`Could not delete Session: ${error.message}`); }
  }

  static async allocate(event, target) {
    event.preventDefault();
    const row = target.closest("[data-project-id]");
    target.disabled = true;
    try {
      const participantActorUuids = Array.from(row.querySelectorAll("[data-allocation-actor]:checked"), input => input.value);
      await this.constructor.services.allocationAuthority.allocate({
        segmentId: row.dataset.allocationPoolId,
        projectId: row.dataset.projectId,
        participantActorUuids,
        hours: Number(row.querySelector("[data-allocation-hours]")?.value ?? 0)
      });
      ui.notifications.info("Downtime hours allocated.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`Could not allocate hours: ${error.message}`);
    } finally {
      target.disabled = false;
    }
  }

  static async planProject(event, target) {
    event.preventDefault();
    const row = target.closest("[data-project-id]");
    target.disabled = true;
    try {
      await this.constructor.services.allocationAuthority.planProject(target.dataset.sessionId, row.dataset.projectId);
      ui.notifications.info("Project planned for the upcoming Downtime Session.");
      await this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`Could not plan Project: ${error.message}`);
    } finally { target.disabled = false; }
  }

}
