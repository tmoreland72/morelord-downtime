# Morelord Downtime 0.2.2

Crafting projects stay on the Downtime list at the scene being viewed. Source Item time is logged on the Session. Only a GM can change a Session.

## What Changed

### Fixed

- Crafting projects stay in Downtime when the viewed scene can support the recipe. An active Session that is On the Road, or that has no Location, does not hide recipes Neverwinter can still support. Work already underway stays listed and shows as paused when neither place allows it. One recipe whose location check cannot be read no longer removes the rest of the crafting list.
- **Commission** is no longer an **Available Activities** choice. **Source Item** remains, checked per Session. **Advance Day** spends 8 hours of that character's Session time for each day a Source Item Project progresses, when the Session includes the character and **Source Item**. A day advanced while **Source Item** is not enabled is not charged later. Commission days do not spend Session hours.
- **Session History** lists each participant's spent time: who spent how many hours or days, on which Project or activity, and when. Training includes the student and the instructor. Crafting time and Source Item days are included.
- **New Project** has a question mark that explains each project type: what it does, the time, the cost, the checks, where and when it advances, and the outcome.
- Seven Xanathar downtime activities are available: **Religious Service**, **Carousing**, **Crime**, **Gambling**, **Pit Fighting**, **Relaxation**, and **Research**. Each takes 7 days. Religious Service needs a Temple. Research needs a Library. Research and Relaxation advance without a Session. The others advance only in an active Session at the Project's location. Costs and winnings use the character's currency. Relaxation removes every Exhaustion level.
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
