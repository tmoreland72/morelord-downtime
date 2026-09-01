import { MODULE_ID, STATE_SETTING } from "../constants.mjs";

const emptyState = () => ({ schemaVersion: 1, projects: {}, segments: {}, sessions: {}, consumedDayKeys: [] });

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
    const state = this.getStateAdapter
      ? await this.getStateAdapter()
      : game.settings.get(MODULE_ID, STATE_SETTING);
    return structuredClone({ ...emptyState(), ...(state ?? {}) });
  }

  async write(state) {
    const value = structuredClone(state);
    if (this.setStateAdapter) await this.setStateAdapter(value);
    else await game.settings.set(MODULE_ID, STATE_SETTING, value);
    return value;
  }
}
