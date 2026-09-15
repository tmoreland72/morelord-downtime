import { trainingDefault } from "../../domain/project-defaults.mjs";
import { createProject } from "../../domain/project.mjs";

export const TRAINING_ACTIVITY_ID = "training";
export const TRAINING_KINDS = Object.freeze(["artisanTool", "toolProficiency", "skillProficiency", "language", "armorProficiency", "weaponProficiency", "weaponMastery"]);

export function createTrainingProject(data = {}, options = {}) {
  const rawKind = String(data.kind ?? "");
  const kind = rawKind === "tool" ? "toolProficiency" : rawKind;
  if (!TRAINING_KINDS.includes(kind)) throw new Error("Training kind must be a supported D&D5e proficiency or weapon mastery.");
  const proficiencyId = String(data.proficiencyId ?? "").trim();
  const proficiencyLabel = String(data.proficiencyLabel ?? proficiencyId).trim();
  if (!proficiencyId) throw new Error("Training requires a proficiency id.");
  const instructor = {
    mode: String(data.instructor?.mode ?? "none"),
    actorUuid: data.instructor?.actorUuid ? String(data.instructor.actorUuid) : null,
    providerId: data.instructor?.providerId ? String(data.instructor.providerId) : null,
    name: data.instructor?.name ? String(data.instructor.name) : null
  };
  const participants = [...(data.participants ?? [])];
  if (instructor.mode === "participant" && instructor.actorUuid && !participants.some(entry => (entry.actorUuid ?? entry.uuid) === instructor.actorUuid)) {
    participants.push({ actorUuid: instructor.actorUuid, role: "instructor", approved: true });
  }
  const defaultName = {
    artisanTool: `Learn ${proficiencyLabel}`,
    toolProficiency: `Learn ${proficiencyLabel}`,
    skillProficiency: `Train ${proficiencyLabel}`,
    language: `Learn ${proficiencyLabel}`,
    armorProficiency: `Train ${proficiencyLabel}`,
    weaponProficiency: `Train ${proficiencyLabel} Proficiency`,
    weaponMastery: `Master ${proficiencyLabel}`
  }[kind];
  return createProject({
    ...data,
    name: data.name ?? defaultName,
    activityType: TRAINING_ACTIVITY_ID,
    participants,
    status: data.status ?? "active",
    progress: {
      mode: "effort",
      effort: { requiredHours: Number(data.requiredHours ?? trainingDefault(kind, data.intelligenceModifier).hours), completedHours: Number(data.completedHours ?? 0) }
    },
    metadata: {
      ...(data.metadata ?? {}),
      training: {
        kind,
        proficiencyId,
        proficiencyLabel,
        travelCompatible: data.travelCompatible !== false,
        instructor,
        proficiencyAwarded: data.metadata?.training?.proficiencyAwarded === true,
        awardMessage: data.metadata?.training?.awardMessage ?? null
      }
    }
  }, options);
}

export function canProgressTraining(project, { segment, participantActorUuids = [] } = {}) {
  const training = project.metadata?.training;
  if (!training) return { passed: false, reasons: ["Training metadata is missing."] };
  if (segment?.source === "journey" && !training.travelCompatible) {
    return { passed: false, reasons: ["This training cannot be performed while traveling."] };
  }
  const instructor = training.instructor ?? { mode: "none" };
  if (instructor.mode === "participant") {
    const participant = project.participants.find(entry => entry.actorUuid === instructor.actorUuid && entry.role === "instructor");
    if (!participant) return { passed: false, reasons: ["The character instructor is not a Project participant."] };
    if (!participantActorUuids.includes(instructor.actorUuid)) return { passed: false, reasons: ["The instructor must allocate the same hours."] };
  } else if (instructor.mode === "npc") {
    if (!instructor.name) return { passed: false, reasons: ["The NPC instructor needs a name."] };
    if (project.locationId && segment?.locationId !== project.locationId) {
      return { passed: false, reasons: ["The NPC instructor is only available at the Project's Location."] };
    }
  } else if (instructor.mode === "provider") {
    if (!project.provider || (instructor.providerId && project.provider.id !== instructor.providerId)) {
      return { passed: false, reasons: ["The selected instructor provider is unavailable."] };
    }
    if (project.provider.locationId && segment?.locationId && project.provider.locationId !== segment.locationId) {
      return { passed: false, reasons: ["The instructor provider is not available at this Location."] };
    }
    const capability = project.provider.capabilities.find(entry =>
      entry.type === "instructor"
      && (!entry.specialty || entry.specialty === training.proficiencyId)
    );
    if (!capability) return { passed: false, reasons: ["The provider cannot teach this proficiency."] };
  } else {
    return { passed: false, reasons: ["Training requires an instructor."] };
  }
  return { passed: true, reasons: [] };
}

export function trainingSummary(project) {
  const training = project.metadata?.training;
  return `${training?.proficiencyLabel ?? project.name}: ${project.progress.effort.completedHours} / ${project.progress.effort.requiredHours} hours`;
}
