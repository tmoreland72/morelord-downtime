# Morelord Downtime 0.2.2

Crafting projects stay on the Downtime list at the scene being viewed. Source Item time is logged on the Session. Only a GM can change a Session.

## What Changed

### Fixed

- Crafting projects stay in Downtime when the viewed scene can support the recipe. An active Session that is On the Road, or that has no Location, does not hide recipes Neverwinter can still support. Work already underway stays listed and shows as paused when neither place allows it. One recipe whose location check cannot be read no longer removes the rest of the crafting list.
- **Commission** is no longer an **Available Activities** choice. **Source Item** remains, checked per Session. A GM logs hours spent sourcing an item from Session details or from the Source Item Project. Those hours are added to that character's allocated Session time. Advancing a campaign day does not itself spend Session hours for sourcing or commissions.
- Only a GM can create, edit, or delete a Downtime Session. Players see Sessions read-only. Saving a Session is rejected for a player.
- An NPC instructor can teach only subjects the Location's **Instructor** specialty allows. **Any** or a blank specialty allows every subject. Neverwinter limited to **Common Sign Language** offers only that language. The check uses Core's `locationAllowsSpecialty` when Morelord Core 0.9.0 provides it.
- Instructor specialty may be several keys. An empty list allows every subject. A specialty saved as a single value is still that one key. NPC and provider checks both use `locationAllowsSpecialty`.
- **Select Training** follows Configure Sources. The list is the skills, languages, tools, weapons, armor, and weapon masteries enabled for the world, including Xanathar's Guide to Everything and Tasha's Cauldron of Everything when those sources are enabled. An NPC instructor can still teach only subjects the Location's **Instructor** specialty allows.
