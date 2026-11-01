/** Where an active Session is. A blank location is On the Road, not the viewed scene. */
export function sessionPlaceId(session) {
  return String(session?.locationId ?? "").trim();
}

/** The place that gates progress: the active Session when there is one, otherwise the time pool. */
export function allocationPlaceId(session, segment) {
  if (session) return sessionPlaceId(session);
  return String(segment?.locationId ?? "").trim();
}

export function projectRequiresPlace(project) {
  return String(project?.locationId ?? "").trim();
}

export function locationMismatch(project, placeId) {
  const required = projectRequiresPlace(project);
  if (!required) return false;
  return required !== String(placeId ?? "").trim();
}

export function requiresLocationReason(locationName) {
  const name = String(locationName ?? "").trim() || "its assigned Location";
  return `Requires being in ${name}.`;
}
