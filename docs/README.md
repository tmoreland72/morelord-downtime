---
title: Morelord Downtime Documentation
description: Manage persistent Projects, downtime Sessions, training, commissions, and item sourcing.
slug: morelord-downtime
product: morelord-downtime
version: 0.1.1
foundry: 14
order: 0
---

# Morelord Downtime

Downtime tracks long-running character Projects across GM-managed downtime Sessions and campaign days. Projects retain their progress between Sessions.

## Setup

Requires Foundry VTT 14, D&D5e 5.3 or newer, and Morelord Core 0.3.9 or newer. Enable Core and Downtime in your world. Open **Morelord Downtime** from the timer icon in Token Controls. Core provides the shared interface, in-app documentation, character eligibility, and Locations.

Optional integrations are Journeys 0.2.1+, Craftworks 0.4.3+, and Marketplace 0.9.2+. Journeys supplies travel-day advancement; Craftworks supplies crafting Projects; Marketplace supplies Source Item wishlist choices, currency handling, and offers. Missing integrations disable their related features without preventing the base module from loading.

The package has been submitted to Foundry for approval. Submission alone does not establish approval or tested compatibility with a particular Foundry build.

## GM workflow

1. Open **Manage Locations** to configure the shared Locations and capabilities your activities need.
2. Create a Session with its Location, planned hours, participants, and permitted activities.
3. Publish it as **Upcoming** so participants can review and plan their work.
4. Start the Session to make time available. Review allocations and any decisions needing attention.
5. Finalize after resolving remaining time and validation issues, or cancel the opportunity while retaining its record. Unfinished Projects remain available for later Sessions.

Character choices include player-owned characters and character members of the primary party; ownership still controls player access. The primary active GM handles player requests, so a GM must be connected for those requests to complete.

## Player workflow

Open Downtime to see Sessions and Projects relevant to characters you own. Create a Project, or plan an existing Project into an eligible Session. Once the Session is active, choose contributors and allocate hours. Each contributor spends the entered duration; the Project gains that duration once. A Project can continue across multiple Sessions.

## Activities

### Research Drakkenheim Recipes

Choose a researcher and a monster component from their inventory or a party Group they belong to. Allocate one hour in a Session that allows **Research Drakkenheim Recipes**. The component must still be available; research does not consume it or request a skill check.

Project Details saves up to five distinct random recipes matching the component's family and recipe rarity, using the same filters as the Recipes browser. Organ (Very Rare), for example, finds all four Very Rare Organ recipes in the complete catalog. Fewer than five matches returns all matches. Discoveries become known to all player characters. Completion stays in Downtime; **View Recipe** opens an individual result in the Craftworks Recipes browser. Research does not replace specialized ingredients needed for crafting.

Research appears in New Project and Session activity choices only while the Drakkenheim content pack is enabled and accessible through Craftworks. Existing Projects, results, and saved Session selections are preserved when access is unavailable. Results persist across reloads; repeating research requires a new Project and may return recipes seen before.

### Training

Select the student, exact proficiency or weapon mastery, and instructor. Character instructors must know the selected proficiency, must differ from the student, and contribute the same hours. An NPC instructor can be recorded by name and tied to a Location. Successful completion applies the proficiency to the student and records the outcome.

Estimates appear after selecting the proficiency. Languages and tools use `(10 − positive Intelligence modifier) × 40` hours with a one-workweek floor. Other proficiencies and masteries use that baseline as a labeled GM-defined extension. The GM may adjust it, and existing saved durations are preserved.

### Commissions

Record the contractor, Location, item, labor days, and payment or material notes. **Select Item** searches enabled compendiums through Core and keeps the selected item UUID. Defaults are 5/10/50/125/250 labor days for Common/Uncommon/Rare/Very Rare/Legendary items, halved for consumables and rounded up. Mundane defaults use gp list price divided by 10, rounded up to at least one day. Scrolls and artifacts require a manual estimate.

Commissions advance with campaign days and do not consume Session hours. Finished work waits for collection at the contractor's Location. This is a time tracker: selecting an item does not purchase, craft, or deliver it automatically.

### Source Item

Requires Marketplace. Select a Common through Legendary magic item from the character's Marketplace wishlist, a Location, and Arcana or Investigation. Commit at least 100 gp and one week. Gold is spent immediately; extra gold and weeks improve the hidden check. Guidance and Help do not apply.

Completion reveals an offer for the requested item or 1d4 Marketplace alternatives of the same or lower rarity. One unassisted Persuasion check can adjust offer prices. The initial investment is not refunded if the search fails; later edits can add investment or weeks but cannot reduce or redirect the committed investment.

### Crafting

Craftworks owns recipes, materials, jobs, checks, and outputs. Ready marked recipes and active jobs appear through the integration; opening them launches Craftworks with the crafter selected. Manage those Projects in Craftworks.

## Campaign days

Use **Advance Day** in GM Operations to advance elapsed activities. Journeys can also supply completed travel days automatically. Day advancement is handled by one active GM with duplicate protection. Avoid manually advancing a day that Journeys will also represent as a separate event.

## Cancel or delete a Project

The GM or owning player can cancel or delete from the dashboard, details, or activity editor. Cancellation stops progress and retains the Project under **Show Completed**. Unused Projects can be deleted immediately; cancel Projects with progress before deleting them. Deletion permanently removes the Project and its history and clears planned Session links, while Session allocation records remain. Neither action refunds time or gold. Crafting Projects remain managed in Craftworks.

Project and Session details show history newest first, with timestamps and readable descriptions of contributions, progress, outcomes, and changes. Linked characters, Projects, time pools, and Locations use their names when available; deleted references are marked unavailable. Existing saved history is displayed this way automatically, without rewriting records.

## Troubleshooting

- **No available hours:** the GM must start a Session that includes the character and permits the activity.
- **Request does not complete:** confirm a GM is connected and Core is enabled.
- **Missing crafting or sourcing options:** check the optional integration and its required version; sourcing also needs an eligible wishlist item.
- **Activity cannot progress:** review the Project's participants, status, Location, and capability requirements.
- **Project disappeared after cancellation:** enable **Show Completed**.

Projects and Sessions are stored in the world. Back up world data before upgrading. Release preparation includes automated checks and live Foundry verification; the manifest's major-version declaration alone is not evidence that a specific build has been tested.
