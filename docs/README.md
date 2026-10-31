---
title: Morelord Downtime Documentation
description: Manage persistent Projects, downtime Sessions, training, commissions, and item sourcing.
slug: morelord-downtime
product: morelord-downtime
version: 0.2.2
foundry: 14
order: 0
---

# Morelord Downtime

Downtime tracks long-running character Projects across GM-managed downtime Sessions and campaign days. Projects retain their progress between Sessions.

## Setup

Requires Foundry VTT 14, D&D5e 5.3 or newer, and Morelord Core 0.9.0 or newer. Enable Core and Downtime in your world. Open **Morelord Downtime** from the timer icon in **Morelord Tools** on the scene controls. GMs and players both see it. Core provides the shared interface, website documentation links, character eligibility, and Locations.

Optional integrations are Journeys 0.2.1+, Craftworks 0.4.3+, and Marketplace 0.9.2+. Journeys supplies travel-day advancement; Craftworks supplies crafting Projects; Marketplace supplies Source Item wishlist choices, currency handling, and offers. Missing integrations disable their related features without preventing the base module from loading.

The package has been submitted to Foundry for approval. Submission alone does not establish approval or tested compatibility with a particular Foundry build.

## GM workflow

1. Open **Manage Locations** to configure the shared Locations and capabilities your activities need. **Shared Locations** below explains which capabilities each activity uses.
2. Create a Session with its Location, participants, and permitted activities. **Days** is optional and starts blank. **Hours** is each character's allocatable time and starts at 40. Setting **Days** fills **Hours** with **Days** × 8, and **Hours** can then be changed. A Session can be 2 hours with no days, or 2 days with 20 hours. The Session is **Pending**, so participants can review it. Only a GM can edit **Days** and **Hours**.
3. Start the Session to make **Hours** available. **Advance Day** applies one day to projects measured in days. Those projects are limited by **Days** only when **Days** is set. Hour allocations are limited by **Hours** and can continue until the GM finalizes the Session. Finalize when the Session should close, or cancel it while keeping its record. Unfinished Projects remain available for later Sessions. Saved sessions keep their hours and leave **Days** blank.

**Session History** on a Session lists each participant's spent time: who, how many hours or days, which Project or activity, and when. Training includes the student and the instructor. Crafting time and Source Item days are included.

Character choices include player-owned characters and character members of the primary party; ownership still controls player access. The primary active GM handles player requests, so a GM must be connected for those requests to complete.

## Player workflow

Open Downtime to see Sessions and Projects relevant to characters you own. On **New Project**, the question mark opens an explanation of each project type: what it does, the time, the cost, the checks, where and when it advances, and the outcome. Sessions are read-only for players. Only a GM can create, edit, or delete a Session. Create a Project, or plan an existing Project into an eligible Session. Once the Session is active, choose contributors and allocate hours. Each contributor spends the entered duration; the Project gains that duration once. A Project can continue across multiple Sessions. **Available Activities** includes Training, Crafting, and Source Item. When one of those is enabled, time spent on it is allocated to that character in the active Session. The Session shows its Location, or **No Location**. What that place allows is explained in **Shared Locations**.

## Shared Locations

Downtime uses the locations saved in Morelord Core. Journeys, Craftworks, and Marketplace read the same records. A location names a place and the facilities there. Saving a location makes it available in Downtime's Location menus. Projects and Session activities are set up in Downtime.

### Setup

On the Downtime dashboard, under **Locations**, choose **Manage Locations**. That opens the **Morelord Locations** window. The same editor is **Manage Shared Locations** in the Morelord Core settings. Enter the name, settlement, capabilities, and associated scenes there, then save.

How to fill in those fields is in Morelord Core's documentation, in the **Shared Locations** section: [morelordgaming.com/docs/morelord-core](https://morelordgaming.com/docs/morelord-core).

### Capabilities, tiers, and specialties

Each capability has a **Type**, a **Tier**, and, for some types, a **Specialty**.

Tiers are Common, Uncommon, Rare, Very Rare, and Legendary. A higher tier fills a need for a lower tier of the same type. Set **Tier** on the capability. **Settlement Type** is a separate field.

**Specialty** appears for **Instructor**, **Forge**, and **Workshop**. It is a checkbox menu. Check every specialty that one row should cover. With nothing checked, the closed summary reads **Any**, and that row covers every specialty of its type. A specialty saved earlier as a single value remains that one specialty. When a location has several rows of the same type, a specialty is allowed when any row includes it. A row left on **Any** covers every specialty of that type.

These are the Downtime uses:

