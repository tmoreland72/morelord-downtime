import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const dispatchMarkers = [
  "documentationWebsiteRepository",
  "Request-DocumentationDeployment",
  "product-docs-updated",
  "morelord-gaming-web",
  "/dispatches",
];

const releaseSources = ["release.ps1", "release.config.json", ".github/workflows/release.yml"];

test("release tooling does not dispatch product documentation updates", () => {
  for (const relativePath of releaseSources) {
    const text = readText(relativePath);
    for (const marker of dispatchMarkers) {
      assert.equal(
        text.includes(marker),
        false,
        `${relativePath} contains '${marker}'. Do not add the documentation repository dispatch.`
      );
    }
  }

  const config = JSON.parse(readText("release.config.json"));
  assert.equal(Object.hasOwn(config, "documentationWebsiteRepository"), false);
});

test("RELEASING.md says not to add the documentation dispatch", () => {
  const guide = readText("RELEASING.md");
  assert.match(guide, /Do not add a documentation dispatch/);
  assert.match(guide, /documentationWebsiteRepository/);
  assert.match(guide, /Request-DocumentationDeployment/);
  assert.match(guide, /product-docs-updated/);
  assert.match(guide, /tmoreland72\/morelord-gaming-web/);
  assert.match(guide, /Do not add a `product-docs-updated` repository dispatch/);
});
