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

- ALL Foundry UI in every Morelord module MUST use Core's shared components, styles, tokens, and UI functions. This applies to new and existing windows, dialogs, forms, cards, lists, chat output, and sheet integrations, including prototypes and unreleased modules.
- Before UI work, read Morelord Core's `MORELORD-BRAND-GUIDE.md` (in Core's repository, or `../morelord-core/MORELORD-BRAND-GUIDE.md` from sibling module repositories).
- Use the appropriate Core component with its required markup, classes, and behavior. Adding `ml-*` classes or Core tokens to independently designed markup is not sufficient. Core is the source of truth; another module is only an example of consuming it, not a design system to copy.
- Do not recreate, override, or patch shared UI in a feature module. If Core lacks a needed shared component or its component does not work correctly, add or fix it in Core, preserve existing consumers, and have the feature module consume that implementation.
- Module-specific UI code may implement domain-specific layout and behavior only. Shared typography, surfaces, controls, spacing, states, and window behavior remain owned by Core. Ensure Core's assets and required UI initialization are actually loaded; do not compensate for missing integration with local styling.
- Verify the rendered UI with Foundry and Core styles loaded, including relevant interactions and responsive behavior. Passing a class-name or design-system scan alone does not establish compliance. Report any live Foundry verification still outstanding.

## Player roll requests

- Every workflow that requests player rolls must let the GM roll for characters whose players are not logged in, including when a player disconnects with a request pending. Reuse Core's user/recipient routing, preserve the roll's visibility rules, and prevent duplicate resolution.

## Compatibility and existing world data

- Read each affected module's `module.json` before changing APIs or dependencies. Preserve its declared Foundry and game-system support, and distinguish required dependencies from optional integrations.
- Keep stored keys and identifiers stable. Handle necessary data migrations explicitly, and never delete campaign data because premium access expires.

## Verification

- Every in-game bug fix must include a repeatable in-game regression test that reproduces the bug and verifies the corrected behavior. Follow Core's `IN-GAME-TESTING.md`, reuse its shared runner, and keep module-specific tests in the owning module. Run the test in Foundry and report the result or any verification blocker.
- When changing Core, identify and check the modules that consume the changed functionality.
- Run relevant existing tests and, for shared UI changes, Core's `npm run check:design-system`. Clearly report anything that still needs live Foundry verification.

## Releases and documentation

- Campaign Manager is inactive. Exclude it from active-module inventories, release checks, and development planning unless the user explicitly revives it.

- Follow the affected repository's documented `release.ps1` workflow, `release.config.json`, and release-note conventions when preparing or publishing a requested release.
- For every release, check the latest stable Foundry VTT version against official release information and verify module compatibility on that version. Update `module.json`'s `compatibility.verified` to the exact verified version/build before packaging, and publish matching compatibility metadata to the Foundry package release. Preserve supported minimum/maximum bounds unless intentionally changing support; do not claim untested compatibility. After publishing, verify the public manifest and Foundry release listing both reflect the updated compatibility, so stale metadata does not leave users with a compatibility-risk warning. Report any verification or publication blocker explicitly.
- Character Export and Downtime follow the standard release requirements; all modules must follow shared UI and Core asset standards.
- As part of every code change, review affected documentation and update it when behavior, UI, settings, APIs, dependencies, or workflows change. Include relevant READMEs, user guides, API examples, and release notes; update shared documentation in Core when applicable.
- Keep public documentation aligned with actual implemented behavior and compatibility. Documentation review is part of completing the change, not something deferred until release.
- In the completion summary, identify documentation updated or state why no update was needed.

## Demo videos

- Before planning, scripting, recording, editing, or exporting any Morelord demo video, read and follow Core's `DEMO-RECORDING-GUIDE.md`. Resolve it from the Core repository in the workspace (normally `../morelord-core`; in this installation, `E:/Foundry14Dev-Data/Data/modules/morelord-core` also serves Compendium in the separate DND data tree).
- Save reusable demo instructions and corrections from the user in that guide; keep video-specific requirements in the video's brief. Check the finished video against those requirements before delivery.

## Maintaining these guidelines

- Treat `morelord-core/AGENTS.md` as the canonical shared standard.
- When updating shared guidelines, update Core's file first and copy it to the other Morelord repositories: Character Export, Compendium, Craftworks, Downtime, Encounters, Journeys, and Marketplace.
- Keep this file concise and reference existing documentation for details.