- **Training** with an NPC instructor uses the **Instructor** specialties.
- **Crafting** uses the capability **Type** and **Tier** named on the recipe's facility. A Forge or Workshop row meets that facility whether **Specialty** is **Any** or a list of particular weapons, armor, tools, or other entries.
- **Source Item** and **Commission** store the location you choose on the Project.
- **Research Drakkenheim Recipes** runs from the researcher and the component. It has no Location field.

**Marketplace**, **Library**, **Temple**, and **Contractor** stay on the shared location for the rest of the suite. Downtime reads **Alchemist** when a crafting recipe's facility names Alchemist.

### Training

An NPC instructor teaches a **Select Training** subject when the location's **Instructor** capability includes that subject. **Select Training** follows Configure Sources: skills, languages, tools, weapons, armor, and weapon masteries from the sources enabled for the world, including Xanathar's Guide to Everything and Tasha's Cauldron of Everything when those sources are enabled. **Any** allows every subject in that list. A location whose only Instructor specialty is Common Sign Language teaches that language. A weapon and its weapon mastery share an id, so checking that weapon covers both.

A location with no **Instructor** capability has no subjects for an NPC. **Select Training** then reports that this location's Instructor cannot teach the subjects in the current list, and saving the Project is refused with "This Location's Instructor cannot teach that subject."

On a Training Project, **Project Location (Optional)** includes **No fixed Location**. For an NPC instructor, that choice leaves the subject list open while you create the Project, and the Project list shows **Any Location**. After you choose a location, the NPC list is limited to that location's Instructor specialties, and the NPC is available only while the Session is at that location.

When the Project has no location, allocating hours uses the Session's location. A Session that has a location applies that location's Instructor specialties to the NPC. A Session location with no **Instructor** capability has no NPC subjects.

A character instructor teaches subjects that character already knows, must be a different character from the student, and spends the same hours as the student. Those hours come out of both characters' Session time, including when a player allocates the time. The instructor's own remaining hours are the limit. Cancelling or deleting the training returns those hours to both characters. The Instructor specialty list applies to an NPC instructor and to a provider instructor. A provider uses that provider's own Instructor specialties. When the provider has a location, the Session has to be at that location.

A Training Project that has a location receives Session hours only while the Session is at that location.

### Crafting

A recipe appears in **Projects** when the character can work it at the scene being viewed or at the active Session's place. Craftworks shows the requirement on the recipe as **Facility**. **No facility required** means the recipe can be worked at any place, including while the Session is On the Road. A facility such as "Rare or higher Forge" means one of those places needs that capability type at that tier or a higher tier. When the place has more than one capability of that type, the highest tier is the one that counts.

In Craftworks, under **Crafting**, each artisan's tool is assigned a capability type, or **No facility required**. Until a tool is assigned a facility, its recipes show **No facility required**. The tier follows the item's rarity: Common, Uncommon, Rare, Very Rare, or Legendary. Recipes from the Drakkenheim content pack use a Workshop at the item's rarity. A Forge or Workshop whose **Specialty** is **Any**, or a list of particular entries, still meets a recipe that asks for that type and tier.

Work already underway stays in the list and shows as paused when neither the scene nor the Session's place allows it.

### Source Item

**Location** is required. The menu starts at **Choose a Location**. Downtime stores that location on the Project. The search then uses the wishlist item, the gold, the weeks, and Arcana or Investigation.

### Commission

**Location** is required, and the menu starts at **Choose a Location**. Finished work is collected at that location. The commission advances with campaign days.

### No location

A Session's **Location** menu includes **No Location**. The Session list shows **No Location** when the Session has no location, and when the saved location can no longer be found. Place checks treat a Session with no location as **On the Road**. On the Road is a temporary place with an empty capability list. A crafting facility can still be met by the scene being viewed. An NPC whose Project has no location can train during that Session. An NPC whose Project names a location waits until the Session is at that location.

A Session with **No Location** leaves crafting recipes in the list when the scene being viewed can still support them.

While no Session is active, the place is the shared location of the scene that person is viewing. A scene with no associated location has no current place.

A Training Project left on **No fixed Location** shows **Any Location**. Its NPC instructor follows a location's Instructor specialties when the Project has a location, or when hours are allocated during a Session that has a location. With neither location set, the NPC subject list stays open.

Saving a Source Item or Commission Project requires a location.

### Players

Players see the Session's location, or **No Location**, and open the Session read-only. **Manage Locations** is on the GM dashboard. On a Training Project, **Project Location (Optional)** and an NPC instructor follow the specialty rules above. Crafting recipes follow the scene the player is viewing and the active Session's place.

## Activities

### Research Drakkenheim Recipes

Choose a researcher and a monster component from their inventory or a party Group they belong to. Allocate one hour in a Session that allows **Research Drakkenheim Recipes**. The component must still be available; research does not consume it or request a skill check.

