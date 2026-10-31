import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProjectRepository } from "../scripts/persistence/project-repository.mjs";
import { SessionService } from "../scripts/services/session-service.mjs";
import { CraftTimeService } from "../scripts/services/craft-time-service.mjs";
import { ProjectService } from "../scripts/services/project-service.mjs";
import { createSourceItemProject } from "../scripts/activities/source-item/source-item-activity.mjs";
import { createCommissionProject } from "../scripts/activities/commission/commission-activity.mjs";
import { formatHistory } from "../scripts/ui/history.mjs";
import { sessionJournal, sessionParticipantTime, sessionSpends } from "../scripts/ui/session-spends.mjs";
import { XGE_ACTIVITY_IDS } from "../scripts/activities/xge/xge-rules.mjs";

function world() {
  let stored = null;
  let sessionId = 0;
  let segmentId = 0;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const sessions = new SessionService({
    repository,
    idFactory: () => `session-${++sessionId}`,
    segmentIdFactory: () => `segment-${++segmentId}`,
    now: () => 100
  });
  const notices = [];
  const sessionTime = new CraftTimeService({ repository, now: () => 500, notify: message => notices.push(message) });
  return { repository, sessions, sessionTime, notices };
}

async function activeSession(sessions, activities) {
  const session = await sessions.create({
    name: "Market Week",
    plannedDurationHours: 40,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: activities
  });
  return sessions.start(session.id);
}

test("Available Activities includes Source Item and Crafting, and omits Commission", () => {
  const source = readFileSync(new URL("../scripts/main.mjs", import.meta.url), "utf8");
  const block = id => {
    const start = source.indexOf(`id: ${id}`);
    return source.slice(start, source.indexOf("activities.register", start + 10));
  };
  assert.match(block("SOURCE_ITEM_ACTIVITY_ID"), /availableInSessions: true/);
  assert.match(block("COMMISSION_ACTIVITY_ID"), /availableInSessions: false/);
  assert.match(source, /name: "Crafting"/);
  assert.match(source, /name: "Training"/);
});

test("Advance Day spends eight Session hours for every participant, and a Source Item day counts as those hours", async () => {
  const hidden = world();
  const hiddenStart = await activeSession(hidden.sessions, ["training"]);
  const hiddenProjects = new ProjectService({ repository: hidden.repository, now: () => 500 });
  await hiddenProjects.create(createSourceItemProject({
    owner: { uuid: "Actor.aric", name: "Aric" },
    target: { uuid: "Item.cloak", name: "Cloak of Protection", rarity: "uncommon" },
    locationId: "market",
    checkSkill: "arc",
    investmentGp: 100,
    weeks: 1
  }, { idFactory: () => "cloak", now: () => 1 }));
  await hiddenProjects.advanceDay({ idempotencyKey: "hidden-day" });
  assert.equal((await hidden.repository.read()).segments[hiddenStart.segment.id].participants[0].allocatedHours, 8);
  assert.equal((await hiddenProjects.get("cloak")).progress.elapsed.completedDays, 1);

  const allowed = world();
  const started = await activeSession(allowed.sessions, ["source-item"]);
  const projects = new ProjectService({ repository: allowed.repository, now: () => 500 });
  await projects.create(createSourceItemProject({
    owner: { uuid: "Actor.aric", name: "Aric" },
    target: { uuid: "Item.cloak", name: "Cloak of Protection", rarity: "uncommon" },
    locationId: "market",
    checkSkill: "arc",
    investmentGp: 100,
    weeks: 1
  }, { idFactory: () => "cloak", now: () => 1 }));
  await projects.create(createCommissionProject({
    owner: { uuid: "Actor.aric", name: "Aric" },
    contractorName: "Smith",
    itemDescription: "Plate",
    locationId: "market",
    requiredDays: 5
  }, { idFactory: () => "plate", now: () => 1 }));
  await projects.advanceDay({ idempotencyKey: "day-1" });
  assert.equal((await allowed.repository.read()).segments[started.segment.id].participants[0].allocatedHours, 8);
  await projects.advanceDay({ idempotencyKey: "day-2" });
  const state = await allowed.repository.read();
  assert.equal(state.segments[started.segment.id].participants[0].allocatedHours, 16);
  assert.equal(state.projects.cloak.progress.elapsed.completedDays, 2);
  assert.equal(state.projects.plate.progress.elapsed.completedDays, 2);
});

