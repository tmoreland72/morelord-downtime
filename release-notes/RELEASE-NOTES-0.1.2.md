# Morelord Downtime 0.1.2

## What Changed

### Improvements

- Documentation opens the combined GM and player guide through Core.
- Added a manifest changelog link and moved release history into `release-notes/`. Local working files belong in ignored `/tmp/`.

- Release staging and generated ZIP files use module-local `/tmp/`; ZIP validation rejects working files and release-note sources.

## Verification

Verified with Foundry VTT 14.368 and D&D5e 6.0.3 in Dev1. All 48 module automated tests passed; Core's design-system check passed. GM/player Core checks verified initialization, recipient routing and website documentation links. Marketplace's native inventory, party, container, read-only preview and layout checks passed; Shop Manager was visually reviewed in both themes at 1280px and 700px viewports. A player-only run skips the GM settings window, which passed on the GM client. Full 200% zoom and every consumer workflow are not claimed.
