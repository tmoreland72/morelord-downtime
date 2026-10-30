/**
 * Places used to decide whether a Craftworks recipe appears in Downtime.
 * Core `activeContext` lets an active Session, including On the Road, replace the
 * scene the user is viewing. Passing that session place into Craftworks skips
 * `activeContext` and hides facility recipes that Neverwinter can still support.
 * The viewed scene stays in the set whenever the session place would override it.
 */
export function craftingPlaces({ activeContext = null, sceneLocation = null } = {}) {
  const places = [];
  const add = location => {
    if (!location || typeof location !== "object") return;
    const id = location.id == null ? "" : String(location.id);
    if (id && places.some(place => String(place.id ?? "") === id)) return;
    if (!id && places.includes(location)) return;
    places.push(location);
  };
  const source = activeContext?.source ?? null;
  add(activeContext?.location ?? null);
  if (source !== "scene" || !activeContext?.location) add(sceneLocation);
  return places;
}

export function craftingPlaceLabel(places, sceneLocation = null) {
  return sceneLocation?.name
    ?? places.find(place => place?.name)?.name
    ?? "Current Location";
}
