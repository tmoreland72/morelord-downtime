import { Dnd5eProficiencyAdapter } from "../../adapters/dnd5e-proficiency-adapter.mjs";

export class TrainingAwardService {
  constructor({ resolveUuid = uuid => fromUuid(uuid), proficiencyAdapter = null } = {}) {
    this.resolveUuid = resolveUuid;
    this.proficiencyAdapter = proficiencyAdapter ?? new Dnd5eProficiencyAdapter({ resolveUuid });
  }

  async award(project) {
    const training = project.metadata?.training;
    if (!training || training.proficiencyAwarded) return { awarded: false, reason: "already-awarded" };
    const actor = await this.resolveUuid(project.owner.uuid);
    if (!actor || actor.documentName !== "Actor") return { awarded: false, reason: "owner-actor-unavailable" };
    return this.proficiencyAdapter.award(actor, training.kind, training.proficiencyId);
  }
}

export function applyTrainingAwardResult(project, result) {
  const updated = structuredClone(project);
  updated.metadata.training.proficiencyAwarded = result.awarded === true;
  updated.metadata.training.awardMessage = result.awarded
    ? `${updated.metadata.training.proficiencyLabel} proficiency awarded.`
    : `Automatic proficiency award was skipped: ${result.reason}.`;
  updated.history.push({ at: Date.now(), type: result.awarded ? "proficiency-awarded" : "proficiency-award-skipped", data: structuredClone(result) });
  return updated;
}
