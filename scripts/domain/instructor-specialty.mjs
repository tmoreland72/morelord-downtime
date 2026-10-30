/**
 * Whether a location capability of `type` allows `specialtyKey`.
 * Prefers Core `api.locations.locationAllowsSpecialty`. The fallback matches Core 0.9.0:
 * specialty is an array of keys. Empty, missing, or Any means every key. A legacy string
 * is one key. An empty or Any specialtyKey is allowed by every capability of that type.
 * A location with no capability of that type returns false.
 */
const UNRESTRICTED = new Set(["", "any"]);

export function isUnrestrictedSpecialty(value) {
  return UNRESTRICTED.has(String(value ?? "").trim().toLowerCase());
}

/** A legacy string, an array, empty, or Any all become stored specialty keys. Empty means no restriction. */
export function normalizeSpecialtyList(value) {
  const raw = Array.isArray(value) ? value : [value];
  const keys = [];
  const seen = new Set();
  for (const entry of raw) {
    const key = String(entry ?? "").trim();
    if (!key || isUnrestrictedSpecialty(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function capabilityAllowsSpecialty(capability, specialtyKey) {
  if (isUnrestrictedSpecialty(specialtyKey)) return true;
  const keys = normalizeSpecialtyList(capability?.specialty);
  if (!keys.length) return true;
  return keys.includes(String(specialtyKey).trim());
}

export function locationAllowsSpecialtyFallback(location, type, specialtyKey) {
  const typeId = String(type ?? "").trim();
  if (!typeId || !location || typeof location !== "object") return false;
  const capabilities = Array.isArray(location.capabilities) ? location.capabilities : [];
  const matches = capabilities.filter(capability => String(capability?.type ?? "").trim() === typeId);
  if (!matches.length) return false;
  return matches.some(capability => capabilityAllowsSpecialty(capability, specialtyKey));
}

function coreAllows() {
  const locations = globalThis.game?.modules?.get?.("morelord-core")?.api?.locations
    ?? globalThis.MorelordCore?.locations
    ?? null;
  return typeof locations?.locationAllowsSpecialty === "function" ? locations.locationAllowsSpecialty : null;
}

export function locationAllowsSpecialty(location, type, specialtyKey, allows = null) {
  const check = typeof allows === "function" ? allows : coreAllows();
  if (check) {
    try { return check(location, type, specialtyKey) === true; }
    catch { /* Use the local rule when Core's helper cannot read this location. */ }
  }
  return locationAllowsSpecialtyFallback(location, type, specialtyKey);
}

export function filterNpcTrainingChoices(choices, location, allows = null) {
  if (!location) return [...(choices ?? [])];
  return (choices ?? []).filter(choice => locationAllowsSpecialty(location, "instructor", choice.id, allows));
}

export function assertNpcInstructorSpecialty(data, location, allows = null) {
  if (String(data?.instructor?.mode ?? "") !== "npc") return;
  const locationId = String(data?.locationId ?? "").trim();
  if (!locationId) return;
  if (!location) throw new Error("The NPC instructor's Location could not be found.");
  const proficiencyId = String(data?.proficiencyId ?? "").trim();
  if (!locationAllowsSpecialty(location, "instructor", proficiencyId, allows)) {
    throw new Error("This Location's Instructor cannot teach that subject.");
  }
}