test("Session History names each person's hours or days without internal ids", () => {
  const rows = sessionSpends({
    session: { segmentIds: ["seg"] },
    segments: [{
      id: "seg",
      participants: [
        { actorUuid: "Actor.aric", name: "Aric" },
        { actorUuid: "Actor.brom", name: "Brom" }
      ],
      allocations: [
        { projectId: "train", participantActorUuids: ["Actor.aric", "Actor.brom"], hours: 4, createdAt: 2_000 },
        { projectId: "craft", participantActorUuids: ["Actor.aric"], hours: 2, createdAt: 3_000, recipeName: "Longsword", activityId: "crafting" },
        { projectId: "source", participantActorUuids: ["Actor.aric"], hours: 8, createdAt: 4_000, activityId: "source-item" },
        { projectId: "carouse", participantActorUuids: ["Actor.brom"], days: 1, hours: 0, createdAt: 5_000, activityId: "carousing" }
      ]
    }],
    projects: {
      train: { id: "train", name: "Learn Dwarvish", activityType: "training", owner: { uuid: "Actor.aric", name: "Aric" } },
      source: { id: "source", name: "Source Cloak of Protection", activityType: "source-item", owner: { uuid: "Actor.aric", name: "Aric" } },
      carouse: { id: "carouse", name: "Carousing", activityType: "carousing", owner: { uuid: "Actor.brom", name: "Brom" } }
    },
    activityName: id => ({ training: "Training", crafting: "Crafting", "source-item": "Source Item", carousing: "Carousing" })[id]
  });
  assert.deepEqual(rows.map(row => `${row.who} ${row.amount} on ${row.what}`), [
    "Brom 1 day on Carousing",
    "Aric 8 hours on Source Cloak of Protection",
    "Aric 2 hours on Longsword",
    "Aric 4 hours on Learn Dwarvish",
    "Brom 4 hours on Learn Dwarvish"
  ]);
  assert.equal(rows.some(row => `${row.who} ${row.amount} ${row.what} ${row.when}`.includes("Actor.")), false);
});