Project Details saves up to five distinct random recipes matching the component's family and recipe rarity, using the same filters as the Recipes browser. Organ (Very Rare), for example, finds all four Very Rare Organ recipes in the complete catalog. Fewer than five matches returns all matches. Discoveries become known to all player characters. Completion stays in Downtime; **View Recipe** opens an individual result in the Craftworks Recipes browser. Research does not replace specialized ingredients needed for crafting.

Research appears in New Project and Session activity choices only while the Drakkenheim content pack is enabled and accessible through Craftworks. Existing Projects, results, and saved Session selections are preserved when access is unavailable. Results persist across reloads; repeating research requires a new Project and may return recipes seen before.

### Xanathar activities

These take 7 days each. **Religious Service** needs a Temple and uses Religion or Persuasion. **Research** needs a Library. **Research** and **Relaxation** move on **Advance Day** even when no Session is active. **Carousing**, **Crime**, **Gambling**, **Pit Fighting**, and **Religious Service** move only while an active Session is at the Project's location and includes the character. Carousing costs 10, 50, or 250 gp by social class. Upper class needs the GM to confirm access to the local nobility. Crime costs 25 gp. Gambling stakes 10 to 1,000 gp. Research costs 50 gp. Relaxation costs 7 gp and removes every Exhaustion level. Gold is taken from, or added to, the character's currency. Days spent during a Session show in **Session History**.

### Training

Select the student, exact proficiency or weapon mastery, and instructor. **Select Training** follows Configure Sources, so the list is the skills, languages, tools, weapons, armor, and weapon masteries enabled for the world. That includes Xanathar's Guide to Everything and Tasha's Cauldron of Everything when those sources are enabled. See **Shared Locations** for NPC instructors, **Any**, a location with no Instructor capability, and **No fixed Location**. A character instructor must know the selected proficiency, must differ from the student, and spends the same Session hours. Those hours are taken from the instructor as well as the student, including when only the student is checked on **Allocate**. The instructor sees that Training Project in their own list as **Instructing** the student, and can open it read-only. Cancelling or deleting the training returns them to both. Successful completion applies the proficiency to the student and records the outcome.

Estimates appear after selecting the proficiency. Languages and tools use `(10 − positive Intelligence modifier) × 40` hours with a one-workweek floor. Other proficiencies and masteries use that baseline as a labeled GM-defined extension. **Required Hours (GM Adjustable)** can be changed only by a GM. Players see the estimate and a save that changes it is rejected. Existing saved durations are preserved.

### Commissions

Record the contractor, Location, item, labor days, and payment or material notes. The Location is required and is where the finished work is collected. See **Shared Locations**. **Select Item** searches enabled compendiums through Core and keeps the selected item UUID. Defaults are 5/10/50/125/250 labor days for Common/Uncommon/Rare/Very Rare/Legendary items, halved for consumables and rounded up. Mundane defaults use gp list price divided by 10, rounded up to at least one day. Scrolls and artifacts require a manual estimate.

Commissions advance with campaign days. Commission is not an **Available Activities** choice on a Session, and a progressed day does not spend Session hours. Finished work waits for collection at the contractor's Location. This is a time tracker: selecting an item does not purchase, craft, or deliver it automatically.

### Source Item

Requires Marketplace. Select a Common through Legendary magic item from the character's Marketplace wishlist, a Location, and Arcana or Investigation. The Location is required and is stored on the Project. See **Shared Locations**. Commit at least 100 gp and one week. Gold is spent immediately; extra gold and weeks improve the check.

When the weeks are finished, Downtime posts a **Source Item** roll request in chat for the owning player. Clicking **Roll** opens the normal skill roll dialog for Arcana or Investigation. The player makes that roll. A GM can click it when that player is offline. The same sourcing result is then revealed. The investment bonus is added to the roll. A successful result says the item must be picked up at the Project's assigned Location and names that Location. The chat card and the Project's **Sourcing Result** both include that line, under **Pickup** on the Project. If no Location is assigned, those results say **No location is assigned** and do not include a pickup line.

**Source Item** is also an **Available Activities** choice, checked per Session, like Crafting. **Advance Day** spends 8 hours of that character's Session time for each day the Project progresses, when the active Session includes the character and **Source Item**. A day advanced while **Source Item** is not enabled, or while the character is not in the Session, is not charged later. Completion reveals an offer for the requested item or 1d4 Marketplace alternatives of the same or lower rarity. **Request Persuasion Roll** posts a chat roll request. The owning player clicks **Roll** and makes a Persuasion check in the skill roll dialog. A GM can roll it when that player is offline. The roll is compared with the sourcing DC:

- Fail by 5 or more: price +10%
- Fail by 1 to 4: price +5%
- Meet the DC, or beat it by 1 to 4: no change
- Beat the DC by 5 to 9: price −10%
- Beat the DC by 10 to 14: price −20%
- Beat the DC by 15 or more: price −25%

