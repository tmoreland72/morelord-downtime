# Morelord Downtime Changelog

## 0.2.2

### Fixed

- Crafting projects stay in Downtime when the viewed scene can support the recipe. An active Session that is On the Road, or that has no Location, does not hide recipes Neverwinter can still support. Work already underway stays listed and shows as paused when neither place allows it. One recipe whose location check cannot be read no longer removes the rest of the crafting list.
- **Commission** is no longer an **Available Activities** choice. **Source Item** remains, checked per Session. A GM logs hours spent sourcing an item from Session details or from the Source Item Project. Those hours are added to that character's allocated Session time. Advancing a campaign day does not itself spend Session hours for sourcing or commissions.
- Only a GM can create, edit, or delete a Downtime Session. Players see Sessions read-only. Saving a Session is rejected for a player.
- An NPC instructor can teach only subjects the Location's **Instructor** specialty allows. **Any** or a blank specialty allows every subject. Neverwinter limited to **Common Sign Language** offers only that language. The check uses Core's `locationAllowsSpecialty` when Morelord Core 0.9.0 provides it.
- The training list is the fixed D&D 2024 set of skills, languages, tools, weapons, armor, and weapon masteries. It uses Core's training catalog when that catalog is exposed, so the ids match Locations. It does not follow Configure Sources, compendium items, or extra system entries.

## 0.2.1

### Fixed

- Hours spent crafting in Morelord Craftworks are added to that character's allocated time in the active Downtime Session when **Available Activities** includes **Crafting**. Each crafting check counts, including a failed check, and so does a recipe that finishes without a check. Open crafting time already on the character is included when Downtime first sees it during an active Session. Time spent while no Session is active is not applied later, and cancelling a craft does not refund Session time already recorded. Awarded crafting jobs are not charged to a later Session.
- **Commission** and **Source Item** are included in a Session's **Available Activities** with Training and Crafting. Each day those projects progress spends one 8-hour labor day from the active Session when that activity is enabled and the character is participating. A day progressed while the activity is not enabled is not charged later.
- A crafting check allocates its spent hours to the active Session even when the connected GM is in Core's Ignored Users. A check that finishes while Downtime is still reading the current crafting total is still allocated.
- Open Downtime windows refresh in place for the GM and for players when Craftworks changes a character or when Session time is saved. The refresh does not bring Downtime to the front. This requires Morelord Core 0.9.0.

## 0.2.0

### Improvements

- The Downtime timer control registers with Morelord Tools and remains available to GMs and players. It requires Morelord Core 0.6.0 or newer. When that tools registry is unavailable, the timer button stays on the Token controls.

## 0.1.2

### Improvements

- Documentation opens the combined GM and player guide through Core.
- Added a manifest changelog link and moved release history into `release-notes/`. Local working files belong in ignored `/tmp/`.

- Release staging and generated ZIP files use module-local `/tmp/`; ZIP validation rejects working files and release-note sources.

## 0.1.1

### Improvements

- [Premium] Project and Session history now display readable progress, outcomes, changed fields, and referenced names instead of JSON. Existing saved records are formatted when viewed and remain unchanged.
- [Premium] Research requires an enabled, accessible Drakkenheim pack, matches the Recipes browser's family/rarity filters, and marks discoveries known to every player character. Completion stays in Downtime; clicking a result opens Recipes rather than Craft. New Project uses equal-width card columns; Session activity labels wrap without overlap through Core's shared checkbox grid.
- [Premium] Added optional feature/error instrumentation through Core's shared reporting service. Fresh GM consent is required; account connection is not. Existing Core dependencies and game behavior are unchanged.
- [Premium] Added Research Drakkenheim Recipes: a one-hour Project using a monster component from personal or party inventory, saving up to five random matching recipes without consuming the component. Requires the updated optional Craftworks integration.

## 0.1.0

### Added

- [Premium] Persistent Projects and downtime Sessions with GM-authoritative player requests, time allocation, and history.
- [Premium] Training with specific proficiency selections, instructors, editable estimates, and completion awards.
- [Premium] Commissions with Core item selection, editable labor estimates, and campaign-day progress.
- [Premium] Marketplace-backed Source Item Projects and Craftworks Project integration.
- [Premium] Shared Core Locations, character eligibility, interface components, and in-app documentation.
- [Premium] Standard Morelord release tooling and a versioned user guide.
