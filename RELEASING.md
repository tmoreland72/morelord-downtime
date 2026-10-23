# Releasing Morelord Downtime

Downtime follows Morelord Core's shared `release.ps1` workflow. Module-specific settings live in `release.config.json`. PowerShell 7, Git, and an authenticated GitHub CLI are required for publication.

The script loads `RELEASE_PUBLISH_TOKEN` and the package-specific `FOUNDRY_RELEASE_TOKEN` from the ignored local `.env`. See `.env.example` for the expected keys. Never commit tokens.

## Before release

1. Check Foundry package registration status. GitHub and website releases can be published while approval is pending. If Foundry has not enabled release publication, use `-SkipFoundryPublish`, record the pending listing, and publish matching package metadata when available.
2. Check the latest stable build against [official Foundry releases](https://foundryvtt.com/releases/), test Downtime on that build, and set `module.json`'s `compatibility.verified` to the exact tested version/build. Preserve supported minimum and maximum bounds; do not claim untested compatibility.
3. Run `npm test`, `npm run check`, and Core's `npm run check:design-system`. Verify the rendered dashboard, GM/player Session lifecycle, activities, and optional integrations in Foundry with Core loaded.
4. Update `docs/README.md`, its version frontmatter, in-app help, and `release-notes/RELEASE-NOTES-<version>.md`. Notes require `## What Changed` and bullet lists under recognized subsections such as `### Added`, `### Improvements`, and `### Fixed`. Use `[Premium]` or `[Champion]` only for tier-specific changes. Those per-version files are excluded from release archives.
5. Review and commit the intended changes on `main`. The script requires a clean working tree and the configured GitHub origin. Do not hand-edit the cumulative root `CHANGELOG.md`; `release.ps1` rebuilds it from `release-notes/RELEASE-NOTES-*.md`.

## Run the workflow

Use the intended version in both commands:

```powershell
.\release.ps1 -Version 0.1.0 -DryRun
.\release.ps1 -Version 0.1.0
```

A normal release validates documentation and notes, rebuilds the cumulative root `CHANGELOG.md`, builds and verifies the ZIP, updates the manifest, commits and tags, pushes to GitHub, creates the GitHub Release, and publishes Foundry compatibility metadata and the Morelord website release entry. Dry runs do not publish or validate remote tokens. Drafts and prereleases skip Foundry and website publication.

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
