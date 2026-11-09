import { AuthError } from "./providers.js";

/**
 * Secure credential storage.
 * - Memory-first, env fallback.
 * - Never logs secret values (see `describe` / `listKeys`).
 */
export class SecureStore {
  private mem = new Map<string, string>();

  set(key: string, value: string): void {
    if (!key) throw new AuthError("SecureStore key required");
    if (!value) throw new AuthError(`SecureStore value for ${key} must be non-empty`);
    this.mem.set(key, value);
  }

  get(key: string, envFallback = true): string | undefined {
    if (this.mem.has(key)) return this.mem.get(key);
    if (envFallback && typeof process !== "undefined") {
      const v = (process.env as Record<string, string | undefined>)[key];
      if (v) return v;
    }
    return undefined;
  }

  require(key: string): string {
    const v = this.get(key);
    if (!v) throw new AuthError(`Missing credential: ${key}`);
    return v;
  }

  delete(key: string): void {
    this.mem.delete(key);
  }

  /** Key names only — never values. Safe to log. */
  listKeys(): string[] {
    return [...this.mem.keys()];
  }

  clear(): void {
    this.mem.clear();
  }
}
