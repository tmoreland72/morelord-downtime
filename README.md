# Morelord Downtime

Morelord Downtime is the persistent Project and campaign-time orchestration layer for the Morelord suite on Foundry VTT 14.

## Current implementation

The headless Project Engine provides:

- world-persistent Projects with Actor, party, provider, and future-owner UUID support;
- effort, elapsed-time, and hybrid progress;
- providers, participants, collection Locations, costs, requirements, metadata, and history;
- GM-authoritative CRUD and effort application;
- activity plugin registration;
- duplicate-safe authoritative day advancement;
- optional consumption of `morelordJourneys.dayComplete` by one active GM client.

## Public API

The API is available at `game.modules.get("morelord-downtime").api` and `MorelordDowntime`.

- `registerActivity(definition)`
- `open()` opens the Downtime dashboard (also available from Token Controls with the timer icon)
- `activities.get(id)` / `activities.list()`
- `projects.create(raw)` / `get(id)` / `list(filters)` / `update(id, changes)` / `remove(id)`
- `projects.applyEffort(id, hours, options)`
- `advanceDay({ idempotencyKey, source, metadata })`
- `locations.current()` / `locations.evaluate()` / `locations.open()`

The Project, allocation, and first activity contracts support the dashboard and Session-allocation workflow.

Time allocation is atomic with Project progress: every participant spends the shared duration, while the Project gains that duration once.

Phase 7 registers Training as the first activity plugin. Training discovers D&D5e languages, skills, armor, weapons, tools, and weapon masteries through a system adapter, and supports participant or provider instructors, travel compatibility, persistent progress across Sessions, and safe proficiency awards.

Phase 8 provides the structured GM/player dashboard and full Downtime Session lifecycle. GMs prepare and publish Sessions, monitor intervention queues, finalize with validation, and review history from Session details. Players preview relevant Sessions, create permitted Projects, and allocate time through GM-authoritative requests. The dashboard launches the same Core-owned Manage Locations application used throughout the suite.

Sessions are persistent downtime opportunities distinct from Projects. GMs can prepare drafts, publish upcoming opportunities, start them to make time available, and finalize with unresolved-time validation. Players see only Sessions and Projects relevant to Actors they own. Their Project creation and allocation requests are validated and committed by the primary active GM; Project choices come from the active Session rather than a hardcoded player menu.
