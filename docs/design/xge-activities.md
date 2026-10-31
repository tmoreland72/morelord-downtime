# Xanathar Downtime Activities

Design only. No activity is implemented by this note. Names and numbers below are our mechanics, written for Downtime. They follow the downtime activities in Xanathar's Guide to Everything. They are not a copy of that text. Rows marked **confirm** need Troy's check against the book before anyone codes a table.

These are separate from Training, Crafting, Commission, Source Item, and **Research Drakkenheim Recipes**.

## Shared activity model

One plugin family. Each activity is a normal Downtime Project with elapsed progress (`requiredDays` / `completedDays`) and its own `activityType`. The sheet stores the player's choices, the gold, the check, the outcome row, and any complication. A second run is a new Project.

### Rolls

Use Core's chat roll request, the same pattern as Source Item. When the days are finished, Downtime posts one card. The owning player clicks **Roll** and uses Foundry's skill dialog. A GM may roll that card when the player is offline. The card does not roll by itself. The total, after the dialog's modifiers, picks one row of that activity's outcome table. There is no hidden house DC unless the activity says so.

### Outcome tables

Each activity has ordered bands on the check total. The first matching band wins. The chat card and the Project result state that band in one or two sentences we write. They do not paste the book. A band can also say "roll a complication."

### Complications

Each activity has a short table of complication ids. The trigger is one of:

- `band`: the outcome row says to roll the table.
- `percent`: after the outcome, roll d100; a result of 1 through N rolls the table. N is per activity.
- `gm`: no automatic roll. The GM can still roll the table from the Project.

The complication die is a second chat request, rolled by the same player, with the same offline-GM fallback. The GM can cancel it, force it, or replace the row. That replacement is stored in history.

The book's trigger is not the same for every activity. **Confirm** the trigger and N for each activity before building its table. Until then, the engine supports all three and the activity record names which one it uses.

### Cost

Each activity has a gp cost, sometimes chosen by the player (a stake, a social class). Gold is taken when the Project starts, through Marketplace when that module is present. If Marketplace is absent, the Project still exists and the GM marks the cost paid. Cancelling does not refund gold. A GM can change the amount before it is paid.

### Duration

Duration is in days, not Session **Hours**. These Projects do not spend the hour pool. The default length is one run of the activity. **Confirm:** the book calls that run a workweek of 5 days. Troy set Carousing to 7 days. This design uses 7 days for every activity here so they match that choice. The GM can change **Days** on a single Project.

### Location and presence

Core locations supply the gate. Downtime does not add a location editor.

- A capability gate uses Core's existing check. **Temple** and **Library** already exist. There is no Tavern, Arena, or Gambling Hall type.
- A presence gate means the character is a participant in the active Session, the Session's location is the Project's location, and the activity is enabled under **Available Activities**.

Presence days are allocated. They do not move when the GM uses **Advance Day**. **Advance Day** still moves Commission, Source Item, and any other elapsed Project that is not in this family. Today's `advanceElapsedDay` moves every active elapsed Project, with no location check. These activities must not use that path.

Allocating a day:

- Adds one `completedDays` on that Project.
- If the Session's **Days** is set, also adds one `daysUsed`, and refuses when `daysUsed` has reached **Days**.
- If **Days** is blank, presence is still required, and there is no numeric day cap. That matches hour work.

The player or the GM can allocate. The GM can allocate for a character whose player is offline. Several characters can take the same day. One allocated day on one Project spends one session day only when **Days** is set.

### GM overrides

Only a GM can change required days, cost, the location gate, or the outcome. A GM can waive presence for one allocation; history records the waiver. A GM can set the result to a chosen band instead of the roll. Players cannot do any of that. The server rejects the change, and the field is not editable for them.

## Per activity

Social class means wealth and station, not a character class. The sheet has no social class, so Upper class carousing needs a GM confirmation rather than a derived check.

### Religious Service

