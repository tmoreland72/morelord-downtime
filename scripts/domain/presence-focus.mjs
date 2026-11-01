import { appendHistory } from "./project.mjs";
import { xgePolicy } from "../activities/xge/xge-rules.mjs";

const OPEN = new Set(["active", "paused", "waiting"]);

/** A day-based project the character must be present to advance. */
export function isPresenceProject(project) {
  return xgePolicy(project?.activityType) === "present"
    && ["elapsed", "hybrid"].includes(project?.progress?.mode)
    && OPEN.has(project?.status);
}

function lastAdvancedAt(project) {
  const stamps = (project?.history ?? [])
    .filter(entry => entry?.type === "elapsed-day")
    .map(entry => Number(entry.at) || 0);
  return stamps.length ? Math.max(...stamps) : null;
}

/** Most recently advanced presence project, or the oldest when none have advanced. */
export function chooseAutomaticFocus(projects) {
  return [...projects].sort((left, right) => {
    const leftAdvanced = lastAdvancedAt(left);
    const rightAdvanced = lastAdvancedAt(right);
    if (leftAdvanced != null || rightAdvanced != null) {
      if (leftAdvanced == null) return 1;
      if (rightAdvanced == null) return -1;
      if (leftAdvanced !== rightAdvanced) return rightAdvanced - leftAdvanced;
    }
    const created = (Number(left.createdAt) || 0) - (Number(right.createdAt) || 0);
    if (created) return created;
    return String(left.id).localeCompare(String(right.id));
  })[0] ?? null;
}

/**
 * One Active presence project per character.
 * A lone project becomes Active. Several unset projects keep the most recently
 * advanced one, or the oldest, and that choice is noted.
 */
export function normalizePresenceFocus(projects, { now = Date.now() } = {}) {
  const groups = new Map();
  for (const project of Object.values(projects ?? {})) {
    if (!isPresenceProject(project)) {
      if (project?.presenceFocus) project.presenceFocus = false;
      continue;
    }
    const owner = project.owner?.uuid ?? "";
    const group = groups.get(owner) ?? [];
    group.push(project);
    groups.set(owner, group);
  }
  let changed = false;
  for (const group of groups.values()) {
    const chosen = group.filter(project => project.presenceFocus === true);
    let keeper = null;
    let migrated = false;
    if (group.length === 1) keeper = group[0];
    else if (chosen.length === 1) keeper = chosen[0];
    else if (chosen.length > 1) keeper = chooseAutomaticFocus(chosen);
    else if (group.some(project => project.presenceFocus == null)) {
      keeper = chooseAutomaticFocus(group);
      migrated = true;
    }
    for (const project of group) {
      const next = project === keeper;
      if (Boolean(project.presenceFocus) === next && project.presenceFocus != null) continue;
      if (project.presenceFocus === next) continue;
      project.presenceFocus = next;
      changed = true;
      if (next && migrated) {
        appendHistory(project, "presence-focus", {
          active: true,
          migrated: true,
          summary: "Marked Active. This character already had more than one presence project, so Advance Day follows the one that advanced most recently, or the oldest if none have advanced."
        }, now);
      }
    }
  }
  return changed;
}

export const ACTIVE_PRESENCE_TOOLTIP = "Active: gets credit on Advance Day";
export const INACTIVE_PRESENCE_TOOLTIP = "Click to make Active";

/** Fields for the presence dot. Non-presence projects get no dot. */
export function presenceMarker(project, { canToggle = false } = {}) {
  if (!isPresenceProject(project)) {
    return { presenceTracked: false, presenceFocus: false, canTogglePresence: false, presenceTooltip: "" };
  }
  const active = project.presenceFocus === true;
  return {
    presenceTracked: true,
    presenceFocus: active,
    presenceState: active ? "active" : "inactive",
    canTogglePresence: Boolean(canToggle) && !active,
    presenceTooltip: active ? ACTIVE_PRESENCE_TOOLTIP : (canToggle ? INACTIVE_PRESENCE_TOOLTIP : "Inactive")
  };
}

export function activatePresenceFocus(projects, projectId, now = Date.now()) {
  const target = projects?.[String(projectId)];
  if (!isPresenceProject(target)) throw new Error("Only a presence project in progress can be Active.");
  const owner = target.owner?.uuid ?? "";
  for (const project of Object.values(projects)) {
    if (!isPresenceProject(project) || (project.owner?.uuid ?? "") !== owner) continue;
    const next = project.id === target.id;
    if (project.presenceFocus === next) continue;
    project.presenceFocus = next;
    appendHistory(project, "presence-focus", { active: next }, now);
  }
  return target;
}
