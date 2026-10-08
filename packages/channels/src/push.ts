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