test("Session History lists every change in chronological order", () => {
  const rows = sessionJournal({
    session: {
      startedAt: 1_000,
      finalizedAt: null,
      segmentIds: ["seg"],
      participants: [
        { actorUuid: "Actor.aric", name: "Aric" },
        { actorUuid: "Actor.brom", name: "Brom" }
      ]
    },
    segments: [{
      id: "seg",
      participants: [
        { actorUuid: "Actor.aric", name: "Aric" },
        { actorUuid: "Actor.brom", name: "Brom" }
      ],
      allocations: [
        { projectId: "train", participantActorUuids: ["Actor.aric", "Actor.brom"], hours: 4, createdAt: 1_500 },
        { projectId: "carouse", participantActorUuids: ["Actor.aric"], days: 1, hours: 0, createdAt: 2_500 }
      ]
    }],
    projects: [
      {
        id: "early",
        name: "Old Carousing",
        activityType: "carousing",
        owner: { uuid: "Actor.aric", name: "Aric" },
        history: [{ at: 100, type: "created", data: {} }]
      },
      {
        id: "train",
        name: "Learn Dwarvish",
        activityType: "training",
        owner: { uuid: "Actor.aric", name: "Aric" },
        metadata: { training: { proficiencyLabel: "Dwarvish" } },
        history: [
          { at: 1_200, type: "created", data: {} },
          { at: 1_800, type: "proficiency-awarded", data: {} }
        ]
      },
      {
        id: "research",
        name: "Research",
        activityType: "lore-research",
        owner: { uuid: "Actor.aric", name: "Aric" },
        progress: { elapsed: { completedDays: 1, requiredDays: 7 } },
        history: [{ at: 2_200, type: "elapsed-day", data: { days: 1 } }]
      },
      {
        id: "carouse",
        name: "Carousing",
        activityType: "carousing",
        owner: { uuid: "Actor.aric", name: "Aric" },
        metadata: {
          xge: {
            currencyNote: "Aric pays 10 gp for Carousing.",
            checks: [{ label: "Persuasion", total: 16, dc: null }]
          }
        },
        history: [
          { at: 1_400, type: "created", data: {} },
          { at: 3_000, type: "xge-resolved", data: { summary: "One allied contact.", complication: "A rumor sticks to you." } },
          { at: 3_100, type: "completed", data: {} }
        ]
      },
      {
        id: "stranger",
        name: "Someone Else",
        owner: { uuid: "Actor.other", name: "Other" },
        history: [{ at: 1_600, type: "created", data: {} }]
      }
    ]
  });
  assert.deepEqual(rows.map(row => `${row.who} | ${row.project} | ${row.change} | ${row.result}`), [
    "Aric | Learn Dwarvish | Project started | ",
    "Aric | Carousing | Project started | Aric pays 10 gp for Carousing.",
    "Aric | Learn Dwarvish | Spent 4 hours | ",
    "Brom | Learn Dwarvish | Spent 4 hours | ",
    "Aric | Learn Dwarvish | Training completed | Dwarvish",
    "Aric | Research | Advance Day added 1 day | 1 of 7 days",
    "Aric | Carousing | Spent 1 day | ",
    "Aric | Carousing | Persuasion 16 | ",
    "Aric | Carousing | Outcome recorded | One allied contact. Complication: A rumor sticks to you.",
    "Aric | Carousing | Project completed | "
  ]);
  assert.equal(rows.some(row => row.project === "Old Carousing" || row.project === "Someone Else"), false);
  assert.equal(rows.some(row => `${row.who} ${row.project} ${row.change}`.includes("Actor.")), false);
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

test("Advance Day takes the remaining hours when fewer than 8 are left and does not charge a presence day twice", async () => {
  let stored = null;
  let sessionId = 0;
  let segmentId = 0;
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const sessions = new SessionService({
    repository,
    idFactory: () => `session-${++sessionId}`,
    segmentIdFactory: () => `segment-${++segmentId}`,
    now: () => 1_000
  });
  const projects = new ProjectService({ repository, now: () => 1_500 });
  const started = await sessions.start((await sessions.create({
    name: "Short Week",
    locationId: "town",
    days: 3,
    plannedDurationHours: 10,
    participants: [
      { actorUuid: "Actor.darro", name: "Darro" },
      { actorUuid: "Actor.mira", name: "Mira" }
    ],
    availableActivities: ["training", "carousing", "source-item"]
  })).id);
  const carouse = (await import("../scripts/activities/xge/xge-project.mjs")).buildXgeProject({
    activityType: "carousing",
    owner: { uuid: "Actor.darro", name: "Darro" },
    locationId: "town",
    socialClass: "lower",
    npcNames: "Mira"
  }, { location: { id: "town", capabilities: [] }, idFactory: () => "party", now: () => 1 }).project;
  await projects.create(carouse);
  await projects.advanceDay({ idempotencyKey: "day-1" });
  let segment = (await repository.read()).segments[started.segment.id];
  assert.equal(segment.participants.find(entry => entry.actorUuid === "Actor.darro").allocatedHours, 8);
  assert.equal(segment.participants.find(entry => entry.actorUuid === "Actor.mira").allocatedHours, 8);
  assert.equal(segment.allocations.filter(entry => entry.participantActorUuids.includes("Actor.darro") && entry.hours === 8).length, 1);
  const session = await sessions.get(started.session.id);
  const firstJournal = sessionJournal({ session, segments: [segment], projects: await projects.list() });
  assert.equal(firstJournal.some(row => row.who === "Mira" && row.project === "Advance Day" && row.change === "Spent 8 hours"), true);
  assert.equal(firstJournal.some(row => row.who === "Darro" && row.change === "Spent 8 hours"), true);
  const time = sessionParticipantTime({ session, segments: [segment] });
  assert.equal(time.find(row => row.name === "Darro").timeLabel, "1 / 3 days · 8 / 10 hours");
  assert.equal(time.find(row => row.name === "Mira").timeLabel, "0 / 3 days · 8 / 10 hours");

  await projects.advanceDay({ idempotencyKey: "day-2" });
  segment = (await repository.read()).segments[started.segment.id];
  assert.equal(segment.participants.every(entry => entry.allocatedHours === 10), true);
  const second = sessionJournal({
    session: await sessions.get(started.session.id),
    segments: [segment],
    projects: await projects.list()
  });
  assert.equal(second.filter(row => row.result === "Only 2 hours remained, so this day took 2 hours instead of 8.").length, 2);
  await projects.advanceDay({ idempotencyKey: "day-3" });
  segment = (await repository.read()).segments[started.segment.id];
  assert.equal(segment.participants.every(entry => entry.allocatedHours === 10), true);
  const third = sessionJournal({
    session: await sessions.get(started.session.id),
    segments: [segment],
    projects: await projects.list()
  });
  assert.equal(third.filter(row => row.result === "No hours remained, so this day took none of the 8.").length, 2);
});

test("participant time counts instructor hours, crafting hours, and day-based days", () => {
  const session = {
    days: 4,
    plannedDurationHours: 16,
    participants: [
      { actorUuid: "Actor.darro", name: "Darro" },
      { actorUuid: "Actor.mira", name: "Mira" }
    ],
    segmentIds: ["segment-1"]
  };
  const segments = [{
    id: "segment-1",
    participants: [
      { actorUuid: "Actor.darro", name: "Darro", availableHours: 16, allocatedHours: 12 },
      { actorUuid: "Actor.mira", name: "Mira", availableHours: 16, allocatedHours: 4 }
    ],
    allocations: [
      { id: "train", projectId: "train", participantActorUuids: ["Actor.darro", "Actor.mira"], hours: 4, days: null },
      { id: "craft", projectId: "craft", participantActorUuids: ["Actor.darro"], hours: 8, days: null, source: "craftworks" },
      { id: "present", projectId: "carouse", participantActorUuids: ["Actor.darro"], hours: 0, days: 1, source: "xge" },
      { id: "source", projectId: "cloak", participantActorUuids: ["Actor.mira"], hours: 0, days: 1, activityId: "source-item" }
    ]
  }];
  const rows = sessionParticipantTime({ session, segments });
  assert.equal(rows[0].timeLabel, "1 / 4 days · 12 / 16 hours");
  assert.equal(rows[1].timeLabel, "1 / 4 days · 4 / 16 hours");
  const hoursOnly = sessionParticipantTime({ session: { ...session, days: null }, segments });
  assert.equal(hoursOnly[0].timeLabel, "12 / 16 hours");
  assert.equal(hoursOnly[0].daysLabel, "");
});

test("a session saved before the Xanathar activities gains them once, and a later edit can turn one off", async () => {
  let stored = {
    schemaVersion: 1,
    projects: {},
    segments: {},
    sessions: {
      old: {
        schemaVersion: 1,
        id: "old",
        name: "Town",
        participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
        availableActivities: ["training", "source-item", "crafting"],
        plannedDurationHours: 16,
        status: "active",
        days: 4,
        daysUsed: 1,
        segmentIds: [],
        plannedProjectIds: [],
        history: [{ at: 1, type: "created", data: {} }],
        createdAt: 1
      }
    },
    consumedDayKeys: []
  };
  const repository = new ProjectRepository({
    getState: async () => stored,
    setState: async value => { stored = structuredClone(value); }
  });
  const sessions = new SessionService({ repository, idFactory: () => "later", segmentIdFactory: () => "segment-9", now: () => 5 });
  const seeded = await repository.read();
  for (const id of XGE_ACTIVITY_IDS) assert.equal(seeded.sessions.old.availableActivities.includes(id), true);
  assert.equal(seeded.sessions.old.availableActivities.includes("training"), true);
  stored = structuredClone(seeded);
  const edited = await sessions.update("old", {
    availableActivities: seeded.sessions.old.availableActivities.filter(id => id !== "crime")
  });
  assert.equal(edited.availableActivities.includes("crime"), false);
  assert.equal(edited.availableActivities.includes("carousing"), true);
  assert.equal((await repository.read()).sessions.old.availableActivities.includes("crime"), false);
  const created = await sessions.create({
    name: "Later",
    plannedDurationHours: 8,
    participants: [{ actorUuid: "Actor.aric", name: "Aric" }],
    availableActivities: ["training"]
  });
  assert.deepEqual(created.availableActivities, ["training"]);
  assert.equal((await repository.read()).sessions[created.id].availableActivities.includes("carousing"), false);
});

test("presence dots, participant time, and the session label column are in the session views", () => {
  const dashboard = readFileSync(new URL("../templates/downtime-dashboard.hbs", import.meta.url), "utf8");
  const project = readFileSync(new URL("../templates/project-detail.hbs", import.meta.url), "utf8");
  const session = readFileSync(new URL("../templates/session-detail.hbs", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../templates/create-session.hbs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles/morelord-downtime.css", import.meta.url), "utf8");
  const registration = readFileSync(new URL("../scripts/activities/xge/register-xge.mjs", import.meta.url), "utf8");
  assert.match(dashboard, /class="ml-presence-dot"/);
  assert.match(dashboard, /data-tooltip="\{\{presenceTooltip\}\}"/);
  assert.match(dashboard, /class="ml-downtime-make-active"/);
  assert.equal(dashboard.includes("ml-badge"), false);
  assert.equal(dashboard.includes("fa-star"), false);
  assert.match(project, /class="ml-presence-dot"/);
  assert.equal(project.includes("fa-star"), false);
  assert.match(session, /Participant Time/);
  assert.match(session, /\{\{timeLabel\}\}/);
  assert.match(session, /class="ml-presence-dot"/);
  assert.equal(session.includes("gmOperations"), false);
  assert.match(editor, /name="availableActivities"/);
  assert.match(registration, /availableInSessions: true/);
  assert.equal(registration.includes("availableInSessions: activity.presence"), false);
  assert.match(css, /\.ml-downtime-session-detail \.ml-data-list > div \{[\s\S]*?grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
});
