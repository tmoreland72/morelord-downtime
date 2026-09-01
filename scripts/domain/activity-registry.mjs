export class ActivityRegistry {
  #activities = new Map();

  register(definition = {}) {
    const id = String(definition.id ?? "").trim();
    if (!id) throw new Error("An activity requires an id.");
    if (typeof definition.createProject !== "function" && typeof definition.launch !== "function") {
      throw new Error(`Activity '${id}' requires createProject() or launch().`);
    }
    const normalized = Object.freeze({
      id,
      name: String(definition.name ?? id),
      icon: String(definition.icon ?? "fa-solid fa-hourglass-half"),
      description: String(definition.description ?? "Start a new persistent downtime Project."),
      showInProjectCreation: definition.showInProjectCreation !== false,
      availableInSessions: definition.availableInSessions !== false,
      createProject: definition.createProject ?? null,
      canStart: definition.canStart ?? (() => ({ passed: true, reasons: [] })),
      canProgress: definition.canProgress ?? (() => ({ passed: true, reasons: [] })),
      getSummary: definition.getSummary ?? (project => project.name),
      getRequirements: definition.getRequirements ?? (project => project.requirements ?? []),
      launch: definition.launch ?? null,
      edit: definition.edit ?? null,
      onComplete: definition.onComplete ?? null
    });
    this.#activities.set(id, normalized);
    return normalized;
  }

  get(id) { return this.#activities.get(String(id)) ?? null; }
  list() { return Array.from(this.#activities.values()); }
}
