export const MODULE_ID = "morelord-downtime";
export const STATE_SETTING = "projectState";
export const PROJECT_SCHEMA_VERSION = 1;

export const PROJECT_STATUSES = Object.freeze([
  "planned", "active", "paused", "waiting", "completed",
  "awaiting-collection", "cancelled", "failed"
]);

export const PROGRESS_MODES = Object.freeze(["effort", "elapsed", "hybrid"]);
export const SESSION_STATUSES = Object.freeze(["draft", "upcoming", "active", "finalized", "cancelled"]);
