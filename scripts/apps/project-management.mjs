export async function projectManagementContext(project, services) {
  if (!project) return {};
  const owner = await fromUuid(project.owner.uuid);
  if (!game.user.isGM && !owner?.isOwner) return {};
  const segments = await services.segments.list();
  const unused = project.progress.effort.completedHours === 0
    && project.progress.elapsed.completedDays === 0
    && !project.participants.some(participant => participant.hoursContributed > 0)
    && !segments.some(segment => segment.allocations.some(allocation => allocation.projectId === project.id))
    && project.history.every(entry => ["created", "updated", "cancelled"].includes(entry.type));
  return {
    canCancelProject: !["completed", "awaiting-collection", "cancelled", "failed"].includes(project.status),
    canDeleteProject: project.status === "cancelled" || unused
  };
}

async function manageProject(event, target, action) {
  event.preventDefault();
  target.disabled = true;
  const projectId = this.projectId ?? target.closest("[data-project-id]")?.dataset.projectId;
  const deleting = action === "deleteProject";
  const label = deleting ? "Delete" : "Cancel";
  try {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `${label} Project` },
      content: `<p>${deleting ? "Permanently delete this Project and its history? Projects with recorded progress must be cancelled first. Session allocation records remain." : "Cancel this Project and stop its progress? Its history will remain available under Show Completed."} Spent time and gold are not refunded.</p>`,
      modal: true
    });
    if (!confirmed) return;
    await this.constructor.services.allocationAuthority[action](projectId);
    ui.notifications.info(`Project ${deleting ? "deleted" : "cancelled"}.`);
    if (this.projectId) await this.close();
    else await this.render({ force: true });
    await this.constructor.services.onCreated?.();
  } catch (error) {
    ui.notifications.error(`Could not ${label.toLowerCase()} Project: ${error.message}`);
  } finally { target.disabled = false; }
}

export const projectManagementActions = {
  cancelProject(event, target) { return manageProject.call(this, event, target, "cancelProject"); },
  deleteProject(event, target) { return manageProject.call(this, event, target, "deleteProject"); }
};
