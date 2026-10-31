import { MODULE_ID, STATE_SETTING } from "../constants.mjs";
import { createSession } from "../domain/session.mjs";

const emptyState = () => ({
  schemaVersion: 1,
  projects: {},
  segments: {},
  sessions: {},
  consumedDayKeys: [],
  craftTimeLedger: {},
  craftTimeLedgerInitialized: false
});

function dropWaiveLocation(value) {
  if (!value || typeof value !== "object") return false;
  let changed = false;
  if (Array.isArray(value)) {
    for (const entry of value) if (dropWaiveLocation(entry)) changed = true;
    return changed;
  }
  if (Object.prototype.hasOwnProperty.call(value, "waiveLocation")) {
    delete value.waiveLocation;
    changed = true;
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && dropWaiveLocation(child)) changed = true;
  }
  return changed;
}

export class ProjectRepository {
  constructor({ getState = null, setState = null } = {}) {
    this.getStateAdapter = getState;
    this.setStateAdapter = setState;
  }

  registerSetting() {
    game.settings.register(MODULE_ID, STATE_SETTING, {
      scope: "world", config: false, type: Object, default: emptyState(), restricted: true
    });
  }

  async read() {
    const state = structuredClone({
      ...emptyState(),
      ...(this.getStateAdapter ? await this.getStateAdapter() : game.settings.get(MODULE_ID, STATE_SETTING) ?? {})
    });
    let changed = false;
    for (const project of Object.values(state.projects ?? {})) {
      if (dropWaiveLocation(project)) changed = true;
    }
    for (const [id, session] of Object.entries(state.sessions ?? {})) {
      if (!session?.name || !Array.isArray(session.participants) || !session.participants.length) continue;
      if (session.status !== "draft" && session.status !== "upcoming") continue;
      const source = { ...session, status: "pending" };
      state.sessions[id] = createSession(source);
      changed = true;
    }
    if (changed && !this.getStateAdapter) await this.write(state);
    return state;
  }

  async write(state) {
    for (const project of Object.values(state.projects ?? {})) dropWaiveLocation(project);
    const value = structuredClone(state);
    if (this.setStateAdapter) await this.setStateAdapter(value);
    else await game.settings.set(MODULE_ID, STATE_SETTING, value);
    return value;
  }
}
