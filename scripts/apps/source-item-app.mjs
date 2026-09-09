import { SOURCE_ITEM_RARITIES, sourcingBonus } from "../activities/source-item/source-item-activity.mjs";
import { getCoreParticipation } from "../integrations/core-api.mjs";
import { DowntimeApplication } from "./downtime-application.mjs";
import { getCoreApi } from "../integrations/core-api.mjs";

export class SourceItemProjectApp extends DowntimeApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-source-item",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "form",
    position: { width: 720, height: "auto" },
    window: { title: "Source Item", icon: "fa-solid fa-magnifying-glass-dollar", resizable: true },
    form: { closeOnSubmit: false },
    actions: { save: SourceItemProjectApp.save }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/create-source-item.hbs" } };

  constructor(options = {}) {
    super(options);
    this.projectId = options.projectId ?? null;
    this.selectedOwnerUuid = null;
    this.wishlist = [];
  }

  async _prepareContext(options) {
    const project = this.projectId ? await this.constructor.services.projects.get(this.projectId) : null;
    const sourceItem = project?.metadata?.sourceItem ?? {};
    const owners = getCoreParticipation().listCharacterChoices({ ownedOnly: !game.user.isGM });
    const controlledCharacter = Array.from(globalThis.canvas?.tokens?.controlled ?? []).map(token => token.actor).find(actor => actor?.type === "character");
    const defaultOwnerUuid = project?.owner?.uuid
      ?? this.selectedOwnerUuid
      ?? (game.user.isGM ? controlledCharacter?.uuid : game.user.character?.uuid ?? controlledCharacter?.uuid)
      ?? (owners.length === 1 ? owners[0].uuid : "");
    this.selectedOwnerUuid = defaultOwnerUuid;
    const [wishlist, availableGp] = defaultOwnerUuid
      ? await Promise.all([this.constructor.services.catalog.listWishlist(defaultOwnerUuid), this.constructor.services.catalog.availableInvestmentGp(defaultOwnerUuid)])
      : [[], 0];
    this.wishlist = wishlist;
    const selectedActor = defaultOwnerUuid ? await fromUuid(defaultOwnerUuid) : null;
    if (sourceItem.target && !this.wishlist.some(item => item.uuid === sourceItem.target.uuid)) this.wishlist.unshift(sourceItem.target);
    return {
      ...await super._prepareContext(options),
      isEditing: Boolean(project),
      resolved: Boolean(sourceItem.outcome),
      sourceItem,
      ownerUuid: defaultOwnerUuid,
      targetUuid: sourceItem.target?.uuid ?? "",
      owners: owners.map(owner => ({ ...owner, selected: owner.uuid === defaultOwnerUuid })),
      wishlist: this.wishlist.map(item => ({ ...item, selected: item.uuid === sourceItem.target?.uuid })),
      hasWishlist: this.wishlist.length > 0,
      locations: (this.constructor.services.locations()?.list?.() ?? []).map(location => ({ ...location, selected: location.id === project?.locationId })),
      checkArcana: sourceItem.checkSkill !== "inv",
      checkInvestigation: sourceItem.checkSkill === "inv",
      arcanaModifier: formatModifier(getCoreApi().rolls.skillModifier(selectedActor, "arc")),
      investigationModifier: formatModifier(getCoreApi().rolls.skillModifier(selectedActor, "inv")),
      investmentGp: sourceItem.investmentGp ?? 100,
      maxInvestmentGp: Number(sourceItem.investmentGp ?? 0) + availableGp,
      availableGp,
      weeks: sourceItem.weeks ?? 1,
      bonus: sourcingBonus({ investmentGp: sourceItem.investmentGp ?? 100, weeks: sourceItem.weeks ?? 1 }),
      rarities: SOURCE_ITEM_RARITIES,
      canSave: Boolean(defaultOwnerUuid && sourceItem.target?.uuid && project?.locationId)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="ownerUuid"]')?.addEventListener("change", event => {
      this.selectedOwnerUuid = event.currentTarget.value;
      void this.render({ force: true });
    });
    const updateBonus = () => {
      const investmentGp = Number(this.element.querySelector('[name="investmentGp"]')?.value ?? 100);
      const weeks = Number(this.element.querySelector('[name="weeks"]')?.value ?? 1);
      const output = this.element.querySelector("[data-sourcing-bonus]");
      if (output) output.textContent = `+${sourcingBonus({ investmentGp, weeks })}`;
      for (const button of this.element.querySelectorAll("[data-step-target]")) {
        const input = this.element.querySelector(`[name="${button.dataset.stepTarget}"]`);
        const next = Number(input.value) + Number(button.dataset.step);
        button.disabled = Boolean(context.resolved) || next < Number(input.min) || next > Number(button.dataset.maximum ?? Infinity);
      }
    };
    for (const button of this.element.querySelectorAll("[data-step-target]")) button.addEventListener("click", event => {
      event.preventDefault();
      const input = this.element.querySelector(`[name="${event.currentTarget.dataset.stepTarget}"]`);
      const step = Number(event.currentTarget.dataset.step);
      const minimum = Number(input.min);
      const maximum = Number(event.currentTarget.dataset.maximum ?? Infinity);
      input.value = String(Math.min(maximum, Math.max(minimum, Number(input.value) + step)));
      updateBonus();
    });
    this.element.querySelector('[name="investmentGp"]')?.addEventListener("input", updateBonus);
    this.element.querySelector('[name="weeks"]')?.addEventListener("input", updateBonus);
    for (const select of this.element.querySelectorAll("select")) select.addEventListener("change", () => this.updateSaveAvailability());
    updateBonus();
    this.updateSaveAvailability();
  }

  updateSaveAvailability() {
    const form = new FormData(this.element);
    const button = this.element.querySelector('[data-action="save"]');
    if (!button) return;
    button.disabled = !String(form.get("ownerUuid") ?? "")
      || !String(form.get("targetUuid") ?? "")
      || !String(form.get("locationId") ?? "")
      || !["arc", "inv"].includes(String(form.get("checkSkill") ?? ""));
  }

  static async save(event, target) {
    event.preventDefault();
    const form = new FormData(this.element);
    target.disabled = true;
    try {
      const ownerUuid = String(form.get("ownerUuid") ?? "");
      const targetUuid = String(form.get("targetUuid") ?? "");
      const targetItem = this.projectId
        ? this.wishlist.find(item => item.uuid === targetUuid)
        : await this.constructor.services.catalog.requireWishlistItem(ownerUuid, targetUuid);
      if (!targetItem) throw new Error("The requested wishlist item is no longer available.");
      const data = {
        owner: { uuid: ownerUuid, name: game.actors.get(ownerUuid.split(".").at(-1))?.name ?? null },
        target: targetItem,
        locationId: String(form.get("locationId") ?? ""),
        checkSkill: String(form.get("checkSkill") ?? ""),
        investmentGp: Number(form.get("investmentGp") ?? 0),
        weeks: Number(form.get("weeks") ?? 0)
      };
      const project = this.projectId
        ? await this.constructor.services.sourceItem.updateProject(this.projectId, data)
        : await this.constructor.services.sourceItem.createProject(data);
      ui.notifications.info(`${project.name} ${this.projectId ? "updated" : "started"}.`);
      await this.close();
      await this.constructor.services.onCreated?.(project);
    } catch (error) {
      ui.notifications.error(`Could not save Source Item: ${error.message}`);
      this.updateSaveAvailability();
    }
  }
}

function formatModifier(value) {
  const modifier = Number(value) || 0;
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}