A poor roll cannot raise the price by more than 10%. A good roll cannot lower it by more than 25%. The chat result names the tier and the adjustment. The same table is on the Source Item Project after the search resolves. The initial investment is not refunded if the search fails; later edits can add investment or weeks but cannot reduce or redirect the committed investment.

### Crafting

Craftworks owns recipes, materials, jobs, checks, and outputs. Ready marked recipes and active jobs appear in **Projects**. A recipe appears when the character can work it at the viewed scene or at the active Session's place. The facility type and tier for that place are described in **Shared Locations**. An active Session that is **On the Road**, or that has no Location, does not hide recipes the scene still allows. Neverwinter remains the crafting place while that scene is the one being viewed. Work already underway stays in the list and shows as paused when neither place allows it. Opening a row launches Craftworks with the crafter selected. The progress column shows successful crafting progress. When failed checks make the hours spent greater than that progress, the row also shows the hours spent, for example `2 / 8 hours (4 hours spent)`.

While a Downtime Session is **Active** and **Available Activities** includes **Crafting**, hours spent crafting are added to that character's allocated Session time. The player callout and the GM **Unallocated** total both use that allocation. This includes every crafting check, including a failed check, and a recipe that finishes without a check. The character must be a participant in the active Session. The primary active GM records the time, including a GM who is listed in Core's Ignored Users. A player can craft for a character they own, and a GM can craft for a character whose player is disconnected; the time is recorded once. If the primary GM is disconnected while the check is made, the time is recorded when that GM is connected again, as long as the Session is still active.

Open crafting time is included when Downtime first sees it during an active Session that allows **Crafting**. Hours spent while no Session is active, or by a character who is not in the active Session, are not added later. Cancelling a craft in Craftworks does not refund Session time already recorded. A crafting job whose output has already been awarded is not charged to a later Session. Session details name the character, the hours, and the recipe in history. An open Downtime window refreshes in place for the GM and for players when crafting changes a character or when that time is added to the Session. The window stays where it is; it is not brought to the front.

## Campaign days

Use **Advance Day** in GM Operations to advance elapsed activities. Journeys can also supply completed travel days automatically. Day advancement is handled by one active GM with duplicate protection. Avoid manually advancing a day that Journeys will also represent as a separate event.

## Cancel or delete a Project

The GM or owning player can cancel or delete from the dashboard, details, or activity editor. Cancellation stops progress and retains the Project under **Show Completed**. Unused Projects can be deleted immediately; cancel Projects with progress before deleting them. Deletion permanently removes the Project and its history and clears planned Session links. Cancelling or deleting a Training Project returns the Session hours that training used to the student and the instructor. Other Projects keep their Session allocation records, and neither action refunds gold. Crafting Projects remain managed in Craftworks.

Project and Session details show history newest first, with timestamps and readable descriptions of contributions, progress, outcomes, and changes. Linked characters, Projects, time pools, and Locations use their names when available; deleted references are marked unavailable. Existing saved history is displayed this way automatically, without rewriting records.

## Troubleshooting

- **Downtime is not under Morelord Tools, or an open window does not update after crafting:** update Morelord Core to 0.9.0 or newer. Until Core provides that tools registry, the same timer button stays on the Token controls. Core 0.9.0 refreshes the open window without bringing it forward.
- **No available hours:** the GM must start a Session that includes the character and permits the activity.
- **Request does not complete:** confirm a GM is connected and Core is enabled.
- **Crafting or Source Item did not reduce available time:** start a Downtime Session that includes the character and enable that activity under **Available Activities**. For Source Item, use **Advance Day** while that Session is active. Keep the primary GM connected for crafting checks. Time spent before the Session allowed the activity is not applied later. Cancelling a craft does not return time already recorded.
- **Crafting projects are missing:** confirm the character is viewing the scene for that Location, such as Neverwinter. Recipes that Location cannot support stay off the list. Work already started stays visible.
- **A player cannot change a Session:** only a GM can create, edit, or delete Sessions. Players open them read-only.
- **Missing crafting or sourcing options:** check the optional integration and its required version; sourcing also needs an eligible wishlist item.
- **This Location's Instructor cannot teach that subject:** add an **Instructor** capability on the location. Leave **Specialty** on **Any**, or check that subject. A character instructor teaches subjects that character already knows. See **Shared Locations**.
- **Activity cannot progress:** review the Project's participants, status, Location, and capability requirements.
- **Project disappeared after cancellation:** enable **Show Completed**.

Projects and Sessions are stored in the world. Back up world data before upgrading. Release preparation includes automated checks and live Foundry verification; the manifest's major-version declaration alone is not evidence that a specific build has been tested.
