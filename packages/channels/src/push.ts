import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@cognivyn/types";

export interface PushMessage extends NotificationPayload {
  deviceToken?: string;
  deepLink?: string;
  imageUrl?: string;
}

export interface PushSendOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
}

export interface PushProvider {
  readonly name: string;
  sendPush(msg: PushSendOptions): Promise<{ messageId: string }>;
}

export class MockPushProvider implements PushProvider {
  readonly name = "mock";
  sent: Array<PushSendOptions> = [];
  failNext = false;

  async sendPush(msg: PushSendOptions) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("mock push failure");
    }
    this.sent.push(msg);
    return { messageId: `push-mock-${this.sent.length}` };
  }
}

export function validateDeviceToken(token: string): void {
  if (!token?.trim()) throw new Error("device token required");
  if (token.length > 4096) throw new Error("device token too long");
  if (/[\r\n\0/\\]|\.\./.test(token)) {
    throw new Error("invalid device token: illegal characters or path traversal detected");
  }
}

const BLOCKED_DEEP_LINK_SCHEMES = new Set(["javascript", "data", "vbscript", "file"]);

export function validateDeepLink(link: string): void {
  const trimmed = link.trim();
  if (!trimmed) throw new Error("invalid deepLink");
  if (trimmed.startsWith("//")) {
    throw new Error("invalid deepLink: protocol-relative URL not allowed");
  }
  if (trimmed.startsWith("/")) return;

  const match = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!match) throw new Error("invalid deepLink: missing valid URI scheme");
  const scheme = match[1].toLowerCase();
  if (BLOCKED_DEEP_LINK_SCHEMES.has(scheme)) {
    throw new Error(`invalid deepLink: scheme '${scheme}' is not allowed`);
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\/.+/i.test(trimmed)) {
    throw new Error("invalid deepLink: malformed URI");
  }
}

export interface FcmV1Options {
  projectId: string;
  accessToken: string | (() => Promise<string>);
  fetchFn?: typeof fetch;
}

/**
 * Modern Firebase Cloud Messaging HTTP v1 API provider.
 * Uses Google OAuth 2.0 Bearer tokens (or async token provider) and RFC-compliant payload format.
 */
export class FcmV1PushProvider implements PushProvider {
  readonly name = "fcm-v1";
  private projectId: string;
  private tokenProvider: () => Promise<string>;
  private fetchFn: typeof fetch;

  constructor(options: FcmV1Options) {
    if (!options.projectId) throw new Error("FCM v1 projectId required");
    if (!options.accessToken) throw new Error("FCM v1 accessToken required");
    this.projectId = options.projectId;
    if (typeof options.accessToken === "function") {
      this.tokenProvider = options.accessToken;
    } else {
      const tok = options.accessToken;
      this.tokenProvider = async () => tok;
    }
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async sendPush(msg: PushSendOptions): Promise<{ messageId: string }> {
    validateDeviceToken(msg.token);
    if (!msg.title?.trim()) throw new Error("push title required");
    if (!msg.body?.trim()) throw new Error("push body required");

    const token = await this.tokenProvider();
    if (!token) throw new Error("FCM v1 access token resolved to empty");

    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

    const stringData: Record<string, string> = {};
    if (msg.data) {
      for (const [k, v] of Object.entries(msg.data)) {
        stringData[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
    }

    const payload = {
      message: {
        token: msg.token,
        notification: {
          title: msg.title,
          body: msg.body,
          ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
        },
        ...(Object.keys(stringData).length > 0 ? { data: stringData } : {}),
      },
    };

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = `FCM v1 error: ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string; status?: string } };
        if (errJson?.error?.message) {
          detail = `FCM v1 error: ${errJson.error.message}`;
        }
      } catch {
        // use fallback status
      }
      throw new Error(detail);
    }

    const data = (await res.json()) as { name?: string };
    return { messageId: data.name ?? `fcm-v1-${Date.now()}` };
  }
}

/**
 * @deprecated Google sunset the legacy FCM HTTP serverKey API. Use FcmV1PushProvider for the modern HTTP v1 API.
 */
export class FcmPushProvider implements PushProvider {
  readonly name = "fcm";
  constructor(
    private serverKey: string,
    private fetchFn: typeof fetch = fetch,
  ) {
    if (!serverKey) throw new Error("FCM serverKey required");
  }
  async sendPush(msg: PushSendOptions) {
    validateDeviceToken(msg.token);
    if (!msg.title?.trim()) throw new Error("push title required");
    if (!msg.body?.trim()) throw new Error("push body required");
    const res = await this.fetchFn("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { Authorization: `key=${this.serverKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: msg.token,
        notification: {
          title: msg.title,
          body: msg.body,
          ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
        },
        ...(msg.data ? { data: msg.data } : {}),
      }),
    });
    if (!res.ok) throw new Error(`FCM error: ${res.status}`);
    const data = (await res.json()) as { message_id?: string; messageId?: string };
    return { messageId: String(data.message_id ?? data.messageId ?? "fcm-unknown") };
  }
}

