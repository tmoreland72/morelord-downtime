# Morelord Downtime 0.3.1

Xanathar gold uses Morelord Core's currency service. Source Item offers use Core's item rows. Creating a project from the activity API saves it once. Requires Morelord Core 0.9.2.

## What Changed

### Fixed

- Religious Service, Carousing, Crime, Gambling, Pit Fighting, Relaxation, and Research pay and receive gold through Morelord Core's currency service (`api.currency`). This requires Morelord Core 0.9.2.
- `activities.createProject(activityId, data)` creates one Project. `activityId` is the activity type, such as `gambling` or `training`. A project the activity already saved is not saved again.

### Improvements

- A Source Item result and its Persuasion result list each offer with Morelord Core's shared item rows. Each offer shows its rarity and price. The card keeps its header, the roll, the found-or-not line, the pickup line, and the Persuasion tier. Roll requests stay as they are. A Core build without those rows keeps the previous item list.
