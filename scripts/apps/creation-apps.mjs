import { ItemPickerApp } from "../../../morelord-core/scripts/ui/item-picker-app.js";
import { trainingDefault, commissionDefault } from "../domain/project-defaults.mjs";
import { assertNpcInstructorSpecialty, filterNpcTrainingChoices } from "../domain/instructor-specialty.mjs";
import { listCharacterActors } from "../../../morelord-core/scripts/ui/actor-participation.js";
import { projectManagementActions, projectManagementContext } from "./project-management.mjs";
import { DowntimeApplication } from "./downtime-application.mjs";
import { openProjectTypeGuide } from "../ui/project-type-guide.mjs";
import { getCoreParticipation } from "../integrations/core-api.mjs";

const characterChoices = (options = {}) => getCoreParticipation().listCharacterChoices(options);

async function worldActorUuid(uuid) {
  const value = String(uuid ?? "").trim();
  if (!value || typeof globalThis.fromUuid !== "function") return null;
  try {
    const document = await fromUuid(value);
    const actor = document?.documentName === "Actor" ? document : document?.actor;
    if (!actor?.uuid) return null;
    return { uuid: actor.uuid, name: actor.name ?? null };
  } catch {
    return null;
  }
}
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

  constructor({ choices = [], selectedValue = "", onSelect = null, emptyTitle = null, emptyDetail = null } = {}) {
    super();
    this.choices = choices;
    this.selectedValue = selectedValue;
    this.onSelect = onSelect;
    this.category = "all";
    this.emptyTitle = emptyTitle;
    this.emptyDetail = emptyDetail;
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
      resultCount: this.choices.length,
      emptyTitle: this.emptyTitle ?? "No Matching Training",
      emptyDetail: this.emptyDetail ?? "Change the search text or category filter."
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
    const actors = listCharacterActors();
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
      selectedTraining,
      requiredHours: project?.progress?.effort?.requiredHours ?? "",
      canEditRequiredHours: game.user?.isGM === true,
      trainingGuidance: selectedTraining ? trainingDefault(selectedTraining.kind, game.actors.get(defaultStudentUuid.split(".").at(-1))?.system?.abilities?.int?.mod).guidance : ""
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
    this.element.querySelector('[name="ownerUuid"]')?.addEventListener("change", () => {
      if (!this.projectId && !this.trainingHoursEdited) this.updateTrainingDefault();
    });
    this.element.querySelector('[name="requiredHours"]')?.addEventListener("input", () => { this.trainingHoursEdited = true; });
    const locationField = this.element.querySelector('[name="locationId"]');
    const enforceNpcSpecialty = () => {
      if ((instructor?.value ?? "") !== "npc") return;
      if (this.npcTrainingChoices("npc").some(choice => choice.value === this.selectedTrainingValue)) return;
      this.selectedTrainingValue = "";
      const input = this.element.querySelector('[name="proficiency"]');
      if (input) input.value = "";
      const label = this.element.querySelector("[data-selected-training-label]");
      const category = this.element.querySelector("[data-selected-training-category]");
      if (label) label.textContent = "No training selected";
      if (category) category.textContent = "This Location's Instructor cannot teach the previously selected subject.";
      const hours = this.element.querySelector("[data-training-hours]");
      if (hours) hours.hidden = true;
    };
    instructor?.addEventListener("change", () => { refresh(); enforceNpcSpecialty(); });
    locationField?.addEventListener("change", enforceNpcSpecialty);
    refresh();
  }

  updateTrainingDefault() {
    const choice = this.trainingCatalog.find(item => item.value === this.selectedTrainingValue);
    if (!choice) return;
    const ownerUuid = this.element.querySelector('[name="ownerUuid"]')?.value ?? "";
    const actor = game.actors.get(ownerUuid.split(".").at(-1));
    const defaults = trainingDefault(choice.kind, actor?.system?.abilities?.int?.mod);
    this.element.querySelector("[data-training-hours]").hidden = false;
    if (!this.projectId || game.user?.isGM === true) {
      for (const input of this.element.querySelectorAll('[name="requiredHours"]')) input.value = defaults.hours;
    }
    this.element.querySelector("[data-training-guidance]").textContent = defaults.guidance;
  }

  npcTrainingChoices(instructorSelection) {
    const knownInstructor = this.trainingCatalog.filter(choice => !instructorSelection
      || instructorSelection === "npc"
      || choice.instructorUuids.split("|").filter(Boolean).includes(instructorSelection));
    if (instructorSelection !== "npc") return knownInstructor;
    const locationId = this.element.querySelector('[name="locationId"]')?.value ?? "";
    const location = locationId ? this.constructor.services.locations()?.get?.(locationId) ?? null : null;
    return filterNpcTrainingChoices(knownInstructor, location);
  }

  static selectTraining(event) {
    event.preventDefault();
    const instructorSelection = this.element.querySelector('[name="instructorSelection"]')?.value ?? "";
    const locationId = this.element.querySelector('[name="locationId"]')?.value ?? "";
    const choices = this.npcTrainingChoices(instructorSelection);
    const restricted = instructorSelection === "npc" && locationId;
    return new TrainingSelectionApp({
      choices,
      emptyTitle: restricted ? "No Instructor Specialty" : null,
      emptyDetail: restricted ? "This Location's Instructor cannot teach the subjects in the current list." : null,
      selectedValue: this.selectedTrainingValue,
      onSelect: choice => {
        this.selectedTrainingValue = choice.value;
        const input = this.element.querySelector('[name="proficiency"]');
        if (input) input.value = choice.value;
        const label = this.element.querySelector("[data-selected-training-label]");
        const category = this.element.querySelector("[data-selected-training-category]");
        if (label) label.textContent = choice.label;
        if (category) category.textContent = choice.category;
        this.trainingHoursEdited = false;
        this.updateTrainingDefault();
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
      const selectedInstructor = instructorSelection === "npc" ? null : await worldActorUuid(instructorSelection);
      const instructorUuid = selectedInstructor?.uuid ?? (instructorSelection === "npc" ? null : instructorSelection);
      const instructorName = selectedInstructor?.name
        ?? this.element.querySelector('[name="instructorSelection"] option:checked')?.textContent?.trim()
        ?? null;
      const npcInstructorName = String(form.get("npcInstructorName") ?? "").trim();
      const [kind, proficiencyId] = String(form.get("proficiency") ?? "").split(":", 2);
      const requiredHours = Number(form.get("requiredHours"));
      const selected = this.trainingCatalog.find(choice => choice.value === `${kind}:${proficiencyId}`);
      if (!ownerUuid || !instructorSelection) throw new Error("Choose both a student and an instructor.");
      if (instructorSelection === "npc" && !npcInstructorName) throw new Error("Enter the NPC instructor's name.");
      if (ownerUuid === instructorUuid) throw new Error("The student and instructor must be different characters.");
      if (!proficiencyId || !this.constructor.services.proficiencies.supports(kind)) throw new Error("Choose a specific training proficiency.");
      if (!Number.isFinite(requiredHours) || requiredHours <= 0) throw new Error("Required hours must be greater than zero.");
      const locationId = String(form.get("locationId") ?? "").trim() || null;
      if (instructorSelection === "npc") {
        const location = locationId ? this.constructor.services.locations()?.get?.(locationId) ?? null : null;
        assertNpcInstructorSpecialty({ instructor: { mode: "npc" }, locationId, proficiencyId }, location);
      }
      const data = {
        kind, proficiencyId, requiredHours,
        proficiencyLabel: selected?.label ?? proficiencyId,
        locationId,
        owner: { uuid: ownerUuid, name: game.actors.get(ownerUuid.split(".").at(-1))?.name ?? null },
        instructor: instructorSelection === "npc" ? { mode: "npc", name: npcInstructorName } : { mode: "participant", actorUuid: instructorUuid, name: instructorName },
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
    actions: { ...projectManagementActions, save: CommissionProjectApp.save, selectItem: CommissionProjectApp.selectItem }
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
      requiredDays: project?.progress?.elapsed?.requiredDays ?? "",
      owners: owners.map(owner => ({ ...owner, selected: owner.uuid === defaultOwnerUuid })),
      locations: (this.constructor.services.locations()?.list?.() ?? []).map(location => ({ ...location, selected: location.id === project?.locationId }))
    };
  }

  static selectItem(event) {
    event.preventDefault();
    return new ItemPickerApp({ onSelect: item => {
      const defaults = commissionDefault(item);
      this.element.querySelector('[name="itemUuid"]').value = item.uuid;
      this.element.querySelector('[name="itemDescription"]').value = item.name;
      this.element.querySelector("[data-commission-item]").textContent = item.name;
      this.element.querySelector('[name="requiredDays"]').value = defaults.days ?? "";
      this.element.querySelector("[data-commission-guidance]").textContent = defaults.guidance;
    } }).render({ force: true });
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
        itemUuid: String(form.get("itemUuid") ?? ""),
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
    position: { width: 620, height: 760 },
    window: { title: "New Project", icon: "fa-solid fa-folder-plus", resizable: true },
    actions: { choose: NewProjectApp.choose, explain: NewProjectApp.explain }
  };
  static PARTS = { content: { template: "modules/morelord-downtime/templates/new-project.hbs" } };

  async _prepareContext(options) {
    return {
      ...await super._prepareContext(options),
      activityTypes: this.constructor.services.activities.list({ availableOnly: true }).filter(activity => activity.showInProjectCreation).map(activity => ({
        id: activity.id,
        name: activity.name,
        icon: activity.icon,
        description: activity.description,
        actionLabel: activity.actionLabel,
        actionIcon: activity.actionIcon
      }))
    };
  }

  static explain(event) {
    event.preventDefault();
    return openProjectTypeGuide();
  }

  static async choose(event, target) {
    event.preventDefault();
    const activity = this.constructor.services.activities.get(target.dataset.activityId);
    if (!activity?.isAvailable()) return ui.notifications.warn("This activity's content pack is unavailable.");
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

  _onRender(context, options) {
    super._onRender(context, options);
    const days = this.element.querySelector('[name="days"]');
    const hours = this.element.querySelector('[name="plannedDurationHours"]');
    days?.addEventListener("input", () => {
      const raw = days.value.trim();
      if (!raw || !hours) return;
      const count = Number(raw);
      if (Number.isInteger(count) && count >= 1) hours.value = String(count * 8);
    });
  }

  async _prepareContext(options) {
    const session = this.sessionId ? await this.constructor.services.sessions.get(this.sessionId) : null;
    const participantIds = new Set(session?.participants.map(entry => entry.actorUuid) ?? []);
    const activityIds = new Set(session?.availableActivities ?? []);
    const readOnly = globalThis.game?.user ? game.user.isGM !== true : false;
    return {
      ...await super._prepareContext(options),
      isEditing: Boolean(session),
      readOnly,
      session,
      actors: characterChoices({ selectedUuids: session ? participantIds : null }),
      locations: (this.constructor.services.locations()?.list?.() ?? []).map(location => ({ ...location, selected: location.id === session?.locationId })),
      activityTypes: this.constructor.services.activities.list({ availableOnly: true }).filter(activity => activity.availableInSessions).map(activity => ({ id: activity.id, name: activity.name, icon: activity.icon, checked: !session || activityIds.has(activity.id) }))
    };
  }

  static async create(event, target) {
    event.preventDefault();
    if (globalThis.game?.user && game.user.isGM !== true) {
      ui.notifications.error("Only a GM may change Downtime Sessions.");
      return;
    }
    const form = new FormData(this.element);
    target.disabled = true;
    try {
      const actorUuids = selectedCharacterUuids(form);
      const daysRaw = String(form.get("days") ?? "").trim();
      const hoursRaw = String(form.get("plannedDurationHours") ?? "").trim();
      const plannedDurationHours = Number(hoursRaw);
      const existing = this.sessionId ? await this.constructor.services.sessions.get(this.sessionId) : null;
      const unavailableActivities = (existing?.availableActivities ?? []).filter(id => this.constructor.services.activities.get(id)?.isAvailable() === false);
      if (!actorUuids.length) throw new Error("Select at least one participant.");
      if (!hoursRaw || !Number.isFinite(plannedDurationHours) || plannedDurationHours <= 0) throw new Error("Hours must be greater than 0.");
      let days = null;
      if (daysRaw) {
        days = Number(daysRaw);
        if (!Number.isInteger(days) || days < 1) throw new Error("Days must be a whole number of at least 1.");
      }
      const data = {
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? ""),
        gmNotes: String(form.get("gmNotes") ?? ""),
        locationId: String(form.get("locationId") ?? "").trim() || null,
        days,
        plannedDurationHours,
        availableActivities: [...new Set([...form.getAll("availableActivities").map(String), ...unavailableActivities])],
        participants: participantRecords(actorUuids)
      };
      const session = this.sessionId
        ? await this.constructor.services.sessions.update(this.sessionId, data)
        : await this.constructor.services.sessions.create(data);
      ui.notifications.info(`${session.name} ${this.sessionId ? "updated" : "saved"}.`);
      await this.close();
      await this.constructor.services.onCreated?.(session);
    } catch (error) {
      ui.notifications.error(`Could not create Session: ${error.message}`);
      target.disabled = false;
    }
  }
}
