/**
 * Whether a location capability of `type` allows `specialtyKey`.
 * Prefers Core 0.9.0 `api.locations.locationAllowsSpecialty`. The fallback matches that rule:
 * Any, an empty specialty, or a missing specialty allows every key. An empty or Any key is
 * allowed by every capability of that type. No capability of that type returns false.
 */
const UNRESTRICTED = new Set(["", "any"]);

export function isUnrestrictedSpecialty(value) {
  return UNRESTRICTED.has(String(value ?? "").trim().toLowerCase());
}

export function locationAllowsSpecialtyFallback(location, type, specialtyKey) {
  const typeId = String(type ?? "").trim();
  if (!typeId || !location || typeof location !== "object") return false;
  const capabilities = Array.isArray(location.capabilities) ? location.capabilities : [];
  const matches = capabilities.filter(capability => String(capability?.type ?? "").trim() === typeId);
  if (!matches.length) return false;
  if (isUnrestrictedSpecialty(specialtyKey)) return true;
  const requested = String(specialtyKey).trim();
  return matches.some(capability => {
    const stored = String(capability?.specialty ?? "").trim();
    return isUnrestrictedSpecialty(stored) || stored === requested;
  });
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
