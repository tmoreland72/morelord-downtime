import { renderPreservingScroll } from "../integrations/core-api.mjs";
import { registerLiveWindow, unregisterLiveWindow } from "./live-window-registry.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DowntimeApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  render(options = {}) {
    return renderPreservingScroll(this, () => super.render(options));
  }
}

export class LiveDowntimeApplication extends DowntimeApplication {
  render(options = {}) {
    registerLiveWindow(this);
    return super.render(options);
  }

  close(options = {}) {
    unregisterLiveWindow(this);
    return super.close(options);
  }
}
