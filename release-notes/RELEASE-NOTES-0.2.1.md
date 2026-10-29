# Morelord Downtime 0.2.1

Crafting time spent in Craftworks is recorded on the active Downtime Session.

## What Changed

### Fixed

- Hours spent crafting in Morelord Craftworks are added to that character's allocated time in the active Downtime Session when **Available Activities** includes **Crafting**. Each crafting check counts, including a failed check, and so does a recipe that finishes without a check. Open crafting time already on the character is included when Downtime first sees it during an active Session. Time spent while no Session is active is not applied later, and cancelling a craft does not refund Session time already recorded. Awarded crafting jobs are not charged to a later Session.
- **Commission** and **Source Item** are included in a Session's **Available Activities** with Training and Crafting. Each day those projects progress spends one 8-hour labor day from the active Session when that activity is enabled and the character is participating. A day progressed while the activity is not enabled is not charged later.
- A crafting check allocates its spent hours to the active Session even when the connected GM is in Core's Ignored Users. A check that finishes while Downtime is still reading the current crafting total is still allocated.
- Open Downtime windows refresh in place for the GM and for players when Craftworks changes a character or when Session time is saved. The refresh does not bring Downtime to the front. This requires Morelord Core 0.9.0.

## Verification

Node tests cover the ready baseline, failed-check time, no-check completion, duplicate updates, characters outside the Session, time spent before a Session starts, and Session history text. Live Foundry verification in Dev1 is still outstanding.
