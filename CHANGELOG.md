# Morelord Downtime Changelog

## 0.2.2

### Fixed

- Crafting projects stay in Downtime when the viewed scene can support the recipe. An active Session that is On the Road, or that has no Location, does not hide recipes Neverwinter can still support. Work already underway stays listed and shows as paused when neither place allows it. One recipe whose location check cannot be read no longer removes the rest of the crafting list.
- **Commission** is no longer an **Available Activities** choice. **Source Item** remains, checked per Session. **Advance Day** spends 8 hours of that character's Session time for each day a Source Item Project progresses, when the Session includes the character and **Source Item**. A day advanced while **Source Item** is not enabled is not charged later. Commission days do not spend Session hours.
- **Session History** lists each participant's spent time: who spent how many hours or days, on which Project or activity, and when. Training includes the student and the instructor. Crafting time and Source Item days are included.
- Only a GM can create, edit, or delete a Downtime Session. Players see Sessions read-only. Saving a Session is rejected for a player.
- An NPC instructor can teach only subjects the Location's **Instructor** specialty allows. **Any** or a blank specialty allows every subject. Neverwinter limited to **Common Sign Language** offers only that language. The check uses Core's `locationAllowsSpecialty` when Morelord Core 0.9.0 provides it.
- Instructor specialty may be several keys. An empty list allows every subject. A specialty saved as a single value is still that one key. NPC and provider checks both use `locationAllowsSpecialty`.
- **Select Training** follows Configure Sources. The list is the skills, languages, tools, weapons, armor, and weapon masteries enabled for the world, including Xanathar's Guide to Everything and Tasha's Cauldron of Everything when those sources are enabled. An NPC instructor can still teach only subjects the Location's **Instructor** specialty allows.
- Training with another player character as the instructor spends the same Session hours for both characters. Changing that allocation, or cancelling or deleting the training, updates both. The instructor cannot spend more time than they have left.
- Allocating Training from the Project charges the instructor as well as the student, including when the instructor was stored as an actor id or a token. The instructor's player sees the Project read-only, labeled **Instructing** the student.
- Only a GM can change a Training project's **Required Hours (GM Adjustable)**. The field is read-only for players, and a player request that changes those hours is rejected.
- **Days** on a Downtime Session is optional. **Hours** stays editable by the GM. Setting **Days** fills **Hours** with **Days** × 8, and **Hours** can then be changed. Day-based projects are limited by **Days** only when **Days** is set. Hour allocations are limited by **Hours**. Saved sessions keep their hours and leave **Days** blank.
- Sessions are **Pending** or **Active**, and can be **Finalized** or **Cancelled**. Saved Draft and Upcoming sessions become Pending.
- Crafting time is read from the character's saved Craftworks jobs, so a successful craft and a failed attempt both add their spent hours to the active Downtime Session.
- A finished Source Item search posts a roll request in chat. The owning player clicks **Roll** and makes the Arcana or Investigation check in the skill roll dialog. A GM can roll it when that player is offline. The sourcing result is unchanged.
- A successful Source Item result says the item must be picked up at the Project's assigned Location and names that Location. The chat card and the Project's **Sourcing Result** both include that line. If no Location is assigned, they say no location is assigned and leave out the pickup line.
- The follow-up Persuasion check is the same kind of chat roll request. Compared with the sourcing DC, failing by 5 or more raises the price 10%, failing by 1 to 4 raises it 5%, meeting it or beating it by less than 5 leaves it unchanged, beating it by 5 to 9 lowers it 10%, beating it by 10 to 14 lowers it 20%, and beating it by 15 or more lowers it 25%. The chat result shows that adjustment.

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
