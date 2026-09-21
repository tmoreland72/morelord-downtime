import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { listCharacterActors } from "../../../morelord-core/scripts/ui/actor-participation.js";
import { ProjectDetailApp, SessionDetailApp } from "../apps/detail-apps.mjs";

/** Persist disposable legacy-shaped records and render both real history windows. */
export async function runHistoryTests({ onRendered = async () => {} } = {}) {
  return runInGameTests({ checks: [{ id: "downtime.readable-history", async run() {
    assert(game.user.isGM, "Run history verification as a GM.");
    const actor = listCharacterActors()[0];
    assert(actor, "A participant character is required.");
    const api = MorelordDowntime;
    let project, session, app;
    const event = (type, data) => ({ at: Date.now(), type, data });
    try {
      project = await api.projects.create({ name: "History regression fixture", activityType: "training",
        owner: { uuid: actor.uuid, name: actor.name },
        progress: { mode: "effort", effort: { requiredHours: 10 } },
        history: [event("effort-applied", { hours: 2, participantActorUuid: actor.uuid }),
          event("cancelled", { reason: "<b>Literal history text</b>" }),
          event("future-event", { result: { success: false, total: 0 } })] });
      session = await api.sessions.create({ name: "History session fixture", plannedDurationHours: 8,
        participants: [{ actorUuid: actor.uuid, name: actor.name }],
        history: [event("project-planned", { projectId: project.id }),
          event("segment-added", { segmentId: "missing-history-fixture" })] });
      for (const [kind, App, options, expected] of [
        ["project", ProjectDetailApp, { projectId: project.id }, [`${actor.name} contributed 2 hours.`, "Success: No; Total: 0", "<b>Literal history text</b>"]],
        ["session", SessionDetailApp, { sessionId: session.id }, ["Planned project: History regression fixture.", "Unavailable time pool"]]
      ]) {
        app = new App(options);
        await app.render({ force: true });
        const history = app.element.querySelector("ol");
        assert(history, "History is rendered.");
        for (const text of expected) assert(history.textContent.includes(text), `${kind} displays readable history.`);
        assert(!history.querySelector("code, pre, b"), "History uses escaped prose, not code or unescaped markup.");
        assert(!/\[object Object\]|participantActorUuid|projectId|missing-history-fixture/.test(history.textContent), "History hides internal record identifiers.");
        for (const width of [720, 360]) {
          app.setPosition({ width });
          await new Promise(resolve => requestAnimationFrame(resolve));
          assert(history.scrollWidth <= history.clientWidth + 1, "History fits the window width.");
          assert(getComputedStyle(history.querySelector("li")).borderTopStyle !== "none", "Core card styling is loaded.");
          const originalClass = app.element.className;
          try {
            for (const theme of ["dark", "light"]) {
              app.element.classList.remove("theme-dark", "theme-light");
              app.element.classList.add(`theme-${theme}`);
              await new Promise(resolve => requestAnimationFrame(resolve));
              assert(history.scrollWidth <= history.clientWidth + 1, "History fits both themes.");
              await onRendered(app, `${kind}-${width}-${theme}`);
            }
          } finally { app.element.className = originalClass; }
        }
        await app.close(); app = null;
      }
      assert(JSON.stringify((await api.projects.get(project.id)).history) === JSON.stringify(project.history), "Rendering preserves stored history.");
    } finally {
      if (app) await app.close();
      if (session) await api.sessions.removeUnused(session.id);
      if (project) await api.projects.remove(project.id);
    }
  } }] });
}
