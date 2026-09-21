# History display regression

In a populated development world, run as GM:

```js
const { runHistoryTests } = await import("./modules/morelord-downtime/scripts/testing/history.mjs");
console.log(await runHistoryTests());
```

The Core runner renders real Project and Session detail windows using disposable saved history fixtures. It verifies readable contributions, named references, missing references, nested results, escaped text, loaded Core card styling, 720px/360px widths in both theme classes, and unchanged saved history. Theme classes are changed only on the test windows and restored; saved theme preferences are untouched. Only its own fixtures are deleted in cleanup. No inventories, currency, or existing Projects are changed.

For automated screenshots and a JSON test report, run Core's `tools/verify-history-foundry.mjs` with `MORELORD_PLAYWRIGHT` pointing to an installed Playwright `index.mjs` and `FOUNDRY_TEST_URL` pointing to the development server. Optional `FOUNDRY_TEST_GM` and `FOUNDRY_TEST_PASSWORD` configure the test login.

## Suite display audit — September 18, 2026

Live verification passed on Foundry 14.368 / D&D5e 6.0.3 as GM: four Core smoke checks and the history regression, with no failures or skips. Both windows were captured at 720px and 360px using dark and light application theme classes. Reports and screenshots are under `test/in-game-reports/2026-09-18-history*`. Core's 55 Node tests, Downtime's 48 Node tests, syntax checks, and the suite design-system check passed. This focused check does not establish player-role coverage or overall module compatibility.

The active-module source scan found direct JSON history output in Downtime's Project and Session details. Both now use prose and Core cards. Journeys' outcome details use labeled values; Craftworks' crafting activity log uses written messages. No additional JSON log displays were found in Core, Marketplace, Encounters, Character Export, or Compendium. Serialization used for stored data, exported files, network payloads, cache keys, or developer diagnostics remains appropriate. Campaign Manager is inactive and excluded.
