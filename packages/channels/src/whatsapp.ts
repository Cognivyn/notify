import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@cognivyn/types";

export type WhatsAppMediaType = "image" | "document" | "audio" | "video" | "text";

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  parameters: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document" | "video";
    text?: string;
    [key: string]: unknown;
  }>;
  sub_type?: string;
  index?: number;
}

export interface WhatsAppMessage extends NotificationPayload {
  template?: string;
  mediaUrl?: string;
  mediaType?: WhatsAppMediaType;
  templateName?: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
  previewUrl?: boolean;
}

export interface WhatsAppSendOptions {
  to: string;
  body: string;
  mediaUrl?: string;
  mediaType?: WhatsAppMediaType;
  templateName?: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
  previewUrl?: boolean;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendWhatsApp(msg: WhatsAppSendOptions): Promise<{ messageId: string }>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock";
  sent: Array<WhatsAppSendOptions> = [];
  failNext = false;

  async sendWhatsApp(msg: WhatsAppSendOptions) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("mock whatsapp failure");
    }
    this.sent.push(msg);
    return { messageId: `wa-mock-${this.sent.length}` };
  }
}

export interface WhatsAppCloudApiOptions {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
}

/**
 * Meta WhatsApp Business Cloud API provider (Graph API v21.0+).
 * Zero external dependencies, supports text, media, and template messages.
 */
export class WhatsAppCloudApiProvider implements WhatsAppProvider {
  readonly name = "cloudapi";
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private fetchFn: typeof fetch;

  constructor(options: WhatsAppCloudApiOptions) {
    if (!options.accessToken) throw new Error("WhatsApp Cloud API accessToken required");
    if (!options.phoneNumberId) throw new Error("WhatsApp Cloud API phoneNumberId required");
    this.accessToken = options.accessToken;
    this.phoneNumberId = options.phoneNumberId;
    this.apiVersion = options.apiVersion ?? "v21.0";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async sendWhatsApp(msg: WhatsAppSendOptions): Promise<{ messageId: string }> {
    const digits = msg.to.replace(/^\+/, "");
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    let payload: Record<string, unknown>;

    if (msg.templateName) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "template",
        template: {
          name: msg.templateName,
          language: { code: msg.languageCode ?? "en_US" },
          ...(msg.components && msg.components.length > 0 ? { components: msg.components } : {}),
        },
      };
    } else if (msg.mediaUrl) {
      const mediaType = msg.mediaType ?? "image";
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: mediaType,
        [mediaType]: {
          link: msg.mediaUrl,
          ...(mediaType !== "audio" && msg.body ? { caption: msg.body } : {}),
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "text",
        text: {
          body: msg.body,
          preview_url: msg.previewUrl ?? false,
        },
      };
    }

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = `WhatsApp Cloud API error: ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson?.error?.message) {
          detail = `WhatsApp Cloud API error: ${errJson.error.message}`;
        }
      } catch {
        // use default status message
      }
      throw new Error(detail);
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    const messageId = data?.messages?.[0]?.id ?? `wa-cloud-${Date.now()}`;
    return { messageId };
  }
}

export interface TwilioWhatsAppOptions {
  accountSid: string;
  authToken: string;
  from: string;
  fetchFn?: typeof fetch;
}

/**
 * Twilio WhatsApp provider using Programmable Messaging API.
 * Automatically handles `whatsapp:` prefixing and HTTP Basic auth.
 */
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = "twilio";
  private accountSid: string;
  private authToken: string;
  private from: string;
  private fetchFn: typeof fetch;

  constructor(options: TwilioWhatsAppOptions) {
    if (!options.accountSid) throw new Error("Twilio accountSid required");
    if (!/^[a-zA-Z0-9_-]+$/.test(options.accountSid)) {
      throw new Error("Twilio accountSid contains illegal characters");
    }
    if (!options.authToken) throw new Error("Twilio authToken required");
    if (!options.from) throw new Error("Twilio from number required");
    this.accountSid = options.accountSid;
    this.authToken = options.authToken;
    this.from = options.from.startsWith("whatsapp:") ? options.from : `whatsapp:${options.from}`;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async sendWhatsApp(msg: WhatsAppSendOptions): Promise<{ messageId: string }> {
    const to = msg.to.startsWith("whatsapp:") ? msg.to : `whatsapp:${msg.to}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const params = new URLSearchParams({
      To: to,
      From: this.from,
      Body: msg.body,
    });
    if (msg.mediaUrl) {
      params.set("MediaUrl", msg.mediaUrl);
    }

    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`Twilio WhatsApp error: ${res.status}`);
    }

    const data = (await res.json()) as { sid?: string };
    return { messageId: data.sid ?? "twilio-wa-unknown" };
  }
}

const ALLOWED_MEDIA = new Set(["image", "document", "audio", "video", "text"]);

export function validateWhatsApp(msg: WhatsAppMessage): void {
  if (!/^\+[1-9]\d{7,14}$/.test(msg.to.replace(/^whatsapp:/, ""))) {
    throw new Error(`Invalid phone: ${msg.to}`);
  }
  if (!msg.body?.trim() && !msg.template && !msg.templateName) {
    throw new Error("body, template, or templateName required");
  }
  const mt = (msg.mediaType ?? "text") as string;
  if (!ALLOWED_MEDIA.has(mt)) throw new Error(`Unsupported media type: ${mt}`);
  if (msg.mediaUrl) {
    if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(msg.mediaUrl) || /[\r\n\0]/.test(msg.mediaUrl)) {
      throw new Error("mediaUrl must be a valid http(s) URL");
    }
  }
}

export interface WhatsAppChannelOptions {
  provider?: WhatsAppProvider;
  retries?: number;
}

export class WhatsAppChannel implements ChannelAdapter {
  readonly channel = "whatsapp" as const;
  private provider: WhatsAppProvider;
  private retries: number;

  constructor(optsOrProvider?: WhatsAppChannelOptions | WhatsAppProvider) {
    if (optsOrProvider && "sendWhatsApp" in optsOrProvider) {
      this.provider = optsOrProvider;
      this.retries = 1;
    } else {
      const opts = optsOrProvider as WhatsAppChannelOptions | undefined;
      this.provider = opts?.provider ?? new MockWhatsAppProvider();
      this.retries = opts?.retries ?? 1;
    }
  }

  get providerName(): string {
    return this.provider.name;
  }

  async send(payload: NotificationPayload | WhatsAppMessage): Promise<DeliveryResult> {
    try {
      const msg = payload as WhatsAppMessage;
      validateWhatsApp(msg);
      const rawBody = msg.body ?? "";
      const body = msg.template ? msg.template.replaceAll("{{body}}", () => rawBody) : rawBody;

      const sendOptions: WhatsAppSendOptions = {
        to: msg.to,
        body,
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
        templateName: msg.templateName ?? (payload.data?.templateName as string | undefined),
        languageCode: msg.languageCode ?? (payload.data?.languageCode as string | undefined),
        components:
          msg.components ?? (payload.data?.components as WhatsAppTemplateComponent[] | undefined),
        previewUrl: msg.previewUrl ?? (payload.data?.previewUrl as boolean | undefined),
      };

      let lastErr = "";
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const { messageId } = await this.provider.sendWhatsApp(sendOptions);
          return { success: true, channel: "whatsapp", messageId };
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (attempt === this.retries) break;
        }
      }
      return { success: false, channel: "whatsapp", error: lastErr };
    } catch (e) {
      return {
        success: false,
        channel: "whatsapp",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
