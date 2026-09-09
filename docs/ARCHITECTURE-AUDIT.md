# Morelord Downtime Architecture Audit

## Decision

Shared Location and Capability infrastructure belongs in Morelord Core. Morelord Core is already a required dependency of Journeys, Craftworks, and Marketplace, so this avoids circular dependencies and keeps Downtime an orchestration layer rather than the owner of suite-wide geography.

The public contract is `game.modules.get("morelord-core").api.locations` (also reachable through `globalThis.MorelordCore.locations`). It owns settlement types, capability tiers and comparison, capability registration, persistent Location records, Scene association, current-location resolution, and generic requirement evaluation.

## Existing architecture

- Morelord Core publishes its API at Foundry `ready` and stores world data with hidden world settings.
- Journeys separates domain logic from a Foundry settings repository. It owns the active travel context and should emit enriched day-completion data without depending on Downtime.
- Craftworks stores character-owned crafting jobs on Actor flags and already exposes a module API. It must continue owning recipes, material consumption, crafting checks, and output.
- Marketplace stores shop definitions in a hidden world setting and owns inventory and transaction behavior.
- All four modules use Foundry V14 ApplicationV2 for current UI work.

## Ownership boundaries

- Core: Locations, capability vocabulary, tier comparison, generic requirement evaluation.
- Journeys: travel-day completion, activity-hour opportunity, traveling/temporary capabilities, current travel context.
- Craftworks: recipes, facilities declared by recipes, crafting jobs, materials, checks, crafted output.
- Marketplace: shops, inventory generation, transactions, sourcing offer creation.
- Downtime: persistent Projects, Session time allocations, participants, providers, day advancement, and activity plugins.

## Persistence direction

Locations are world-scoped records in Morelord Core. Actor-owned Craftworks jobs remain Actor flags. Downtime Projects should use a world-scoped store indexed by project id, with owner UUIDs rather than nesting the authoritative record on an Actor; that supports party, provider, location, and future Bastion ownership while allowing GM-authoritative writes.

## Integration contracts to add next

1. Marketplace: add an optional Location id and capability tier per shop; ask Core to evaluate defaults.
2. Craftworks: normalize recipe facility and portability fields; ask Core for eligibility.
3. Journeys: expose location/activity-hour context and call `morelordJourneys.dayComplete` after an authoritative day completion.
4. Downtime: require Core, recommend the feature modules, and activate optional integrations only when their public APIs are available.

## Implementation status

- Phase 1 complete in Morelord Core: shared constants, registry, persistent records, Scene resolver, requirement evaluator, GM Location manager, and public API.
- Phase 2 underway in Marketplace: shops now support a shared Location, an optional capability-tier override, capability-limited normal inventory, unrestricted explicit GM inventory, and a read-only integration API for future sourcing.
- Location management uses one Core-owned editor with suite-wide launchers. Core Settings, Journeys, Craftworks, Marketplace, and the Downtime dashboard all open `MorelordCore.locations.open()` rather than maintaining module-specific editors or destructive controls.
- Phase 3 complete in Craftworks: recipes support facility type/tier and portable, camp, or settlement work; the Craft UI pauses ineligible persistent jobs without discarding them; and `MorelordCraftworks.downtimeIntegration` exposes recipe, environment, project-state, and commission-description contracts.
- Phase 4 complete in Journeys: travel days carry a shared Location, personal activity hours, and non-persistent temporary capabilities; the public `travel` API updates and resolves context; and `morelordJourneys.dayComplete` publishes a stable idempotency key for optional consumers.
- Phase 5 complete in Downtime Core: the module manifest requires the Morelord suite, Projects persist in one GM-authoritative world store, activities register as plugins, effort and elapsed progress remain separate, provider work advances from authoritative day keys, and only the primary active GM consumes Journey day hooks.
- Phase 6 complete in Downtime Core: persistent Session time tracks participant availability and allocations; collaborative work atomically spends hours from every participant while advancing Project effort once; and Core Location requirements plus activity plugin eligibility can pause progress without deleting the Project.
- Phase 7 complete in Downtime Core: Training is the first registered activity plugin; language and tool study persists across Sessions; participant instructors require approval and matching allocated hours; provider instructors require the matching specialty and Location; and completion safely awards supported D&D5e proficiencies while recording unsupported cases instead of mutating unknown system data.
- Phase 8 complete in Downtime Core: persistent Sessions follow Draft -> Upcoming -> Active -> Finalized; drafts are editable; published Sessions provide ownership-filtered player preview; and starting makes planned time allocatable. Player Project creation, participant approval, and allocations cross a validated primary-GM authority boundary. The GM dashboard surfaces unallocated hours, player/GM intervention queues, collection work, and upcoming completions. Finalization validates unresolved conditions without deleting persistent Projects, and lifecycle history remains reviewable from detail pages. All windows use Core components through a shared Downtime application base, outer scrolling, and scroll-preserving renders.

## Duplicate-day strategy

Downtime should require an idempotency key for every day request. Producers supply a stable source key where possible (for example, `journey:<journey-id>:<day-number>`). Manual and long-rest requests receive a Downtime-created transition id. Downtime persists consumed keys before publishing completion hooks.
