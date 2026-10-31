# Morelord Downtime

Morelord Downtime is the persistent Project and campaign-time orchestration layer for the Morelord suite on Foundry VTT 14.

Morelord Core 0.9.0 or newer is required and provides the shared design system, participation helpers, documentation, Location services, background window refresh, and the Morelord Tools scene control. Journeys, Craftworks, and Marketplace are recommended integrations: Downtime detects and uses their public APIs when available without preventing the base module from loading when one is absent.

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

## Research Drakkenheim Recipes

Choose **New Project → Research Drakkenheim Recipes**, select a researcher and a monster component from their own inventory or a party Group they belong to, then allocate one hour from a Session that allows this activity. The component must remain available and is not consumed. Research makes no skill check.

Completion saves five distinct randomly selected matching recipes, or every match if fewer than five exist. An empty result is recorded when none match. Project Details keeps the results across reloads and opens each recipe in Craftworks; a new Project performs a new search. Discovered recipes become known to all player characters. Completion stays in Downtime; click a saved recipe to open it in the Craftworks Recipes browser.

This activity requires the updated Morelord Craftworks integration and uses its enabled Drakkenheim recipes, including custom Drakkenheim recipes, with the same ingredient-family and recipe-rarity filters as the Recipes browser. Other Downtime activities retain their existing optional integrations. The GM can enable this activity in new or edited Sessions.

Research appears in activity choices only while the Drakkenheim pack is enabled and accessible. Saved Projects, results, and Session selections remain intact if access becomes unavailable. Researching Organ (Very Rare) finds the same four recipes as those browser filters; crafting still requires each recipe's exact ingredients.

`MorelordDowntime.research.createProject({ owner: { uuid, name }, componentUuid })` uses the same GM-authoritative creation workflow as the UI.

## Public API

The API is available at `game.modules.get("morelord-downtime").api` and `MorelordDowntime`.

- `registerActivity(definition)`
- `open()` opens the Downtime dashboard (also available from the Morelord Tools scene control with the timer icon)
- `activities.get(id)` / `activities.list()`
- `projects.create(raw)` / `get(id)` / `list(filters)` / `update(id, changes)` / `remove(id)`
- `projects.applyEffort(id, hours, options)`
- `advanceDay({ idempotencyKey, source, metadata })`
- Crafting time is recorded from Craftworks' published hours spent. While a Downtime Session is active and **Crafting** is one of its **Available Activities**, each new hour a participant spends crafting is allocated to that Session, including a failed check and a recipe that finishes without a check. `craftTime.reconcileActor(actor)` runs that update for one character.
- **Source Item** is a Session activity beside Training and Crafting. **Commission** is not. A GM logs hours spent sourcing an item on an active Session that includes **Source Item**, and those hours are allocated to that character. Advancing a sourcing or commission day does not itself spend Session hours.
- `locations.current()` / `locations.evaluate()` / `locations.open()`

The Project, allocation, and first activity contracts support the dashboard and Session-allocation workflow.

Time allocation is atomic with Project progress: every participant spends the shared duration, while the Project gains that duration once.

