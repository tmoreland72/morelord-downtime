import { MODULE_ID } from "../constants.mjs";

const CHANNEL = `module.${MODULE_ID}`;

export class AllocationAuthorityService {
  constructor({ segments, projects, sessions, isPrimaryGm, getTraining = () => null, getCommission = () => null, getSourceItem = () => null, timeoutMs = 10000 }) {
    this.segments = segments;
    this.projects = projects;
    this.sessions = sessions;
    this.getTraining = getTraining;
    this.getCommission = getCommission;
    this.getSourceItem = getSourceItem;
    this.isPrimaryGm = isPrimaryGm;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
  }

  start() {
    game.socket.on(CHANNEL, message => void this.#receive(message));
  }

  async allocate(input) {
    if (game.user.isGM) return this.segments.allocate(input);
    return this.#request("allocation", input);
  }

  async createTraining(input) {
    if (game.user.isGM) return this.getTraining().createProject(input);
    return this.#request("training", input);
  }

  async updateTraining(projectId, input) {
    const request = { projectId: String(projectId), input };
    if (game.user.isGM) return this.getTraining().updateProject(request.projectId, request.input);
    return this.#request("trainingUpdate", request);
  }

  async createCommission(input) {
    if (game.user.isGM) return this.getCommission().createProject(input);
    return this.#request("commission", input);
  }

  async updateCommission(projectId, input) {
    const request = { projectId: String(projectId), input };
    if (game.user.isGM) return this.getCommission().updateProject(request.projectId, request.input);
    return this.#request("commissionUpdate", request);
  }

  async createSourceItem(input) {
    if (game.user.isGM) return this.getSourceItem().createProject(input);
    return this.#request("sourceItem", input);
  }

  async updateSourceItem(projectId, input) {
    const request = { projectId: String(projectId), input };
    if (game.user.isGM) return this.getSourceItem().updateProject(request.projectId, request.input);
    return this.#request("sourceItemUpdate", request);
  }

  async negotiateSourceItem(projectId, roll) {
    const input = { projectId: String(projectId), roll };
    if (game.user.isGM) return this.getSourceItem().negotiate(input.projectId, input.roll);
    return this.#request("sourceItemPersuasion", input);
  }

  async planProject(sessionId, projectId) {
    const input = { sessionId: String(sessionId), projectId: String(projectId) };
    if (game.user.isGM) return this.sessions.planProject(input.sessionId, input.projectId);
    return this.#request("planning", input);
  }

  async cancelProject(projectId) {
    const input = { projectId: String(projectId) };
    if (game.user.isGM) return this.projects.cancel(input.projectId);
    return this.#request("projectCancellation", input);
  }

  async deleteProject(projectId) {
    const input = { projectId: String(projectId) };
    if (game.user.isGM) return this.projects.removeUnused(input.projectId, { allowCancelled: true });
    return this.#request("projectDeletion", input);
  }

  async collectProject(projectId) {
    const input = { projectId: String(projectId) };
    if (game.user.isGM) return this.projects.collect(input.projectId);
    return this.#request("projectCollection", input);
  }

  #request(kind, input) {
    const requestId = foundry.utils.randomID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`The GM did not respond to the ${kind} request.`));
      }, this.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      game.socket.emit(CHANNEL, { type: `${kind}.request`, requestId, userId: game.user.id, input });
    });
  }

  async #receive(message = {}) {
    if (message.type?.endsWith(".response") && message.userId === game.user.id) {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
      return;
    }
    if (!message.type?.endsWith(".request") || !this.isPrimaryGm()) return;
    const kind = message.type.split(".")[0];
    try {
      let result;
      if (kind === "allocation") {
        await this.#authorizeAllocation(message.userId, message.input);
        result = await this.segments.allocate(message.input);
      } else if (kind === "training") {
        const input = await this.#authorizeTraining(message.userId, message.input);
        result = await this.getTraining().createProject(input);
      } else if (kind === "trainingUpdate") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        result = await this.getTraining().updateProject(message.input.projectId, message.input.input);
      } else if (kind === "commission") {
        await this.#authorizeOwnedActor(message.userId, message.input.owner?.uuid);
        result = await this.getCommission().createProject(message.input);
      } else if (kind === "commissionUpdate") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        await this.#authorizeOwnedActor(message.userId, message.input.input.owner?.uuid);
        result = await this.getCommission().updateProject(message.input.projectId, message.input.input);
      } else if (kind === "sourceItem") {
        await this.#authorizeOwnedActor(message.userId, message.input.owner?.uuid);
        result = await this.getSourceItem().createProject(message.input);
      } else if (kind === "sourceItemUpdate") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        await this.#authorizeOwnedActor(message.userId, message.input.input.owner?.uuid);
        result = await this.getSourceItem().updateProject(message.input.projectId, message.input.input);
      } else if (kind === "sourceItemPersuasion") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        result = await this.getSourceItem().negotiate(message.input.projectId, message.input.roll);
      } else if (kind === "planning") {
        await this.#authorizePlanning(message.userId, message.input);
        result = await this.sessions.planProject(message.input.sessionId, message.input.projectId);
      } else if (kind === "projectCancellation") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        result = await this.projects.cancel(message.input.projectId);
      } else if (kind === "projectDeletion") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        result = await this.projects.removeUnused(message.input.projectId, { allowCancelled: true });
      } else if (kind === "projectCollection") {
        await this.#authorizeProjectOwner(message.userId, message.input.projectId);
        result = await this.projects.collect(message.input.projectId);
      } else return;
      game.socket.emit(CHANNEL, { type: `${kind}.response`, requestId: message.requestId, userId: message.userId, result });
    } catch (error) {
      game.socket.emit(CHANNEL, { type: `${kind}.response`, requestId: message.requestId, userId: message.userId, error: error.message });
    }
  }

  async #authorizeAllocation(userId, input = {}) {
    const user = game.users.get(userId);
    if (!user?.active) throw new Error("Requesting player is unavailable.");
    const [project, segment] = await Promise.all([this.projects.get(input.projectId), this.segments.get(input.segmentId)]);
    if (!project || !segment) throw new Error("Project or active Downtime Session not found.");
    const ownerActor = await fromUuid(project.owner.uuid);
    if (!ownerActor?.testUserPermission(user, "OWNER")) throw new Error("You do not control this Project owner.");
    for (const actorUuid of input.participantActorUuids ?? []) {
      if (!segment.participants.some(entry => entry.actorUuid === actorUuid)) throw new Error("A requested Actor is not part of this Downtime Session.");
    }
  }

  async #authorizeTraining(userId, source = {}) {
    const input = structuredClone(source);
    const user = game.users.get(userId);
    if (!user?.active) throw new Error("Requesting player is unavailable.");
    const ownerActor = await fromUuid(input.owner?.uuid);
    if (!ownerActor?.testUserPermission(user, "OWNER")) throw new Error("You do not control the selected student.");
    return input;
  }

  async #authorizePlanning(userId, input = {}) {
    const user = game.users.get(userId);
    if (!user?.active) throw new Error("Requesting player is unavailable.");
    const project = await this.projects.get(input.projectId);
    if (!project) throw new Error("Project not found.");
    const ownerActor = await fromUuid(project.owner.uuid);
    if (!ownerActor?.testUserPermission(user, "OWNER")) throw new Error("You do not control this Project owner.");
  }

  async #authorizeProjectOwner(userId, projectId) {
    const user = game.users.get(userId);
    if (!user?.active) throw new Error("Requesting player is unavailable.");
    const project = await this.projects.get(projectId);
    if (!project) throw new Error("Project not found.");
    const ownerActor = await fromUuid(project.owner.uuid);
    if (!ownerActor?.testUserPermission(user, "OWNER")) throw new Error("You do not control this Project owner.");
  }

  async #authorizeOwnedActor(userId, actorUuid) {
    const user = game.users.get(userId);
    if (!user?.active) throw new Error("Requesting player is unavailable.");
    const actor = await fromUuid(actorUuid);
    if (!actor?.testUserPermission(user, "OWNER")) throw new Error("You do not control the selected Project owner.");
  }
}
