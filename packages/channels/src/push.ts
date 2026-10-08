import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@notify/types";

export interface PushMessage extends NotificationPayload {
  deviceToken?: string;
  deepLink?: string;
}

export interface PushProvider {
  readonly name: string;
  sendPush(msg: { token: string; title: string; body: string; data?: Record<string, unknown> }): Promise<{ messageId: string }>;
}

export class MockPushProvider implements PushProvider {
  readonly name = "mock";
  sent: Array<{ token: string; title: string }> = [];
  async sendPush(msg: { token: string; title: string; body: string }) {
    this.sent.push(msg);
    return { messageId: `push-mock-${this.sent.length}` };
  }
}

export function validateDeviceToken(token: string): void {
  if (!token?.trim()) throw new Error("device token required");
  if (token.length > 4096) throw new Error("device token too long");
}

/** Firebase Cloud Messaging (legacy HTTP API). Supports title/body/data + image. */
export class FcmPushProvider implements PushProvider {
  readonly name = "fcm";
  constructor(
    private serverKey: string,
    private fetchFn: typeof fetch = fetch,
  ) {
    if (!serverKey) throw new Error("FCM serverKey required");
  }
  async sendPush(msg: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    imageUrl?: string;
  }) {
    validateDeviceToken(msg.token);
    if (!msg.title?.trim()) throw new Error("push title required");
    if (!msg.body?.trim()) throw new Error("push body required");
    const res = await this.fetchFn("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { Authorization: `key=${this.serverKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: msg.token,
        notification: { title: msg.title, body: msg.body, ...(msg.imageUrl ? { image: msg.imageUrl } : {}) },
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
  async sendPush(msg: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    imageUrl?: string;
  }) {
    validateDeviceToken(msg.token);
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

export class PushChannel implements ChannelAdapter {
  readonly channel = "push" as const;
  private tokens = new Map<string, Set<string>>();

  constructor(private provider: PushProvider = new MockPushProvider()) {}

  registerToken(userId: string, token: string): void {
    if (!this.tokens.has(userId)) this.tokens.set(userId, new Set());
    this.tokens.get(userId)!.add(token);
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    try {
      const msg = payload as PushMessage;
      const token = msg.deviceToken ?? msg.to;
      if (!token) throw new Error("device token / to required");
      const title = msg.title ?? "Notification";
      if (!msg.body?.trim()) throw new Error("push body required");
      if (msg.deepLink && !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(msg.deepLink) && !msg.deepLink.startsWith("/"))
        throw new Error("invalid deepLink");
      const { messageId } = await this.provider.sendPush({ token, title, body: msg.body, data: msg.data });
      return { success: true, channel: "push", messageId };
    } catch (e) {
      return { success: false, channel: "push", error: e instanceof Error ? e.message : String(e) };
    }
  }
}