Training is an activity plugin. **Select Training** follows Configure Sources, including Xanathar's Guide to Everything and Tasha's Cauldron of Everything when those sources are enabled. NPC and provider instructors follow the location rules in [Shared Locations](docs/README.md#shared-locations). Training supports participant or provider instructors, travel compatibility, persistent progress across Sessions, and safe proficiency awards. A player-character instructor spends the same Session hours as the student, and that instructor sees the Project read-only as **Instructing** the student.

Downtime provides the structured GM/player dashboard and full Downtime Session lifecycle. GMs prepare and start Sessions, monitor intervention queues, finalize with validation, and review history from Session details. Only a GM can create, edit, or delete a Session. Players see Sessions read-only. Project and Session history use readable text and referenced names instead of JSON, including existing saved records. Players preview relevant Sessions, create permitted Projects, and allocate time through GM-authoritative requests. The dashboard places Downtime Sessions above Projects and launches the same Core-owned Manage Locations application used throughout the suite.

Source Item is an elapsed activity backed by Marketplace. A character selects a Common through Legendary magic item from their Marketplace wishlist, spends at least 100 gp, and commits at least one week. Gold and extra weeks improve a hidden Arcana or Investigation result; completion reveals either the requested item's offer price or 1d4 Marketplace-selected alternatives of the same or lower rarity. A successful result says the item must be picked up at the Project's assigned Location and names that Location on the chat card and the Project result. If no Location is assigned, those results say so and leave out the pickup line. One Persuasion roll, requested in chat and made in the skill dialog, may then adjust the offers by the tier for that roll against the sourcing DC. A poor roll raises the price by at most 10%. A good roll lowers it by at most 25%. **Source Item** appears in a Session's **Available Activities** with Training and Crafting. The GM logs the hours spent sourcing, and those hours count toward that character's Session allocation.

Sessions are persistent downtime opportunities distinct from Projects. A Session is **Pending** or **Active**, and can be **Finalized** or **Cancelled**. **Days** is optional. **Hours** stays editable by the GM. Setting **Days** fills **Hours** with **Days** × 8, and the GM can then change **Hours**. Day-based projects are limited by **Days** only when **Days** is set. Hour allocations are limited by **Hours**. Saved sessions keep their hours and leave **Days** blank. Players see only Sessions and Projects relevant to Actors they own. Their Project creation and allocation requests are validated and committed by the primary active GM; Project choices come from the active Session rather than a hardcoded player menu.

## Shared Locations

Downtime reads locations from Morelord Core. The full rules are in the [user guide](docs/README.md#shared-locations). GMs open **Manage Locations** on the Downtime dashboard, or **Manage Shared Locations** in Core. Field setup is in Core's [Shared Locations](https://morelordgaming.com/docs/morelord-core) documentation.

- An **Instructor** specialty list limits an NPC instructor, and a provider instructor, to the checked subjects. With nothing checked, the summary reads **Any**, and every training subject is allowed. Several checked specialties are all allowed. A specialty saved as one value remains that one subject. A location with no **Instructor** capability has no NPC subjects. A character instructor teaches subjects that character already knows.
- A Training Project can stay on **No fixed Location**. The NPC subject list stays open until a location applies: the Project's location, or the Session's location when hours are allocated. A Project that has a location receives Session hours only while the Session is at that location.
- **Crafting** uses the capability type and tier on the recipe's **Facility** line. **No facility required** allows the recipe at any place. A named facility needs that type at a tier at least as high as the item's rarity. A Forge or Workshop meets that facility when **Specialty** is **Any** and when **Specialty** lists particular entries. In Craftworks, under **Crafting**, each artisan's tool is assigned that facility; until then the facility is **No facility required**. Recipes from the Drakkenheim content pack use a Workshop at the item's rarity.
- A Session set to **No Location** is **On the Road**, a temporary place with no capabilities. Crafting recipes the viewed scene allows stay listed. An NPC whose Project has no location can train during that Session. An NPC whose Project names a location waits until the Session is there.
- **Source Item** and **Commission** require a chosen location. Source Item stores it. A commission is collected there. **Research Drakkenheim Recipes** has no Location field.

Players see the Session location, or **No Location**. Sessions stay read-only for players, and **Manage Locations** is GM-only. The same specialty and crafting rules apply when a player creates a Training Project or works a recipe.

## Cancelling and deleting Projects

GMs and a Project owner's players can use **Cancel Project** and **Delete Project** from the dashboard, Project details, or the Training, Commission, and Source Item editors. Cancellation stops further progress and retains the Project under **Show Completed**. Unused Projects can be deleted immediately; Projects with recorded progress must be cancelled first. Deletion permanently removes the Project and its history and clears planned Session links. Cancelling or deleting a Training Project returns the Session hours that training used to the student and the instructor. Other Projects keep their Session allocation records, and neither action refunds gold. Crafting Projects remain managed in Craftworks. Cancelling a craft there does not refund Downtime Session time already recorded for that work.

## Development standards

Downtime follows the standard Morelord release workflow. Shared Core UI standards apply: Source Item results use Core chat cards, and icon-only controls provide accessible labels. Run `npm test`, `npm run check`, and Core's `npm run check:design-system` before release. See [release instructions](RELEASING.md).


Project, Session, training, and crafting character choices use Core’s shared eligibility: player-owned characters and character members of the primary party. Existing ownership checks still apply.

## Training and commission estimates

Training hours are hidden until a proficiency or mastery is selected. Languages and tools start at `(10 − positive Intelligence modifier) × 40` hours (five 8-hour days per workweek), using Xanathar’s Training guidance with a one-workweek floor. The [official downtime playtest](https://media.wizards.com/2017/dnd/downloads/UA_Downtime.pdf) documents the same duration formula; published Xanathar’s Guide to Everything, p. 134, is the table reference. Other skills, armor, weapons, and mastery use that baseline as an explicitly labeled GM-defined extension, not an official training entitlement. Only a GM can change **Required Hours (GM Adjustable)**. A player save that changes those hours is rejected. Existing saved project hours are preserved.

Commission **Select Item** searches available enabled compendiums through Core and stores the chosen item UUID. Magic-item defaults are Common 5, Uncommon 10, Rare 50, Very Rare 125, and Legendary 250 labor days, halved for consumables and rounded up. Mundane items use list price in gp divided by 10, rounded up to at least one day. These follow the [2024 crafting guidelines](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items#CraftingMagicItems) and [equipment crafting rules](https://www.dndbeyond.com/sources/dnd/br-2024/equipment#CraftingEquipment); specialized recipes and contract terms may differ. Spell scrolls and artifacts require a manual estimate. A commission remains a time tracker: selecting an item does not automatically purchase, craft, or deliver it.

## Optional usage and error reports

When a compatible Morelord Core is active, its explicit reporting choices can share fixed feature events and sanitized error code locations without connecting a Morelord account. Reporting is disabled in Developer Mode. No campaign content or account credentials are sent; a random world ID measures repeat use. See [Core reporting documentation](../morelord-core/TELEMETRY.md) for this module's event coverage and limitations. Existing Core versions continue to work without this optional reporting API. Website ingestion must be deployed before releasing these changes.

## Release dependency

This release requires Morelord Core 0.9.0 or newer so Downtime can register its timer control with Morelord Tools and refresh open windows without bringing them to the front. GMs and players both see that control. Optional integrations remain optional.

Per-version release notes live in `release-notes/RELEASE-NOTES-<version>.md` and are excluded from release packages. The cumulative root `CHANGELOG.md` is newest-version-first, rebuilt by `release.ps1`, and packaged at the root of the release ZIP for in-Foundry changelog viewers. Foundry links to the GitHub Releases page through the manifest `changelog` URL. Use the module-local `/tmp/` directory for working files; it is ignored by Git and excluded from release packages.