- Location: the Project's location must have a **Temple** capability. No temple, no Project.
- Presence: allocate days in a Session at that location. **Confirm** if Troy would rather let **Advance Day** run this one with only the temple gate.
- Time: 7 days. Cost: none, unless the GM sets one.
- Check: the player chooses Religion or Persuasion. **Confirm** that Persuasion is intended. The usual reading of the book is Religion alone.
- Outcomes, **confirm** the bands: low totals earn no favor; middle totals earn a small favor or a low-level temple spell at the normal price; high totals earn a larger favor. The card names the band. It does not cast a spell.
- Complications: scandal, a demand for a quest, or trouble with a rival faith. Trigger **confirm**.

### Carousing

- The player names the NPCs as text and picks lower, middle, or upper class.
- Cost for the run: 10 gp lower, 50 gp middle, 250 gp upper.
- Upper class: the book limits this to someone of that standing, or someone a contact introduces. The player can select it only after the GM confirms that. The module does not infer standing from background.
- Time: 7 days. Check: Persuasion.
- Location: the player assigns one. No capability. Presence is required. Days allocate only in an active Session at that location.
- Outcomes, **confirm** the edges: totals 1–5 produce a hostile contact; 6–10 produce no useful contact; 11–15 one friendly contact; 16–20 two; 21 or higher three. The named NPCs are recorded with the result. Downtime does not create actor records.
- Complications: a fight, a debt, a rumor, or a rival. Trigger **confirm**.

### Crime

- The player describes the job in a short text field and picks the approach: Stealth, Thieves' Tools, Deception, or Investigation. **Confirm** the book's allowed skills.
- Time: 7 days. Cost: none to start. The result pays gp.
- Location: an assigned location, no capability. Not **On the Road**. Presence required.
- Outcomes, **confirm** gp: a low total pays about 50 gp and forces a complication; middle totals pay a few hundred gp; a high total pays about 1,000 gp. The card states the amount. It does not move coins until Marketplace can pay the character, or the GM marks it paid.
- Complications: arrest, a fine, or an enemy. An arrest is a note for the GM, not a scripted imprisonment. Trigger **confirm**.

### Gambling

- The player sets a stake in gp and picks Insight, Deception, or Sleight of Hand. Deception and Sleight of Hand are cheating.
- Time: 7 days. The stake is the cost, paid at the start.
- Location: assigned, no capability. Not **On the Road**. Presence required.
- Outcomes, **confirm** multipliers: a low total loses the stake; a middle total breaks even or wins the stake back once; a high total wins two or three times the stake. Cheating uses the same bands and a higher complication chance.
- Complications: accused of cheating, a debt, or a sore loser. Trigger **confirm**, including the higher chance for cheating.

### Pit Fighting

- Check: Athletics or Acrobatics, player's choice. **Confirm** whether a weapon attack is allowed. This design does not use one. The skill dialog stays the one roll.
- Time: 7 days. Cost: none, unless the GM sets a purse fee. The result can pay a purse.
- Location: assigned. Core has no pit or arena capability. **Confirm:** no capability in the first build, or add one in Core later. Presence required.
- Outcomes, **confirm** purses: a loss, a small purse, a large purse, or a reputation the GM can use later. No automatic injury beyond the complication table.
- Complications: injury, a grudge, or a demand for a rematch. An injury is a note, not an automatic Exhaustion level, unless Troy wants that. Trigger **confirm**.

### Relaxation

- Time: 7 days. Cost: **confirm**. A reasonable default is the character's lifestyle for the week, entered as gp by the player, with the GM able to change it.
- Check: none. No roll request.
- Location: assigned, no capability. Presence: **confirm**. This design requires it, so rest is not free progress on **Advance Day**.
- Outcome: the GM names one lingering effect a long rest does not remove, and clears it or not. Downtime records the decision. It does not edit the actor. **Confirm** the list. A 2024 long rest already reduces Exhaustion by 1, so this activity should not remove another Exhaustion level unless Troy wants that.
- Complications: rare, `gm` trigger unless the book says otherwise. **Confirm**.

### Research

Display name **Research**. Id `lore-research`, so it does not collide with `research-drakkenheim-recipes`.

