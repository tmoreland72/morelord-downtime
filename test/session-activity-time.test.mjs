import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { CraftTimeService } from "../scripts/services/craft-time-service.mjs";
import { recordElapsedSessionTime } from "../scripts/services/elapsed-session-time.mjs";
import { LABOR_DAY_HOURS } from "../scripts/domain/labor-time.mjs";
import { formatHistory } from "../scripts/ui/history.mjs";

function world() {
  let stored = null;
  let sessionId = 0;
  let segmentId = 0;
  let projectId = 0;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const projects = new ProjectService({ repository, idFactory: () => `project-${++projectId}`, now: () => 100 });
  const sessions = new SessionService({
    repository,
    idFactory: () => `session-${++sessionId}`,
    segmentIdFactory: () => `segment-${++segmentId}`,
    now: () => 100
  });
  const notices = [];
  const sessionTime = new CraftTimeService({ repository, now: () => 500, notify: message => notices.push(message) });
  return { repository, projects, sessions, sessionTime, notices };
}

async function activeSession(sessions, activities) {
  const session = await sessions.create({
    name: "Market Week",
    plannedDurationHours: 40,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: activities
  });
  await sessions.publish(session.id);
  return sessions.start(session.id);
}

async function elapsedProject(projects, activityType, name) {
  return projects.create({
    name,
    activityType,
    owner: { type: "actor", uuid: "Actor.aric", name: "Aric" },
    status: "active",
    progress: { mode: "elapsed", elapsed: { requiredDays: 5, completedDays: 0 } }
  });
}

test("Available Activities includes Commission and Source Item with Crafting", () => {
  const source = readFileSync(new URL("../scripts/main.mjs", import.meta.url), "utf8");
  for (const id of ["COMMISSION_ACTIVITY_ID", "SOURCE_ITEM_ACTIVITY_ID"]) {
    const start = source.indexOf(`id: ${id}`);
    const block = source.slice(start, source.indexOf("activities.register", start + 10));
    assert.match(block, /availableInSessions: true/);
  }
  assert.match(source, /name: "Crafting"/);
  assert.match(source, /name: "Training"/);
});

test("a Commission labor day spends eight Session hours only when Commission is enabled", async () => {
  const { repository, projects, sessions, sessionTime, notices } = world();
  const started = await activeSession(sessions, ["commission", "training"]);
  const project = await elapsedProject(projects, "commission", "Plate Armor");
  const advanced = await projects.advanceDay({ idempotencyKey: "day-1" });
  assert.equal(advanced.projects[0].elapsedDaysApplied, 1);
  assert.equal((await projects.get(project.id)).elapsedDaysApplied, undefined);
  const recorded = await recordElapsedSessionTime(sessionTime, advanced);
  assert.equal(recorded[0].hours, LABOR_DAY_HOURS);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
  assert.match(notices[0], /Aric spent 8 hours commissioning Plate Armor/);
  const duplicate = await projects.advanceDay({ idempotencyKey: "day-1" });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(await recordElapsedSessionTime(sessionTime, duplicate), []);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
});

test("Source Item spends a labor day on the Session only when that activity is allowed", async () => {
  const { repository, projects, sessions, sessionTime } = world();
  const hidden = await activeSession(sessions, ["training"]);
  const project = await elapsedProject(projects, "source-item", "Cloak of Protection");
  const skipped = await projects.advanceDay({ idempotencyKey: "search-1" });
  await recordElapsedSessionTime(sessionTime, skipped);
  assert.equal((await repository.read()).segments[hidden.segment.id].participants[0].allocatedHours, 0);
  assert.equal((await projects.get(project.id)).progress.elapsed.completedDays, 1);

  const { projects: allowedProjects, sessions: allowedSessions, sessionTime: allowedTime, repository: allowedRepository } = world();
  const started = await activeSession(allowedSessions, ["source-item"]);
  await elapsedProject(allowedProjects, "source-item", "Cloak of Protection");
  const advanced = await allowedProjects.advanceDay({ idempotencyKey: "search-1" });
  await recordElapsedSessionTime(allowedTime, advanced);
  assert.equal((await allowedRepository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
});

test("elapsed time outside the Session is not applied when a later Session allows the activity", async () => {
  const { projects, sessions, sessionTime, repository } = world();
  const project = await elapsedProject(projects, "commission", "Longsword");
  const beforeSession = await projects.advanceDay({ idempotencyKey: "before" });
  await recordElapsedSessionTime(sessionTime, beforeSession);
  const started = await activeSession(sessions, ["commission"]);
  const during = await projects.advanceDay({ idempotencyKey: "during" });
  await recordElapsedSessionTime(sessionTime, during);
  assert.equal((await projects.get(project.id)).progress.elapsed.completedDays, 2);
  assert.equal((await repository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
});

test("session history names commissioning and sourcing without internal ids", async () => {
  const rows = await formatHistory([
    { at: 1, type: "session-time", data: { actorName: "Aric", actorUuid: "Actor.aric", hours: 8, activityId: "commission", label: "Plate Armor", projectId: "project-1" } },
    { at: 2, type: "session-time", data: { actorName: "Aric", actorUuid: "Actor.aric", hours: 8, activityId: "source-item", label: "Cloak of Protection" } }
  ], {});
  assert.equal(rows[1].details, "Aric spent 8 hours commissioning Plate Armor.");
  assert.equal(rows[0].details, "Aric spent 8 hours sourcing Cloak of Protection.");
  assert.equal(rows.some(row => row.details.includes("project-1") || row.details.includes("Actor.aric")), false);
});
