import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@notify/types";

export type WhatsAppMediaType = "image" | "document" | "audio" | "video" | "text";

export interface WhatsAppMessage extends NotificationPayload {
  template?: string;
  mediaUrl?: string;
  mediaType?: WhatsAppMediaType;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendWhatsApp(msg: { to: string; body: string; mediaUrl?: string }): Promise<{ messageId: string }>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock";
  sent: Array<{ to: string; body: string }> = [];
  async sendWhatsApp(msg: { to: string; body: string }) {
    this.sent.push(msg);
    return { messageId: `wa-mock-${this.sent.length}` };
  }
}

const ALLOWED_MEDIA = new Set(["image", "document", "audio", "video", "text"]);

export function validateWhatsApp(msg: WhatsAppMessage): void {
  if (!/^\+[1-9]\d{7,14}$/.test(msg.to)) throw new Error(`Invalid phone: ${msg.to}`);
  if (!msg.body?.trim() && !msg.template) throw new Error("body or template required");
  const mt = (msg.mediaType ?? "text") as string;
  if (!ALLOWED_MEDIA.has(mt)) throw new Error(`Unsupported media type: ${mt}`);
  if (msg.mediaUrl && !/^https?:\/\//.test(msg.mediaUrl)) throw new Error("mediaUrl must be http(s)");
}

export class WhatsAppChannel implements ChannelAdapter {
  readonly channel = "whatsapp" as const;
  constructor(private provider: WhatsAppProvider = new MockWhatsAppProvider()) {}
  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    try {
      const msg = payload as WhatsAppMessage;
      validateWhatsApp(msg);
      const body = msg.template
        ? msg.template.replace("{{body}}", msg.body)
        : msg.body;
      const { messageId } = await this.provider.sendWhatsApp({
        to: msg.to,
        body,
        mediaUrl: msg.mediaUrl,
      });
      return { success: true, channel: "whatsapp", messageId };
    } catch (e) {
      return { success: false, channel: "whatsapp", error: e instanceof Error ? e.message : String(e) };
    }
  }
}
