import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function readLines(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function semanticSortKey(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) throw new Error(`Release notes version '${version}' is not semantic versioning.`);
  const pad = (value) => String(Number(value)).padStart(8, "0");
  const pre = match[4] ?? "";
  const preKey = pre
    ? pre.split(".").map((part) => (/^\d+$/.test(part) ? `0${part.padStart(8, "0")}` : `1${part}`)).join(".")
    : "";
  return `${pad(match[1])}.${pad(match[2])}.${pad(match[3])}.${pre ? "0" : "1"}.${preKey}`;
}

function whatChangedLines(text) {
  let collecting = false;
  let found = false;
  const body = [];
  for (const line of readLines(text)) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      if (collecting) break;
      if (/^##\s+What Changed\s*$/.test(trimmed)) {
        collecting = true;
        found = true;
      }
      continue;
    }
    if (!collecting) continue;
    if (/^([-*_])\1{2,}$/.test(trimmed)) continue;
    const heading = /^(#{1,6})\s*(.*?)\s*$/.exec(trimmed);
    if (heading) {
      const headingText = heading[2].trim();
      if (headingText) body.push(`${heading[1]} ${headingText}`);
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      body.push(`- ${bullet[1].trimEnd()}`);
      continue;
    }
    body.push(line.trimEnd());
  }
  if (!found) throw new Error("Release notes must include '## What Changed'.");
  while (body.length > 0 && body[0].trim() === "") body.shift();
  while (body.length > 0 && body.at(-1).trim() === "") body.pop();
  if (body.length === 0) throw new Error("Release notes include '## What Changed' but no user-facing entries.");
  return body;
}

function buildChangelog() {
  const title = JSON.parse(readText("module.json")).title;
  const notesDir = path.join(root, "release-notes");
  const entries = readdirSync(notesDir)
    .filter((name) => /^RELEASE-NOTES-.+\.md$/.test(name))
    .map((name) => {
      const version = /^RELEASE-NOTES-(.+)\.md$/.exec(name)[1];
      return { version, sortKey: semanticSortKey(version), lines: whatChangedLines(readText(path.join("release-notes", name))) };
    })
    .sort((left, right) => (left.sortKey < right.sortKey ? 1 : left.sortKey > right.sortKey ? -1 : 0));
  const lines = [`# ${title} Changelog`];
  for (const entry of entries) lines.push("", `## ${entry.version}`, "", ...entry.lines);
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

test("semantic versions sort newest first", () => {
  const versions = ["0.1.0", "1.0.0-beta.2", "1.0.0", "1.0.0-beta.10", "0.9.0", "1.0.0-alpha"];
  const sorted = versions.sort((left, right) => (semanticSortKey(left) < semanticSortKey(right) ? 1 : -1));
  assert.deepEqual(sorted, ["1.0.0", "1.0.0-beta.10", "1.0.0-beta.2", "1.0.0-alpha", "0.9.0", "0.1.0"]);
});

test("CHANGELOG.md is the packaged cumulative release history", () => {
  const changelog = readText("CHANGELOG.md");
  const expected = buildChangelog();
  assert.equal(changelog, expected);
  assert.equal(changelog.startsWith("# Morelord Downtime Changelog\n"), true);
  assert.equal(changelog.includes("\r"), false);
  assert.equal(changelog.endsWith("\n"), true);
  assert.equal(changelog.endsWith("\n\n"), false);
  assert.equal(/^---+$/m.test(changelog), false);
  assert.equal(/^##\s+What Changed\s*$/m.test(changelog), false);
  assert.equal(/^##\s+Verification\b/m.test(changelog), false);
  assert.equal(changelog.includes("Full 200% zoom and every consumer workflow are not claimed."), false);
  assert.equal(changelog.includes("Verified release workflows on Foundry VTT 14.368"), false);
  assert.equal(changelog.includes("Requires Morelord Core 0.3.9 or newer."), false);

  const versions = [...changelog.matchAll(/^## (\S+)$/gm)].map((match) => match[1]);
  assert.deepEqual(versions, ["0.1.2", "0.1.1", "0.1.0"]);
  for (const line of changelog.split("\n")) {
    if (line.startsWith("#")) assert.match(line, /^#{1,3} \S/);
    if (line.startsWith("-") || line.startsWith("*") || line.startsWith("+")) assert.match(line, /^- \S/);
  }

  const config = JSON.parse(readText("release.config.json"));
  assert.equal(config.requiredPaths.includes("CHANGELOG.md"), true);
  const releaseScript = readText("release.ps1");
  assert.match(releaseScript, /function Update-Changelog/);
  assert.match(releaseScript, /git add -- module\.json CHANGELOG\.md/);
  assert.match(releaseScript, /\[switch\]\$ValidateOnly/);
});
