# Morelord Development Guidelines

## Shared assets in Morelord Core

- During every Morelord coding task, actively look for opportunities to reuse or create shared assets in Morelord Core, including UI components, CSS, design tokens, templates, functions, utilities, and services.
- Before adding module-specific code or styles, inspect Morelord Core for an existing asset that can be reused or extended.
- When functionality or styling is useful across multiple Morelord modules, place the shared implementation in Morelord Core and have the modules consume it instead of duplicating it.
- When touching duplicated code or styles, consider consolidating them in Morelord Core as part of the relevant change.
- Keep shared assets simple and focused on demonstrated needs. Keep behavior specific to one module in that module unless there is a clear shared use case.
- Preserve compatibility for existing consumers when changing shared assets, and check the affected modules.
- In the completion summary, briefly identify shared assets reused, extended, or introduced when relevant.

## Brand and interface consistency

- Before UI work, read Morelord Core's `MORELORD-BRAND-GUIDE.md` (in Core's repository, or `../morelord-core/MORELORD-BRAND-GUIDE.md` from sibling module repositories).
- Use Core's theme-aware tokens and shared controls, spacing, typography, and window styles. Keep Morelord interfaces visually and behaviorally consistent.

## Compatibility and existing world data

- Read each affected module's `module.json` before changing APIs or dependencies. Preserve its declared Foundry and game-system support, and distinguish required dependencies from optional integrations.
- Keep stored keys and identifiers stable. Handle necessary data migrations explicitly, and never delete campaign data because premium access expires.

## Verification

- When changing Core, identify and check the modules that consume the changed functionality.
- Run relevant existing tests and, for shared UI changes, Core's `npm run check:design-system`. Clearly report anything that still needs live Foundry verification.

## Releases and documentation

- Follow the affected repository's documented `release.ps1` workflow, `release.config.json`, and release-note conventions when preparing or publishing a requested release.
- Character Export and Downtime are not production-ready and are currently excluded from standard release requirements. Both must still follow all shared UI and Core asset standards.
- As part of every code change, review affected documentation and update it when behavior, UI, settings, APIs, dependencies, or workflows change. Include relevant READMEs, user guides, API examples, and release notes; update shared documentation in Core when applicable.
- Keep public documentation aligned with actual implemented behavior and compatibility. Documentation review is part of completing the change, not something deferred until release.
- In the completion summary, identify documentation updated or state why no update was needed.

## Maintaining these guidelines

- Treat `morelord-core/AGENTS.md` as the canonical shared standard.
- When updating shared guidelines, update Core's file first and copy it to the other Morelord repositories: Character Export, Craftworks, Downtime, Encounters, Journeys, and Marketplace.
- Keep this file concise and reference existing documentation for details.
