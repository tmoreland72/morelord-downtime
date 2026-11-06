# Releasing Morelord Downtime

Dispatch the **Release** workflow from the `main` branch after `.github/workflows/release.yml` is on `main`. The workflow runs on `ubuntu-latest` with PowerShell and calls `release.ps1`. It does not run in-Foundry tests. Module-specific settings live in `release.config.json`.

## Secrets

Add both secrets under **Settings > Secrets and variables > Actions** before the first dispatch:

| Secret | Used for |
| --- | --- |
| `RELEASE_PUBLISH_TOKEN` | `morelordgaming.com` release feed |
| `FOUNDRY_RELEASE_TOKEN` | Foundry VTT package listing |

The workflow passes those values only as environment variables on the publish step. It does not write a `.env` file and it does not print the values. The job stops with a clear error when either secret is empty. Never commit tokens. Local runs can still load the same keys from the ignored `.env`. See `.env.example`.

`GITHUB_TOKEN` is provided by Actions. The workflow sets `GH_TOKEN` from it so `release.ps1` can commit, tag, push, and create the GitHub Release. The workflow grants `contents: write` and commits as `github-actions[bot]`. Branch protection on `main` must allow that bot to push commits and tags. Sibling checkouts of public `tmoreland72/morelord-core` and `tmoreland72/morelord-craftworks` use that same token. No personal access token is stored in the workflow.

## Inputs

| Input | Default | Effect |
| --- | --- | --- |
| `bump` | `patch` | Used only when `version` is empty and `publish_only` is false |
| `version` | empty | Explicit `x.y.z`. When set, `bump` is ignored |
| `publish_only` | false | Skip the version bump, tag, and GitHub Release. Publish that version to the website and then to Foundry |

`tools/resolve-release-version.ps1` reads the version from `module.json`. With `module.json` at `0.3.0` and no explicit version, the bumps are:

| `bump` | Next version |
| --- | --- |
| `patch` | `0.3.1` |
| `minor` | `0.4.0` |
| `major` | `1.0.0` |

Leave `module.json` `version` at the last published release until this workflow runs. A patch dispatch from `0.3.0` resolves `0.3.1`. `release.ps1` then sets `module.json` to that version, rebuilds root `CHANGELOG.md` from `release-notes/RELEASE-NOTES-*.md`, and commits those two files. The workflow also requires `release-notes/RELEASE-NOTES-<version>.md` for the resolved version before it calls `release.ps1`.

`publish_only` without `version` uses the version already in `module.json`. It does not increment it. `publish_only` with `version` publishes that exact version. `module.json` on `main` must already equal that version, and the `v` tag must already exist on `origin`. `-WebsiteOnly` and `-FoundryOnly` are separate script runs. They do not commit, tag, or create a GitHub Release. Website publication still requests the website repository's existing `product-docs-updated` event. The Actions workflow does not add another documentation dispatch.

A normal release still needs `release-notes/RELEASE-NOTES-<version>.md` and `docs/README.md` frontmatter for that version before the dispatch. For 0.3.1, the guide frontmatter is already `version: 0.3.1` while `module.json` stays `0.3.0` until the workflow bumps it.

## Morelord Core, Craftworks, and tests

When `publish_only` is false, the workflow checks out the public default branches of `tmoreland72/morelord-core` and `tmoreland72/morelord-craftworks` and moves them beside this repository so `npm test` can import them.

Downtime's Xanathar currency code imports `morelord-core/scripts/services/currency-service.js`. The Source Item chat-card test imports `morelord-core/scripts/ui/item-card.js`. Those files are on Core's default branch and are not in Core `v0.9.1`. Treat that default branch as planned Core 0.9.2. Research tests import `morelord-craftworks/scripts/crafting/crafting-material-service.mjs` and `morelord-craftworks/scripts/crafting/group-membership.mjs`.

`publish_only` skips both checkouts and skips `npm test`.

## Before release

