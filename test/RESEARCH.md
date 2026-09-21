# Recipe research in Foundry

Reload the GM client after updating Downtime and Craftworks. A participant character must have a monster component, personally or in a member party Group, with at least one matching enabled Drakkenheim recipe.

```js
const { runResearchTests } = await import("./modules/morelord-downtime/scripts/testing/research.mjs");
console.log(await runResearchTests({ componentName: "Organ (Very Rare)" }));
const { runProjectChoiceTests } = await import("./modules/morelord-downtime/scripts/testing/project-choices.mjs");
console.log(await runProjectChoiceTests());
```

Uses Core's runner, actual inventory/catalog APIs and templates. Omit `componentName` to use any available component. Creates only a temporary Project and standalone time pool and removes both in `finally`. Restores any recipe visibility changed by the test. Never changes inventory or existing Sessions. Checks partial and complete allocation, distinct matching results, global recipe knowledge, saved results, unchanged inventory, rejection of repeat allocation, and navigation to the Recipes browser. Project-choice checks cover pack availability, five equal-width cards, usable window height, wrapping activity labels and checkbox clicks.

Also verify from a separate player client: create for an owned character, change researchers, select personal and party components, allocate an hour in a permitted active Session, and reopen the results. Check keyboard focus, both themes, 200% zoom, empty inventory, no recipe matches, and unavailable Craftworks. Do not reset prepared demo worlds.

## September 18, 2026 verification

Foundry 14.368 / D&D5e 6.0.3, Dev1 GM: all six research checks passed, including the real Organ (Very Rare) workflow, global recipe knowledge, and opening the discovered recipe in Recipes. All five project-choice checks passed. Cards, wrapping activity controls, and populated Recipes results were visually inspected with Core styles loaded. Reports: `test/in-game-reports/2026-09-18-research-fixes.json` and `2026-09-18-organ-research.json`. Separate player socket delivery, alternate themes and 200% zoom remain unverified.

Automated checks passed: Downtime, Craftworks and Core tests, syntax checks, and Core's design-system check. The shared browser/research matcher test verifies all four Very Rare Organ recipes: Crimson Blade, Inexhaustible Armor, Potion of Supreme Healing, and Rejuvenation Potion.
