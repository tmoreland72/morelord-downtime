# Morelord Downtime

Morelord Downtime is the persistent Project and campaign-time orchestration layer for the Morelord suite on Foundry VTT 14.

Morelord Core 0.3.0 or newer is required and provides the shared design system, participation helpers, documentation, and Location services. Journeys, Craftworks, and Marketplace are recommended integrations: Downtime detects and uses their public APIs when available without preventing the base module from loading when one is absent.

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

Phase 8 provides the structured GM/player dashboard and full Downtime Session lifecycle. GMs prepare and publish Sessions, monitor intervention queues, finalize with validation, and review history from Session details. Players preview relevant Sessions, create permitted Projects, and allocate time through GM-authoritative requests. The dashboard places Downtime Sessions above Projects and launches the same Core-owned Manage Locations application used throughout the suite.

Source Item is an elapsed activity backed by Marketplace. A character selects a Common through Legendary magic item from their Marketplace wishlist, spends at least 100 gp, and commits at least one week. Gold and extra weeks improve a hidden Arcana or Investigation result; completion reveals either the requested item's offer price or 1d4 Marketplace-selected alternatives of the same or lower rarity. One unassisted Persuasion result may then adjust the offers.

Sessions are persistent downtime opportunities distinct from Projects. GMs can prepare drafts, publish upcoming opportunities, start them to make time available, and finalize with unresolved-time validation. Players see only Sessions and Projects relevant to Actors they own. Their Project creation and allocation requests are validated and committed by the primary active GM; Project choices come from the active Session rather than a hardcoded player menu.

## Cancelling and deleting Projects

GMs and a Project owner's players can use **Cancel Project** and **Delete Project** from the dashboard, Project details, or the Training, Commission, and Source Item editors. Cancellation stops further progress and retains the Project under **Show Completed**. Unused Projects can be deleted immediately; Projects with recorded progress must be cancelled first. Deletion permanently removes the Project and its history and clears planned Session links, but retains Session allocation records. Neither action refunds spent time or gold. Crafting Projects remain managed in Craftworks.

## Development standards

Downtime is not production-ready and is currently outside the standard release workflow. Shared Core UI standards still apply: Source Item results use Core chat cards, and icon-only controls provide accessible labels. Run Core's design-system check alongside the existing Downtime tests.
