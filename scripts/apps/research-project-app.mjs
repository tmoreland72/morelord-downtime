import { DowntimeApplication } from "./downtime-application.mjs";
import { getCoreApi, getCoreParticipation } from "../integrations/core-api.mjs";

export class ResearchProjectApp extends DowntimeApplication {
  static services;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-create-research",
    classes: ["ml-window", "ml-downtime-module"], tag: "form",
    position: { width: 680, height: "auto" },
    window: { title: "Research Drakkenheim Recipes", icon: "fa-solid fa-book-open", resizable: true },
    form: { closeOnSubmit: false },
    actions: { create: ResearchProjectApp.create }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/create-research.hbs" } };

  async _prepareContext(options) {
    const owners = getCoreParticipation().listCharacterChoices({ ownedOnly: !game.user.isGM });
    this.ownerUuid ??= owners.find(owner => owner.uuid === game.user.character?.uuid)?.uuid ?? owners[0]?.uuid ?? "";
    let components = [], error = null;
    try {
      if (this.ownerUuid) components = await this.constructor.services.research.catalog().getResearchComponents(this.ownerUuid);
    } catch (cause) { error = cause.message; }
    return { ...await super._prepareContext(options),
      owners: owners.map(owner => ({ ...owner, selected: owner.uuid === this.ownerUuid })),
      components, error, canCreate: components.length > 0 };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const ownerSelect = this.element.querySelector('[name="ownerUuid"]');
    if (ownerSelect) getCoreApi().ui.decorateActorSelect(ownerSelect);
    this.element.querySelector('[name="ownerUuid"]')?.addEventListener("change", event => {
      this.ownerUuid = event.target.value;
      this.render({ force: true });
    });
  }

  static async create(event, target) {
    event.preventDefault();
    target.disabled = true;
    try {
      const form = new FormData(this.element);
      const uuid = String(form.get("ownerUuid") ?? "");
      const owner = await fromUuid(uuid);
      if (!owner || (!game.user.isGM && !owner.isOwner)) throw new Error("Choose a character you control.");
      const project = await this.constructor.services.allocationAuthority.createResearch({
        owner: { uuid, name: owner.name }, componentUuid: String(form.get("componentUuid") ?? "")
      });
      ui.notifications.info(`${project.name} started. Allocate one hour to complete it.`);
      await this.close();
      await this.constructor.services.onCreated?.(project);
    } catch (error) {
      ui.notifications.error(`Could not start research: ${error.message}`);
      target.disabled = false;
    }
  }
}
