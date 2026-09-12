import { projectManagementActions, projectManagementContext } from "./project-management.mjs";
import { DowntimeApplication } from "./downtime-application.mjs";
import { getCoreParticipation } from "../integrations/core-api.mjs";

const characterChoices = (options = {}) => getCoreParticipation().listCharacterChoices(options);
const selectedCharacterUuids = form => getCoreParticipation().selectedCharacterUuids(form);
const participantRecords = uuids => getCoreParticipation().participantRecords(uuids);

class TrainingSelectionApp extends DowntimeApplication {
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-training-selection",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "section",
    position: { width: 920, height: 680 },
    window: { title: "Select Training", icon: "fa-solid fa-graduation-cap", resizable: true },
    actions: {
      chooseTraining: TrainingSelectionApp.chooseTraining,
      filterCategory: TrainingSelectionApp.filterCategory,
      clearTrainingSearch: TrainingSelectionApp.clearTrainingSearch
    }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/training-selection.hbs" } };

  constructor({ choices = [], selectedValue = "", onSelect = null } = {}) {
    super();
    this.choices = choices;
    this.selectedValue = selectedValue;
    this.onSelect = onSelect;
    this.category = "all";
  }

  async _prepareContext(options) {
    const categories = [...new Set(this.choices.map(choice => choice.category))].sort();
    return {
      ...await super._prepareContext(options),
      choices: this.choices.map(choice => ({
        ...choice,
        searchText: `${choice.label} ${choice.category}`.toLocaleLowerCase(),
        selected: choice.value === this.selectedValue
      })),
      categories: categories.map(category => ({
        category,
        count: this.choices.filter(choice => choice.category === category).length
      })),
      resultCount: this.choices.length
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("[data-training-search]")?.addEventListener("input", () => this.applyFilters());
    this.applyFilters();
  }

  applyFilters() {
    const query = this.element.querySelector("[data-training-search]")?.value.trim().toLocaleLowerCase() ?? "";
    let visible = 0;
    for (const option of this.element.querySelectorAll("[data-training-choice]")) {
      const matchesCategory = this.category === "all" || option.dataset.category === this.category;
      const matchesQuery = !query || option.dataset.search.includes(query);
      option.hidden = !(matchesCategory && matchesQuery);
      if (!option.hidden) visible += 1;
    }
    const count = this.element.querySelector("[data-training-result-count]");
    if (count) count.textContent = `${visible} training ${visible === 1 ? "option" : "options"}`;
    const empty = this.element.querySelector("[data-training-empty]");
    if (empty) empty.hidden = visible !== 0;
  }

  static filterCategory(event, target) {
    event.preventDefault();
    this.category = target.dataset.category;
    for (const button of this.element.querySelectorAll("[data-action='filterCategory']")) {
      const active = button.dataset.category === this.category;
      button.classList.toggle("is-active", active);
      const icon = button.querySelector("i");
      icon?.classList.toggle("fa-solid", active);
      icon?.classList.toggle("fa-square-check", active);
      icon?.classList.toggle("fa-regular", !active);
      icon?.classList.toggle("fa-square", !active);
    }
    this.applyFilters();
  }

  static clearTrainingSearch(event) {
    event.preventDefault();
    const search = this.element.querySelector("[data-training-search]");
    if (search) search.value = "";
    this.applyFilters();
    search?.focus();
  }

  static async chooseTraining(event, target) {
    event.preventDefault();
    const choice = this.choices.find(item => item.value === target.dataset.value);
    if (!choice) return;
    await this.onSelect?.(choice);
    return this.close();
  }
}

export class TrainingProjectApp extends DowntimeApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-create-training",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "form",
    position: { width: 680, height: "auto" },
    window: { title: "Training Project", icon: "fa-solid fa-graduation-cap", resizable: true },
    form: { closeOnSubmit: false },
    actions: { ...projectManagementActions, create: TrainingProjectApp.create, selectTraining: TrainingProjectApp.selectTraining }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/create-training.hbs" } };

  constructor(options = {}) {
    super(options);
    this.projectId = options.projectId ?? null;
    this.selectedTrainingValue = null;
    this.trainingCatalog = [];
  }

