# Morelord Downtime 0.2.1

Crafting time spent in Craftworks is recorded on the active Downtime Session.

## What Changed

### Fixed

- Hours spent crafting in Morelord Craftworks are added to that character's allocated time in the active Downtime Session. Each crafting check counts, including a failed check, and so does a recipe that finishes without a check. Time spent while no Session is active is not applied later, and cancelling a craft does not refund Session time already recorded. Existing saved crafting progress is not charged when this version first loads.

## Verification

Node tests cover the ready baseline, failed-check time, no-check completion, duplicate updates, characters outside the Session, time spent before a Session starts, and Session history text. Live Foundry verification in Dev1 is still outstanding.
