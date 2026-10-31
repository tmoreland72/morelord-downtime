import { getCoreParticipation } from "../integrations/core-api.mjs";
import { DowntimeApplication } from "./downtime-application.mjs";
import { XGE_ACTIVITIES } from "../activities/xge/xge-rules.mjs";

export class XgeProjectApp extends DowntimeApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-xge",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "form",
    position: { width: 640, height: "auto" },
    window: { title: "Downtime Activity", icon: "fa-solid fa-hourglass", resizable: true },
    form: { closeOnSubmit: false },
    actions: { save: XgeProjectApp.save }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/create-xge.hbs" } };

  constructor(options = {}) {
    super(options);
    this.activityId = options.activityId;
  }

  async _prepareContext(options) {
    const activity = XGE_ACTIVITIES[this.activityId];
    const isGm = globalThis.game?.user?.isGM === true;
    const owners = getCoreParticipation().listCharacterChoices({ ownedOnly: !isGm });
    const locations = this.constructor.services.locations()?.list?.() ?? [];
    return {
      ...await super._prepareContext(options),
      activityId: this.activityId,
      activityName: activity?.name ?? "Downtime",
      isGm,
      owners,
      locations,
      isReligious: this.activityId === "religious-service",
      isCarousing: this.activityId === "carousing",
      isCrime: this.activityId === "crime",
      isGambling: this.activityId === "gambling",
      isPit: this.activityId === "pit-fighting",
      isResearch: this.activityId === "lore-research",
      isRelaxation: this.activityId === "relaxation",
      needsTemple: activity?.capability === "temple",
      needsLibrary: activity?.capability === "library"
    };
  }

  static async save(event, target) {
    event.preventDefault();
    const form = new FormData(this.element);
    target.disabled = true;
    try {
      const ownerUuid = String(form.get("ownerUuid") ?? "");
      if (!ownerUuid) throw new Error("Choose a character.");
      const data = {
        activityType: this.activityId,
        owner: { uuid: ownerUuid, name: game.actors.get(ownerUuid.split(".").at(-1))?.name ?? null },
        locationId: String(form.get("locationId") ?? ""),
        skill: String(form.get("skill") ?? ""),
        socialClass: String(form.get("socialClass") ?? ""),
        npcNames: String(form.get("npcNames") ?? ""),
        nobilityAccess: form.get("nobilityAccess") === "on",
        crimeDc: Number(form.get("crimeDc") ?? 0) || null,
        crimeNotes: String(form.get("crimeNotes") ?? ""),
        thirdSkill: String(form.get("thirdSkill") ?? ""),
        stakeGp: Number(form.get("stakeGp") ?? 0) || null,
        allowHighStake: form.get("allowHighStake") === "on",
        question: String(form.get("question") ?? ""),
        extraGp: Number(form.get("extraGp") ?? 0),
        gamingSet: String(form.get("gamingSet") ?? ""),
        replaceIndex: Number(form.get("replaceIndex") ?? 0),
        replaceWithAttack: String(form.get("replaceWithAttack") ?? ""),
        waiveLocation: form.get("waiveLocation") === "on"
      };
      if (!data.gamingSet) delete data.gamingSet;
      if (!data.replaceWithAttack) delete data.replaceWithAttack;
      const project = await this.constructor.services.xge.createProject(data);
      ui.notifications.info(`${project.name} started.`);
      await this.close();
      await this.constructor.services.onCreated?.(project);
    } catch (error) {
      ui.notifications.error(`Could not start ${XGE_ACTIVITIES[this.activityId]?.name ?? "the activity"}: ${error.message}`);
      target.disabled = false;
    }
  }
}