1. Check Foundry package registration status. GitHub and website releases can be published while approval is pending. If Foundry has not enabled release publication, use `-SkipFoundryPublish`, record the pending listing, and publish matching package metadata when available.
2. Check the latest stable build against [official Foundry releases](https://foundryvtt.com/releases/), test Downtime on that build, and set `module.json`'s `compatibility.verified` to the exact tested version/build. Preserve supported minimum and maximum bounds; do not claim untested compatibility.
3. Run `npm test`, `npm run check`, and Core's `npm run check:design-system`. Verify the rendered dashboard, GM/player Session lifecycle, activities, and optional integrations in Foundry with Core loaded.
4. Update `docs/README.md`, its version frontmatter, in-app help, and `release-notes/RELEASE-NOTES-<version>.md`. Notes require `## What Changed` and bullet lists under recognized subsections such as `### Added`, `### Improvements`, and `### Fixed`. Use `[Premium]` or `[Champion]` only for tier-specific changes. Those per-version files are excluded from release archives.
5. Review and commit the intended changes on `main`. The script requires a clean working tree and the configured GitHub origin. Do not hand-edit the cumulative root `CHANGELOG.md`; `release.ps1` rebuilds it from `release-notes/RELEASE-NOTES-*.md`.

## Run the workflow

Dispatch **Release** from `main` with an empty version and bump `patch` to publish the next patch, or pass an explicit `x.y.z`. Do not dispatch until Morelord Core 0.9.2 is published. Downtime 0.3.1 requires that Core minimum, and Core's released tags stop at 0.9.1.

`release.ps1` is what the workflow runs. A local dry run uses the same script and does not publish:

```powershell
.\release.ps1 -Version 0.3.1 -DryRun
```

A normal release validates documentation and notes, rebuilds the cumulative root `CHANGELOG.md`, builds and verifies the ZIP, updates the manifest, commits and tags, pushes to GitHub, creates the GitHub Release, and publishes Foundry compatibility metadata and the Morelord website release entry. Dry runs do not publish or validate remote tokens. Drafts and prereleases skip Foundry and website publication. Website publication still requests the website repository's `product-docs-updated` event from `release.ps1`. The Actions workflow does not add a separate documentation dispatch.

`CHANGELOG.md` is generated from `release-notes/RELEASE-NOTES-*.md` in descending semantic version order (newest version first). Each version keeps the user-facing sections under `## What Changed` (`### Added`, `### Improvements`, `### Fixed`, and their `- ` bullets) and omits `## Verification`, other internal test sections, and `---` horizontal rules. Headings always have a space after `#`. The script writes the file only when the generated text differs, stages it with `module.json` (`git add -- module.json CHANGELOG.md`), and `release.config.json` lists it in `requiredPaths` so the release `.zip` contains it at the archive root. In-Foundry changelog viewers such as Big Bad Module Manager read that packaged file.

Check the changelog without publishing:

```powershell
.\release.ps1 -ValidateOnly
.\release.ps1 -Version 0.1.2 -ValidateOnly
```

`-ValidateOnly` leaves the Git working tree clean when `CHANGELOG.md` is already up to date. With `-Version`, it also builds and verifies the release ZIP locally.

The user guide ships with the module and is version-checked. The docs directory is included; credentials, tests, and release tooling are excluded from the ZIP. Per-version notes under `release-notes/` stay out of the archive. Maintain the guide alongside the in-app help registered with Core. Website publication requests the website's `product-docs-updated` deployment workflow, which imports `docs/README.md` and lists the guide at `/docs/morelord-downtime`.

## Verify and recover

After publication, check the public manifest, downloadable ZIP, Foundry package release listing, and website release entry. Confirm the public manifest and Foundry listing both show the exact tested compatibility build.

If only website publication failed, retry with `-WebsiteOnly` and the same version. Inspect partial GitHub or Foundry publication before retrying; `-SkipWebsitePublish` and `-SkipFoundryPublish` are exceptional recovery options, not the regular release path.
