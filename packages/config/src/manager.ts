export class ConfigManager {
  private store = new Map<string, unknown>();
  constructor(initial: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(initial)) this.store.set(k, v);
  }
  get<T = unknown>(key: string, fallback?: T): T | undefined {
    return (this.store.has(key) ? this.store.get(key) : fallback) as T | undefined;
  }
  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
  list(): Record<string, unknown> {
    return Object.fromEntries(this.store.entries());
  }
}
