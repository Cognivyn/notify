export interface AuthProvider {
  readonly name: string;
  validate(): void;
  headers(): Record<string, string>;
  /** Redacted summary for logging — never includes secrets. */
  describe(): string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuthError(`${field} must be a non-empty string`);
  }
}

/** API Key authentication (SendGrid, Mailgun, etc.). */
export class ApiKeyAuth implements AuthProvider {
  readonly name = "apiKey";
  constructor(
    private apiKey: string,
    private headerName = "Authorization",
    private scheme: string | null = "Bearer",
  ) {
    this.validate();
  }

  validate(): void {
    assertNonEmpty(this.apiKey, "apiKey");
  }

  headers(): Record<string, string> {
    return {
      [this.headerName]: this.scheme ? `${this.scheme} ${this.apiKey}` : this.apiKey,
    };
  }

  describe(): string {
    return `ApiKeyAuth(header=${this.headerName}, key=***${this.apiKey.slice(-4)})`;
  }

  static fromEnv(env: Record<string, string | undefined> = process.env, key = "NOTIFY_API_KEY"): ApiKeyAuth {
    const v = env[key];
    if (!v) throw new AuthError(`Missing env var ${key}`);
    return new ApiKeyAuth(v);
  }
}

/** OAuth-style Client ID / Client Secret authentication. */
export class ClientSecretAuth implements AuthProvider {
  readonly name = "clientSecret";
  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {
    this.validate();
  }

  validate(): void {
    assertNonEmpty(this.clientId, "clientId");
    assertNonEmpty(this.clientSecret, "clientSecret");
  }

  headers(): Record<string, string> {
    const token = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    return { Authorization: `Basic ${token}` };
  }

  /** Exchange credentials for a bearer token shape (no network — caller injects fetcher). */
  async getBearerToken(
    tokenFetcher: (id: string, secret: string) => Promise<string>,
  ): Promise<string> {
    return tokenFetcher(this.clientId, this.clientSecret);
  }

  describe(): string {
    return `ClientSecretAuth(clientId=${this.clientId}, secret=***)`;
  }

  static fromEnv(
    env: Record<string, string | undefined> = process.env,
    idKey = "NOTIFY_CLIENT_ID",
    secretKey = "NOTIFY_CLIENT_SECRET",
  ): ClientSecretAuth {
    const id = env[idKey];
    const secret = env[secretKey];
    if (!id) throw new AuthError(`Missing env var ${idKey}`);
    if (!secret) throw new AuthError(`Missing env var ${secretKey}`);
    return new ClientSecretAuth(id, secret);
  }
}

/** Factory: build the right provider from a generic credential bag. */
export function createAuthProvider(input: {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
}): AuthProvider {
  if (input.apiKey) return new ApiKeyAuth(input.apiKey);
  if (input.clientId && input.clientSecret)
    return new ClientSecretAuth(input.clientId, input.clientSecret);
  throw new AuthError("Provide either apiKey or clientId+clientSecret");
}