  async _prepareContext(options) {
    const project = this.projectId ? await this.constructor.services.projects.get(this.projectId) : null;
    const training = project?.metadata?.training ?? null;
    const actors = Array.from(game.actors ?? []).filter(actor => actor.type === "character");
    const trainingChoices = (await this.constructor.services.proficiencies.listTrainingChoices({ actors })).map(choice => ({
      ...choice,
      selected: training?.kind === choice.kind && training?.proficiencyId === choice.id
    }));
    this.trainingCatalog = trainingChoices;
    if (this.selectedTrainingValue === null) {
      const selectedKind = training?.kind === "artisanTool" ? "toolProficiency" : training?.kind;
      this.selectedTrainingValue = training ? `${selectedKind}:${training.proficiencyId}` : "";
    }
    const selectedTraining = trainingChoices.find(choice => choice.value === this.selectedTrainingValue) ?? null;
    const instructorSelection = training?.instructor?.mode === "npc" ? "npc" : training?.instructor?.actorUuid ?? "";
    const studentChoices = characterChoices({ ownedOnly: !game.user.isGM });
    const controlledCharacter = Array.from(globalThis.canvas?.tokens?.controlled ?? [])
      .map(token => token.actor)
      .find(actor => actor?.type === "character");
    const defaultStudentUuid = project?.owner?.uuid
      ?? (game.user.isGM ? controlledCharacter?.uuid : game.user.character?.uuid ?? controlledCharacter?.uuid)
      ?? (studentChoices.length === 1 ? studentChoices[0].uuid : "");
    return {
      ...await super._prepareContext(options),
      ...await projectManagementContext(project, this.constructor.services),
      isEditing: Boolean(project),
      project,
      students: studentChoices.map(actor => ({ ...actor, selected: actor.uuid === defaultStudentUuid })),
      instructors: characterChoices().map(actor => ({ ...actor, selected: actor.uuid === instructorSelection })),
      npcInstructor: instructorSelection === "npc",
      npcInstructorName: training?.instructor?.name ?? "",
      locations: (this.constructor.services.locations()?.list?.() ?? []).map(location => ({ ...location, selected: location.id === project?.locationId })),
      selectedTraining
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const instructor = this.element.querySelector('[name="instructorSelection"]');
    const npcField = this.element.querySelector('[data-npc-instructor]');
    const refresh = () => {
      const selection = instructor?.value ?? "";
      if (npcField) npcField.hidden = selection !== "npc";
    };
    instructor?.addEventListener("change", refresh);
    refresh();
  }

  static selectTraining(event) {
    event.preventDefault();
    const instructorSelection = this.element.querySelector('[name="instructorSelection"]')?.value ?? "";
    const choices = this.trainingCatalog.filter(choice => !instructorSelection
      || instructorSelection === "npc"
      || choice.instructorUuids.split("|").filter(Boolean).includes(instructorSelection));
    return new TrainingSelectionApp({
      choices,
      selectedValue: this.selectedTrainingValue,
      onSelect: choice => {
        this.selectedTrainingValue = choice.value;
        const input = this.element.querySelector('[name="proficiency"]');
        if (input) input.value = choice.value;
        const label = this.element.querySelector("[data-selected-training-label]");
        const category = this.element.querySelector("[data-selected-training-category]");
        if (label) label.textContent = choice.label;
        if (category) category.textContent = choice.category;
      }
    }).render({ force: true });
  }

  static async create(event, target) {
    event.preventDefault();
    const form = new FormData(this.element);
    target.disabled = true;
    try {
      const ownerUuid = String(form.get("ownerUuid") ?? "");
      const instructorSelection = String(form.get("instructorSelection") ?? "");
      const instructorUuid = instructorSelection === "npc" ? null : instructorSelection;
      const npcInstructorName = String(form.get("npcInstructorName") ?? "").trim();
      const [kind, proficiencyId] = String(form.get("proficiency") ?? "").split(":", 2);
      const requiredHours = Number(form.get("requiredHours") ?? 120);
      const selected = this.trainingCatalog.find(choice => choice.value === `${kind}:${proficiencyId}`);
      if (!ownerUuid || !instructorSelection) throw new Error("Choose both a student and an instructor.");
      if (instructorSelection === "npc" && !npcInstructorName) throw new Error("Enter the NPC instructor's name.");
      if (ownerUuid === instructorUuid) throw new Error("The student and instructor must be different characters.");
      if (!proficiencyId || !this.constructor.services.proficiencies.supports(kind)) throw new Error("Choose a specific training proficiency.");
      if (!Number.isFinite(requiredHours) || requiredHours <= 0) throw new Error("Required hours must be greater than zero.");
      const data = {
        kind, proficiencyId, requiredHours,
        proficiencyLabel: selected?.label ?? proficiencyId,
        locationId: String(form.get("locationId") ?? "").trim() || null,
        owner: { uuid: ownerUuid, name: game.actors.get(ownerUuid.split(".").at(-1))?.name ?? null },
        instructor: instructorSelection === "npc" ? { mode: "npc", name: npcInstructorName } : { mode: "participant", actorUuid: instructorUuid },
        participants: instructorSelection === "npc"
          ? [{ actorUuid: ownerUuid, role: "student", approved: true }]
          : [{ actorUuid: ownerUuid, role: "student", approved: true }, { actorUuid: instructorUuid, role: "instructor", approved: true }]
      };
      const project = this.projectId
        ? await this.constructor.services.training.updateProject(this.projectId, data)
        : await this.constructor.services.training.createProject(data);
      ui.notifications.info(`${project.name} ${this.projectId ? "updated" : "started"}.`);
      await this.close();
      await this.constructor.services.onCreated?.(project);
    } catch (error) {
      ui.notifications.error(`Could not save Training: ${error.message}`);
      target.disabled = false;
    }
  }
}

export class CommissionProjectApp extends DowntimeApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-create-commission",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "form",
    position: { width: 680, height: "auto" },
    window: { title: "Commission Project", icon: "fa-solid fa-handshake", resizable: true },
    form: { closeOnSubmit: false },
    actions: { ...projectManagementActions, save: CommissionProjectApp.save }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/create-commission.hbs" } };

