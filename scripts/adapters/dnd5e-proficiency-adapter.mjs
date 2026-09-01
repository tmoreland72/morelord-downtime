const titleCase = value => String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(^|\s)\S/g, letter => letter.toUpperCase());
const asSet = value => new Set(value instanceof Set || Array.isArray(value) ? value : []);

export class Dnd5eProficiencyAdapter {
  constructor({ config = () => CONFIG.DND5E, resolveUuid = uuid => fromUuid(uuid), localize = key => game.i18n.localize(key) } = {}) {
    this.getConfig = typeof config === "function" ? config : () => config;
    this.resolveUuid = resolveUuid;
    this.localize = localize;
  }

  supports(kind) {
    return ["artisanTool", "tool", "toolProficiency", "skillProficiency", "language", "armorProficiency", "weaponProficiency", "weaponMastery"].includes(kind);
  }

  async listTrainingChoices({ actors = [] } = {}) {
    const config = this.getConfig() ?? {};
    const choices = [];
    const addConfig = (values, kind, category) => {
      for (const [id, data] of Object.entries(values ?? {})) {
        choices.push(this.#choice(kind, id, this.localize(typeof data === "string" ? data : data?.label ?? id), category, actors));
      }
    };
    const addDocuments = async (values, kind, category) => {
      for (const [id, data] of Object.entries(values ?? {})) {
        const uuid = typeof data === "string" ? data : data?.id;
        const document = uuid ? await Promise.resolve(this.resolveUuid(uuid)).catch(() => null) : null;
        const fallback = typeof data === "object" && data?.label ? this.localize(data.label) : titleCase(id);
        choices.push(this.#choice(kind, id, document?.name ?? fallback, category, actors));
      }
    };

    addConfig(config.skills, "skillProficiency", "Skill Proficiency");
    addConfig(config.enrichmentLookup?.languages, "language", "Language");
    addConfig(config.armorProficiencies, "armorProficiency", "Armor Proficiency");
    await addDocuments({ ...(config.armorIds ?? {}), ...(config.shieldIds ?? {}) }, "armorProficiency", "Armor Proficiency");
    addConfig(config.weaponProficiencies, "weaponProficiency", "Weapon Proficiency");
    await addDocuments(config.weaponIds, "weaponProficiency", "Weapon Proficiency");
    await addDocuments(config.weaponIds, "weaponMastery", "Weapon Mastery");
    addConfig(config.toolProficiencies, "toolProficiency", "Tool Proficiency");
    await addDocuments(config.tools, "toolProficiency", "Tool Proficiency");

    return choices.sort((left, right) => left.label.localeCompare(right.label) || left.category.localeCompare(right.category));
  }

  actorKnows(actor, kind, id) {
    if (!actor) return false;
    if (["artisanTool", "tool", "toolProficiency"].includes(kind)) return Number(actor.system?.tools?.[id]?.value ?? 0) > 0;
    if (kind === "skillProficiency") return Number(actor.system?.skills?.[id]?.value ?? 0) > 0;
    if (kind === "language") return asSet(actor.system?.traits?.languages?.value).has(id);
    if (kind === "armorProficiency") return asSet(actor.system?.traits?.armorProf?.value).has(id);
    if (kind === "weaponProficiency") return asSet(actor.system?.traits?.weaponProf?.value).has(id);
    if (kind === "weaponMastery") return asSet(actor.system?.traits?.weaponProf?.mastery?.value).has(id);
    return false;
  }

  async award(actor, kind, id) {
    if (kind === "language") return this.#awardSet(actor, "system.traits.languages.value", actor.system?.traits?.languages?.value, kind, id);
    if (kind === "armorProficiency") return this.#awardSet(actor, "system.traits.armorProf.value", actor.system?.traits?.armorProf?.value, kind, id);
    if (kind === "weaponProficiency") return this.#awardSet(actor, "system.traits.weaponProf.value", actor.system?.traits?.weaponProf?.value, kind, id);
    if (kind === "weaponMastery") return this.#awardSet(actor, "system.traits.weaponProf.mastery.value", actor.system?.traits?.weaponProf?.mastery?.value, kind, id);
    if (kind === "skillProficiency") return this.#awardMapping(actor, "skills", kind, id);
    if (["artisanTool", "tool", "toolProficiency"].includes(kind)) return this.#awardMapping(actor, "tools", "toolProficiency", id);
    return { awarded: false, reason: "unsupported-training-kind" };
  }

  #choice(kind, id, label, category, actors) {
    return {
      value: `${kind}:${id}`,
      kind,
      id,
      label,
      category,
      instructorUuids: actors.filter(actor => this.actorKnows(actor, kind, id)).map(actor => actor.uuid).join("|")
    };
  }

  async #awardSet(actor, path, current, kind, id) {
    if (!(current instanceof Set || Array.isArray(current))) return { awarded: false, reason: `${kind}-data-path-unavailable` };
    await actor.update({ [path]: [...new Set([...current, id])] });
    return { awarded: true, kind, proficiencyId: id, actorUuid: actor.uuid };
  }

  async #awardMapping(actor, property, kind, id) {
    const current = actor.system?.[property]?.[id];
    if (current && !("value" in current)) return { awarded: false, reason: `${kind}-data-path-unavailable` };
    const path = `system.${property}.${id}`;
    const update = current
      ? { [`${path}.value`]: Math.max(1, Number(current.value ?? 0)) }
      : { [path]: { value: 1, ...(property === "tools" ? { ability: this.getConfig()?.tools?.[id]?.ability ?? "int" } : {}) } };
    await actor.update(update);
    return { awarded: true, kind, proficiencyId: id, actorUuid: actor.uuid };
  }
}
