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

export function morelordToolKey(id) {
  return String(id ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join("")
}

function legacyTokenToolVisible(definition) {
  if (typeof definition.visible === "function") return definition.visible() !== false
  return definition.visible !== false
}

export function addMorelordTool(definition) {
  Hooks.once("setup", () => {
    const tools = game.modules.get(CORE_MODULE_ID)?.api?.tools ?? globalThis.MorelordCore?.tools
    if (typeof tools?.register === "function") return tools.register(definition)
    Hooks.on("getSceneControlButtons", controls => {
      const tokenTools = controls?.tokens?.tools
      if (!tokenTools) return
      const name = morelordToolKey(definition.id)
      if (!name) return
      tokenTools[name] = {
        name,
        title: definition.title,
        icon: definition.icon,
        order: Object.keys(tokenTools).length,
        button: true,
        visible: legacyTokenToolVisible(definition),
        onChange: event => definition.onClick?.(event)
      }
    })
  })
}
