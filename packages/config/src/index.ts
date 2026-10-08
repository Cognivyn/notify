export * from "./manager.js";

export interface NotifyConfig {
  defaults?: Record<string, unknown>;
  channels?: Record<string, Record<string, unknown>>;
}
