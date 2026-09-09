const CORE_MODULE_ID = "morelord-core";

export function getModuleApi(moduleId, globalName = null) {
  return game.modules.get(moduleId)?.api
    ?? (globalName ? globalThis[globalName] : null)
    ?? null;
}

export function getCoreApi() {
  return getModuleApi(CORE_MODULE_ID, "MorelordCore");
}

export function requireCoreFeature(path, value) {
  if (value) return value;
  throw new Error(`Morelord Core ${path} is unavailable. Update and enable Morelord Core.`);
}

export function getCoreLocations() {
  return requireCoreFeature("Location services", getCoreApi()?.locations);
}

export function getCoreParticipation() {
  return requireCoreFeature("participation helpers", getCoreApi()?.ui?.participation);
}

export function renderPreservingScroll(application, renderOperation) {
  const preserve = getCoreApi()?.ui?.renderPreservingScroll;
  return preserve ? preserve(application, renderOperation) : renderOperation();
}
