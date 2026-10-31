import { trainingDefault } from "../../domain/project-defaults.mjs";
import { createProject } from "../../domain/project.mjs";
import { locationAllowsSpecialty } from "../../domain/instructor-specialty.mjs";

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

/** A player-character instructor spends the same session hours as the student. */
export function characterInstructorUuid(project) {
  const instructor = project?.metadata?.training?.instructor ?? {};
  const mode = String(instructor.mode ?? "");
  if (mode === "npc" || mode === "provider") return null;
  const actorUuid = String(instructor.actorUuid ?? "").trim();
  if (actorUuid) return actorUuid;
  const role = (project?.participants ?? []).find(entry => entry.role === "instructor");
  return String(role?.actorUuid ?? "").trim() || null;
}

/** Actor.abc and abc are the same world actor. Token UUIDs are resolved before this comparison. */
export function sameActor(left, right) {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const actorId = value => {
    if (value.includes("Token.")) return "";
    return value.startsWith("Actor.") ? value.slice("Actor.".length) : (value.includes(".") ? "" : value);
  };
  const aId = actorId(a);
  const bId = actorId(b);
  return Boolean(aId) && aId === bId;
}

export function withCharacterInstructor(project, participantActorUuids = [], instructorUuid = characterInstructorUuid(project)) {
  const actors = [...new Set((participantActorUuids ?? []).map(String).filter(Boolean))];
  if (instructorUuid && !actors.some(uuid => sameActor(uuid, instructorUuid))) actors.push(instructorUuid);
  return actors;
}

export function trainingAudience(project, ownedUuids = []) {
  const owned = [...ownedUuids].map(String);
  const owns = uuid => owned.some(id => sameActor(id, uuid));
  const instructorUuid = characterInstructorUuid(project);
  const instructs = Boolean(instructorUuid && owns(instructorUuid));
  const ownsStudent = owns(project?.owner?.uuid);
  const studentName = project?.owner?.name || "the student";
  return {
    instructs,
    ownsStudent,
    readOnly: instructs && !ownsStudent,
    listName: instructs && !ownsStudent ? `Instructing ${studentName}` : (project?.name ?? "")
  };
}

export function canProgressTraining(project, { segment, participantActorUuids = [], location = null } = {}) {
  const training = project.metadata?.training;
  if (!training) return { passed: false, reasons: ["Training metadata is missing."] };
  if (segment?.source === "journey" && !training.travelCompatible) {
    return { passed: false, reasons: ["This training cannot be performed while traveling."] };
  }
  const instructor = training.instructor ?? { mode: "none" };
  if (instructor.mode === "participant") {
    const participant = project.participants.find(entry => entry.actorUuid === instructor.actorUuid && entry.role === "instructor");
    if (!participant && !participantActorUuids.some(uuid => sameActor(uuid, instructor.actorUuid))) {
      return { passed: false, reasons: ["The character instructor is not a Project participant."] };
    }
    if (!participantActorUuids.some(uuid => sameActor(uuid, instructor.actorUuid))) {
      return { passed: false, reasons: ["The instructor must allocate the same hours."] };
    }
  } else if (instructor.mode === "npc") {
    if (!instructor.name) return { passed: false, reasons: ["The NPC instructor needs a name."] };
    if (project.locationId && segment?.locationId !== project.locationId) {
      return { passed: false, reasons: ["The NPC instructor is only available at the Project's Location."] };
    }
    if (location && !locationAllowsSpecialty(location, "instructor", training.proficiencyId)) {
      return { passed: false, reasons: ["This Location's Instructor cannot teach that subject."] };
    }
  } else if (instructor.mode === "provider") {
    if (!project.provider || (instructor.providerId && project.provider.id !== instructor.providerId)) {
      return { passed: false, reasons: ["The selected instructor provider is unavailable."] };
    }
    if (project.provider.locationId && segment?.locationId && project.provider.locationId !== segment.locationId) {
      return { passed: false, reasons: ["The instructor provider is not available at this Location."] };
    }
    if (!locationAllowsSpecialty({ capabilities: project.provider.capabilities ?? [] }, "instructor", training.proficiencyId)) {
      return { passed: false, reasons: ["The provider cannot teach this proficiency."] };
    }
  } else {
    return { passed: false, reasons: ["Training requires an instructor."] };
  }
  return { passed: true, reasons: [] };
}

export function trainingSummary(project) {
  const training = project.metadata?.training;
  return `${training?.proficiencyLabel ?? project.name}: ${project.progress.effort.completedHours} / ${project.progress.effort.requiredHours} hours`;
}