  constructor(options = {}) {
    super(options);
    this.projectId = options.projectId ?? null;
  }

  async _prepareContext(options) {
    const project = this.projectId ? await this.constructor.services.projects.get(this.projectId) : null;
    const owners = characterChoices({ ownedOnly: !game.user.isGM });
    const controlledCharacter = Array.from(globalThis.canvas?.tokens?.controlled ?? []).map(token => token.actor).find(actor => actor?.type === "character");
    const defaultOwnerUuid = project?.owner?.uuid
      ?? (game.user.isGM ? controlledCharacter?.uuid : game.user.character?.uuid ?? controlledCharacter?.uuid)
      ?? (owners.length === 1 ? owners[0].uuid : "");
    return {
      ...await super._prepareContext(options),
      ...await projectManagementContext(project, this.constructor.services),
      isEditing: Boolean(project),
      project,
      commission: project?.metadata?.commission ?? {},
      requiredDays: project?.progress?.elapsed?.requiredDays ?? 1,
      owners: owners.map(owner => ({ ...owner, selected: owner.uuid === defaultOwnerUuid })),
      locations: (this.constructor.services.locations()?.list?.() ?? []).map(location => ({ ...location, selected: location.id === project?.locationId }))
    };
  }

  static async save(event, target) {
    event.preventDefault();
    const form = new FormData(this.element);
    target.disabled = true;
    try {
      const ownerUuid = String(form.get("ownerUuid") ?? "");
      if (!ownerUuid) throw new Error("Choose a Project owner.");
      const data = {
        owner: { uuid: ownerUuid, name: game.actors.get(ownerUuid.split(".").at(-1))?.name ?? null },
        contractorName: String(form.get("contractorName") ?? ""),
        itemDescription: String(form.get("itemDescription") ?? ""),
        locationId: String(form.get("locationId") ?? ""),
        requiredDays: Number(form.get("requiredDays") ?? 0),
        notes: String(form.get("notes") ?? "")
      };
      const project = this.projectId
        ? await this.constructor.services.commission.updateProject(this.projectId, data)
        : await this.constructor.services.commission.createProject(data);
      ui.notifications.info(`${project.name} ${this.projectId ? "updated" : "commissioned"}.`);
      await this.close();
      await this.constructor.services.onCreated?.(project);
    } catch (error) {
      ui.notifications.error(`Could not save Commission: ${error.message}`);
      target.disabled = false;
    }
  }
}

