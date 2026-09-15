# Morelord Downtime

Morelord Downtime is the persistent Project and campaign-time orchestration layer for the Morelord suite on Foundry VTT 14.

Morelord Core 0.3.9 or newer is required and provides the shared design system, participation helpers, documentation, and Location services. Journeys, Craftworks, and Marketplace are recommended integrations: Downtime detects and uses their public APIs when available without preventing the base module from loading when one is absent.

## Current implementation

See the [user guide](docs/README.md) for setup, workflows, activities, and troubleshooting. Downtime has been submitted for Foundry package approval; submission does not mean approval is complete.

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

Training is an activity plugin. Training discovers D&D5e languages, skills, armor, weapons, tools, and weapon masteries through a system adapter, and supports participant or provider instructors, travel compatibility, persistent progress across Sessions, and safe proficiency awards.

Downtime provides the structured GM/player dashboard and full Downtime Session lifecycle. GMs prepare and publish Sessions, monitor intervention queues, finalize with validation, and review history from Session details. Players preview relevant Sessions, create permitted Projects, and allocate time through GM-authoritative requests. The dashboard places Downtime Sessions above Projects and launches the same Core-owned Manage Locations application used throughout the suite.

Source Item is an elapsed activity backed by Marketplace. A character selects a Common through Legendary magic item from their Marketplace wishlist, spends at least 100 gp, and commits at least one week. Gold and extra weeks improve a hidden Arcana or Investigation result; completion reveals either the requested item's offer price or 1d4 Marketplace-selected alternatives of the same or lower rarity. One unassisted Persuasion result may then adjust the offers.

Sessions are persistent downtime opportunities distinct from Projects. GMs can prepare drafts, publish upcoming opportunities, start them to make time available, and finalize with unresolved-time validation. Players see only Sessions and Projects relevant to Actors they own. Their Project creation and allocation requests are validated and committed by the primary active GM; Project choices come from the active Session rather than a hardcoded player menu.

## Cancelling and deleting Projects

GMs and a Project owner's players can use **Cancel Project** and **Delete Project** from the dashboard, Project details, or the Training, Commission, and Source Item editors. Cancellation stops further progress and retains the Project under **Show Completed**. Unused Projects can be deleted immediately; Projects with recorded progress must be cancelled first. Deletion permanently removes the Project and its history and clears planned Session links, but retains Session allocation records. Neither action refunds spent time or gold. Crafting Projects remain managed in Craftworks.

## Development standards

Downtime follows the standard Morelord release workflow. Shared Core UI standards apply: Source Item results use Core chat cards, and icon-only controls provide accessible labels. Run `npm test`, `npm run check`, and Core's `npm run check:design-system` before release. See [release instructions](RELEASING.md).


Project, Session, training, and crafting character choices use Core’s shared eligibility: player-owned characters and character members of the primary party. Existing ownership checks still apply.

## Training and commission estimates

Training hours are hidden until a proficiency or mastery is selected. Languages and tools start at `(10 − positive Intelligence modifier) × 40` hours (five 8-hour days per workweek), using Xanathar’s Training guidance with a one-workweek floor. The [official downtime playtest](https://media.wizards.com/2017/dnd/downloads/UA_Downtime.pdf) documents the same duration formula; published Xanathar’s Guide to Everything, p. 134, is the table reference. Other skills, armor, weapons, and mastery use that baseline as an explicitly labeled GM-defined extension, not an official training entitlement. The GM can adjust the estimate. Existing saved project hours are preserved.

Commission **Select Item** searches available enabled compendiums through Core and stores the chosen item UUID. Magic-item defaults are Common 5, Uncommon 10, Rare 50, Very Rare 125, and Legendary 250 labor days, halved for consumables and rounded up. Mundane items use list price in gp divided by 10, rounded up to at least one day. These follow the [2024 crafting guidelines](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items#CraftingMagicItems) and [equipment crafting rules](https://www.dndbeyond.com/sources/dnd/br-2024/equipment#CraftingEquipment); specialized recipes and contract terms may differ. Spell scrolls and artifacts require a manual estimate. A commission remains a time tracker: selecting an item does not automatically purchase, craft, or deliver it.