export interface ApnsOptions {
  providerToken: string;
  bundleId: string;
  production?: boolean;
  fetchFn?: typeof fetch;
}

/** Apple Push Notification service provider. Uses a pre-signed JWT provider token (ES256). */
export class ApnsPushProvider implements PushProvider {
  readonly name = "apns";
  private fetchFn: typeof fetch;
  constructor(private opts: ApnsOptions) {
    if (!opts.providerToken) throw new Error("APNs providerToken required");
    if (!opts.bundleId) throw new Error("APNs bundleId required");
    this.fetchFn = opts.fetchFn ?? fetch;
  }
  async sendPush(msg: PushSendOptions) {
    validateDeviceToken(msg.token);
    if (!/^[a-zA-Z0-9._-]+$/.test(msg.token)) {
      throw new Error("invalid APNs device token: illegal characters");
    }
    if (!msg.title?.trim()) throw new Error("push title required");
    if (!msg.body?.trim()) throw new Error("push body required");
    const host = this.opts.production ? "api.push.apple.com" : "api.development.push.apple.com";
    const res = await this.fetchFn(`https://${host}/3/device/${msg.token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${this.opts.providerToken}`,
        "apns-topic": this.opts.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: { title: msg.title, body: msg.body },
          "mutable-content": msg.imageUrl ? 1 : 0,
          ...(msg.imageUrl ? { "media-url": msg.imageUrl } : {}),
        },
        ...(msg.data ?? {}),
      }),
    });
    if (!res.ok) throw new Error(`APNs error: ${res.status}`);
    const apnsId = res.headers.get("apns-id");
    return { messageId: apnsId ?? "apns-unknown" };
  }
}

export interface PushChannelOptions {
  provider?: PushProvider;
  retries?: number;
}

export class PushChannel implements ChannelAdapter {
  readonly channel = "push" as const;
  private provider: PushProvider;
  private retries: number;
  private tokens = new Map<string, Set<string>>();

  constructor(optsOrProvider?: PushChannelOptions | PushProvider) {
    if (optsOrProvider && "sendPush" in optsOrProvider) {
      this.provider = optsOrProvider;
      this.retries = 1;
    } else {
      const opts = optsOrProvider as PushChannelOptions | undefined;
      this.provider = opts?.provider ?? new MockPushProvider();
      this.retries = opts?.retries ?? 1;
    }
  }

  get providerName(): string {
    return this.provider.name;
  }

  registerToken(userId: string, token: string): void {
    if (!this.tokens.has(userId)) this.tokens.set(userId, new Set());
    this.tokens.get(userId)!.add(token);
  }

  getRegisteredTokens(userId: string): string[] {
    return Array.from(this.tokens.get(userId) ?? []);
  }

  async send(payload: NotificationPayload | PushMessage): Promise<DeliveryResult> {
    try {
      const msg = payload as PushMessage;
      const token = msg.deviceToken ?? msg.to;
      if (!token) throw new Error("device token / to required");
      const title = msg.title ?? "Notification";
      if (!msg.body?.trim()) throw new Error("push body required");
      const deepLink = msg.deepLink ?? (payload.data?.deepLink as string | undefined);
      if (deepLink) {
        validateDeepLink(deepLink);
      }

      const imageUrl = msg.imageUrl ?? (payload.data?.imageUrl as string | undefined);

      let lastErr = "";
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const { messageId } = await this.provider.sendPush({
            token,
            title,
            body: msg.body,
            data: msg.data,
            imageUrl,
          });
          return { success: true, channel: "push", messageId };
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (attempt === this.retries) break;
        }
      }
      return { success: false, channel: "push", error: lastErr };
    } catch (e) {
      return { success: false, channel: "push", error: e instanceof Error ? e.message : String(e) };
    }
  }
}