export class NewProjectApp extends DowntimeApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-new-project",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "section",
    position: { width: 620, height: "auto" },
    window: { title: "New Project", icon: "fa-solid fa-folder-plus", resizable: true },
    actions: { choose: NewProjectApp.choose }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/new-project.hbs" } };

  async _prepareContext(options) {
    return {
      ...await super._prepareContext(options),
      activityTypes: this.constructor.services.activities.list().filter(activity => activity.showInProjectCreation).map(activity => ({
        id: activity.id,
        name: activity.name,
        icon: activity.icon,
        description: activity.description,
        actionLabel: activity.actionLabel,
        actionIcon: activity.actionIcon
      }))
    };
  }

  static async choose(event, target) {
    event.preventDefault();
    const activity = this.constructor.services.activities.get(target.dataset.activityId);
    if (typeof activity?.launch !== "function") return ui.notifications.warn("This Project type does not have a creation workflow yet.");
    await this.close();
    return activity.launch();
  }
}

export class SessionEditorApp extends DowntimeApplication {
  static services = null;
  static configure(services) { this.services = services; }
  static DEFAULT_OPTIONS = {
    id: "morelord-downtime-create-session",
    classes: ["ml-window", "ml-downtime-module"],
    tag: "form",
    position: { width: 680, height: "auto" },
    window: { title: "Create Downtime Session", icon: "fa-solid fa-calendar-plus", resizable: true },
    form: { closeOnSubmit: false },
    actions: { create: SessionEditorApp.create }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/create-session.hbs" } };

  constructor(options = {}) {
    super(options);
    this.sessionId = options.sessionId ?? null;
  }

  async _prepareContext(options) {
    const session = this.sessionId ? await this.constructor.services.sessions.get(this.sessionId) : null;
    const participantIds = new Set(session?.participants.map(entry => entry.actorUuid) ?? []);
    const activityIds = new Set(session?.availableActivities ?? []);
    return {
      ...await super._prepareContext(options),
      isEditing: Boolean(session),
      session,
      actors: characterChoices({ selectedUuids: session ? participantIds : null }),
      locations: (this.constructor.services.locations()?.list?.() ?? []).map(location => ({ ...location, selected: location.id === session?.locationId })),
      activityTypes: this.constructor.services.activities.list().filter(activity => activity.availableInSessions).map(activity => ({ id: activity.id, name: activity.name, icon: activity.icon, checked: !session || activityIds.has(activity.id) }))
    };
  }

  static async create(event, target) {
    event.preventDefault();
    const form = new FormData(this.element);
    target.disabled = true;
    try {
      const actorUuids = selectedCharacterUuids(form);
      const plannedDurationHours = Number(form.get("plannedDurationHours") ?? 0);
      if (!actorUuids.length) throw new Error("Select at least one participant.");
      if (!Number.isFinite(plannedDurationHours) || plannedDurationHours <= 0) throw new Error("Planned duration must be greater than zero.");
      const data = {
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? ""),
        gmNotes: String(form.get("gmNotes") ?? ""),
        status: "draft",
        locationId: String(form.get("locationId") ?? "").trim() || null,
        plannedDurationHours,
        availableActivities: form.getAll("availableActivities").map(String),
        participants: participantRecords(actorUuids)
      };
      const session = this.sessionId
        ? await this.constructor.services.sessions.update(this.sessionId, data)
        : await this.constructor.services.sessions.create(data);
      ui.notifications.info(`${session.name} ${this.sessionId ? "updated" : "saved as a draft"}.`);
      await this.close();
      await this.constructor.services.onCreated?.(session);
    } catch (error) {
      ui.notifications.error(`Could not create Session: ${error.message}`);
      target.disabled = false;
    }
  }
}