- The player writes the question.
- Location: must have a **Library** capability. A sage with no library is a GM waiver.
- Time: 7 days. Cost: **confirm**. Do not lock a number until the book row is checked. A placeholder of 50 gp for the week is only a guess.
- Check: the player picks History, Arcana, Religion, or Investigation, whichever fits the question. **Confirm** the list.
- Presence: required in this design. **Confirm** if research should instead finish on **Advance Day** while the library gate stays.
- Outcomes, **confirm** bands: no lead, a partial lead, a useful fact, or a clear answer. The card states which. It does not write lore into a journal by itself.
- Complications: a false lead, a damaged book, or unwanted attention. Trigger **confirm**.

## Fit with Projects, Sessions, and Days

- Register each activity the way Training and Source Item are registered. Creation is a Project editor. The activity appears in **New Project** and in **Available Activities**.
- Progress mode is elapsed. `requiredDays` starts at 7. Completion posts the roll request from `onComplete`, except Relaxation, which completes into a GM decision with no card.
- Do not call the current `advanceElapsedDay` for these types. Add an allocation that checks participant, Session location, **Available Activities**, and the **Days** cap.
- Session **Hours** stay the pool for Training, Crafting, and logged sourcing. These activities never change `plannedDurationHours` or allocated hours.
- Session **Days** stay optional. When set, each allocated presence day spends one. When blank, presence still gates the work and the count does not cap it.
- One active Session remains the rule. A Project at Waterdeep does not advance during a Session in Neverwinter.
- Stored keys: `carousing`, `religious-service`, `crime`, `gambling`, `pit-fighting`, `relaxation`, `lore-research`.

## Phased build

1. Shared family only: day allocation with the presence and **Days** gates, one chat roll request, band lookup, complication trigger, cost record, GM overrides. No menu entries until the tests pass.
2. Carousing and Religious Service. Those two cover presence, social class, NPC text, and the Temple gate.
3. Crime, Gambling, and Pit Fighting. Those add payouts, stakes, and cheating.
4. Relaxation and Research. Those add the no-roll case and the Library gate.
5. Player guide, then a Dev1 pass. Complication sentences are written in that phase, after the triggers are confirmed.

## Test plan

Node tests, no Foundry, for the rules. A later Dev1 pass checks the windows.

- A presence day applies only when the Session is active, the owner is a participant, the locations match, and the activity is enabled. Otherwise the Project day does not move.
- When **Days** is 2, the third allocation is refused and `completedDays` stays 2. When **Days** is blank, a third day still applies.
- **Advance Day** still moves a Commission and does not move a Carousing Project.
- A Temple is required for Religious Service. A Library is required for Research. A location without that capability is rejected. A GM waiver is stored.
- Upper class Carousing is rejected until the GM confirms it. Lower and middle are not.
- The roll request uses the Core card. The player's dialog total selects the band. A cancelled dialog does not resolve the Project. A second resolution does not roll again.
- A `percent` trigger of 10 rolls a complication only on d100 results 1–10. A `band` trigger rolls only on the marked rows. A `gm` trigger never rolls until the GM asks.
- A player request that changes days, cost, or the outcome is rejected. The same change from the GM is stored.
- Gold is recorded at the start. Cancel does not refund it. A Gambling stake of 0 is rejected.
- `lore-research` does not replace **Research Drakkenheim Recipes**.

## Open questions

1. Are the other six activities 7 days, or the book's 5-day workweek?
2. Is Persuasion an allowed Religious Service check, or Religion only?
3. Which activities use presence allocation, and which should move on **Advance Day**?
4. What is the complication trigger, and the chance, for each activity?
5. Confirm outcome bands and gp amounts for Crime, Gambling, Pit Fighting, and Research.
6. Should Pit Fighting, Gambling, or Carousing wait for a new Core capability?
7. Should Relaxation remove an extra Exhaustion level under the 2024 rest rules?
8. Should payouts move coins through Marketplace, or only record an amount the GM pays?
