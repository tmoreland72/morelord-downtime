import test from "node:test";
import assert from "node:assert/strict";
import { projectManagementActions, projectManagementContext } from "../scripts/apps/project-management.mjs";

test("project controls respect ownership, progress, and cancellation; actions require confirmation", async () => {
  const saved = Object.fromEntries(["game", "fromUuid", "foundry", "ui"].map(key => [key, globalThis[key]]));
  try {
    globalThis.game = { user: { isGM: false } };
    let isOwner = false;
    globalThis.fromUuid = async () => ({ isOwner });
    const project = { id: "project", owner: { uuid: "Actor.owner" }, status: "active", progress: { effort: { completedHours: 0 }, elapsed: { completedDays: 0 } }, participants: [], history: [{ type: "created" }] };
    const services = { segments: { list: async () => [] } };
    assert.deepEqual(await projectManagementContext(project, services), {});
    isOwner = true;
    assert.deepEqual(await projectManagementContext(project, services), { canCancelProject: true, canDeleteProject: true });
    project.progress.elapsed.completedDays = 1;
    assert.deepEqual(await projectManagementContext(project, services), { canCancelProject: true, canDeleteProject: false });
    project.status = "cancelled";
    assert.deepEqual(await projectManagementContext(project, services), { canCancelProject: false, canDeleteProject: true });
    let confirmed = false;
    const calls = [];
    globalThis.foundry = { applications: { api: { DialogV2: { confirm: async () => confirmed } } } };
    globalThis.ui = { notifications: { info() {}, error(message) { throw new Error(message); } } };
    services.allocationAuthority = { deleteProject: async id => calls.push(id) };
    const app = { projectId: project.id, constructor: { services }, close: async () => calls.push("closed") };
    const target = { disabled: false };
    const event = { preventDefault() {} };
    await projectManagementActions.deleteProject.call(app, event, target);
    assert.deepEqual(calls, []);
    confirmed = true;
    await projectManagementActions.deleteProject.call(app, event, target);
    assert.deepEqual(calls, [project.id, "closed"]);
    assert.equal(target.disabled, false);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
