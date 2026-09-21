# Morelord Downtime 0.1.1

Updates to shared reporting and downtime workflows.

## What Changed

### Improvements

- [Premium] Project and Session history now display readable progress, outcomes, changed fields, and referenced names instead of JSON. Existing saved records are formatted when viewed and remain unchanged.
- [Premium] Research requires an enabled, accessible Drakkenheim pack, matches the Recipes browser's family/rarity filters, and marks discoveries known to every player character. Completion stays in Downtime; clicking a result opens Recipes rather than Craft. New Project uses equal-width card columns; Session activity labels wrap without overlap through Core's shared checkbox grid.
- [Premium] Added optional feature/error instrumentation through Core's shared reporting service. Fresh GM consent is required; account connection is not. Existing Core dependencies and game behavior are unchanged.
- [Premium] Added Research Drakkenheim Recipes: a one-hour Project using a monster component from personal or party inventory, saving up to five random matching recipes without consuming the component. Requires the updated optional Craftworks integration.

## Compatibility and verification

Verified release workflows on Foundry VTT 14.368 with D&D5e 6.0.3 in a disposable test world. Supported minimum/maximum bounds are unchanged. Existing Node tests and the shared Core design-system check passed; in-game evidence is retained in the repositories.
