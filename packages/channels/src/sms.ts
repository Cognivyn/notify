import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@notify/types";

export interface Msg91SendOptions {
  templateId?: string;
  variables?: Record<string, string | number>;
  shortUrl?: boolean;
  extra?: Record<string, unknown>;
}

export interface SmsMessage extends NotificationPayload {
  templateId?: string;
  variables?: Record<string, string | number>;
  shortUrl?: boolean;
}

export interface SmsProvider {
  readonly name: string;
  sendSms(to: string, body: string, options?: Msg91SendOptions): Promise<{ messageId: string }>;
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  sent: Array<{ to: string; body: string; options?: Msg91SendOptions }> = [];
  failNext = false;
  async sendSms(to: string, body: string, options?: Msg91SendOptions) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("mock sms failure");
    }
    this.sent.push({ to, body, options });
    return { messageId: `sms-mock-${this.sent.length}` };
  }
}

export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private accountSid: string,
    private authToken: string,
    private from: string,
    private fetchFn: typeof fetch = fetch,
  ) {
    if (!accountSid) throw new Error("Twilio accountSid required");
    if (!/^[a-zA-Z0-9_-]+$/.test(accountSid)) {
      throw new Error("Twilio accountSid contains illegal characters");
    }
    if (!authToken) throw new Error("Twilio authToken required");
    if (!from) throw new Error("Twilio from number required");
  }
  async sendSms(to: string, body: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }).toString(),
    });
    if (!res.ok) throw new Error(`Twilio error: ${res.status}`);
    const data = (await res.json()) as { sid?: string };
    return { messageId: data.sid ?? "twilio-unknown" };
  }
}

export interface Msg91Options {
  authKey: string;
  sender?: string;
  templateId?: string;
  route?: string;
  country?: string;
  baseUrl?: string;
  flowUrl?: string;
  fetchFn?: typeof fetch;
}

/** MSG91 SMS provider (Flow API + route-based SMS fallback). Auth-key header, injectable fetch for tests. */
export class Msg91SmsProvider implements SmsProvider {
  readonly name = "msg91";
  private authKey: string;
  private sender?: string;
  private templateId?: string;
  private route: string;
  private country: string;
  private baseUrl: string;
  private flowUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: Msg91Options);
  constructor(
    authKey: string,
    sender?: string,
    opts?: {
      route?: string;
      country?: string;
      templateId?: string;
      baseUrl?: string;
      flowUrl?: string;
      fetchFn?: typeof fetch;
    },
  );
  constructor(
    authKeyOrOpts: string | Msg91Options,
    sender?: string,
    opts: {
      route?: string;
      country?: string;
      templateId?: string;
      baseUrl?: string;
      flowUrl?: string;
      fetchFn?: typeof fetch;
    } = {},
  ) {
    if (typeof authKeyOrOpts === "object" && authKeyOrOpts !== null) {
      this.authKey = authKeyOrOpts.authKey;
      this.sender = authKeyOrOpts.sender;
      this.templateId = authKeyOrOpts.templateId;
      this.route = authKeyOrOpts.route ?? "4";
      this.country = authKeyOrOpts.country ?? "91";
      this.baseUrl = authKeyOrOpts.baseUrl ?? "https://api.msg91.com/api/v5/sms";
      this.flowUrl = authKeyOrOpts.flowUrl ?? "https://control.msg91.com/api/v5/flow";
      this.fetchFn = authKeyOrOpts.fetchFn ?? fetch;
    } else {
      this.authKey = authKeyOrOpts;
      this.sender = sender;
      this.templateId = opts.templateId;
      this.route = opts.route ?? "4";
      this.country = opts.country ?? "91";
      this.baseUrl = opts.baseUrl ?? "https://api.msg91.com/api/v5/sms";
      this.flowUrl = opts.flowUrl ?? "https://control.msg91.com/api/v5/flow";
      this.fetchFn = opts.fetchFn ?? fetch;
    }
    if (!this.authKey) throw new Error("MSG91 authKey required");
    if (!this.sender && !this.templateId) throw new Error("MSG91 sender ID required");
  }

  async sendSms(to: string, body: string, options?: Msg91SendOptions) {
    validatePhone(to);
    const digits = to.replace("+", "");
    const effectiveTemplate = options?.templateId ?? this.templateId;

    if (effectiveTemplate) {
      // Prevent parameter pollution from overwriting mobiles
      const { mobiles: _m, ...safeVariables } = (options?.variables ?? {}) as Record<
        string,
        unknown
      >;
      const recipient: Record<string, unknown> = {
        mobiles: digits,
        ...safeVariables,
      };
      const payload: Record<string, unknown> = {
        template_id: effectiveTemplate,
        recipients: [recipient],
      };
      if (options?.shortUrl !== undefined) {
        payload.short_url = options.shortUrl ? "1" : "0";
      }
      if (options?.extra) {
        Object.assign(payload, options.extra);
      }
      const res = await this.fetchFn(this.flowUrl, {
        method: "POST",
        headers: {
          authkey: this.authKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      return this.handleResponse(res);
    }

    const text = formatSms(body);
    if (!this.sender) {
      throw new Error("MSG91 sender ID required for route-based SMS");
    }

    const res = await this.fetchFn(this.baseUrl, {
      method: "POST",
      headers: { authkey: this.authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: this.sender,
        route: this.route,
        country: this.country,
        mobiles: digits,
        message: text,
      }),
    });
    return this.handleResponse(res);
  }

  private async handleResponse(res: Response): Promise<{ messageId: string }> {
    if (!res.ok) throw new Error(`MSG91 error: ${res.status}`);
    const data = (await res.json()) as {
      message?: string;
      type?: string;
      status?: string;
      hasError?: boolean;
      errors?: unknown;
    };
    if (data.type === "error" || data.status === "error" || data.hasError) {
      const errDetail =
        data.message ??
        (typeof data.errors === "string" ? data.errors : JSON.stringify(data.errors)) ??
        "unknown error";
      throw new Error(`MSG91 error: ${errDetail}`);
    }
    return { messageId: data.message ?? `msg91-${Date.now()}` };
  }
}

export function validatePhone(to: string): void {
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    throw new Error(`Invalid E.164 phone number: ${to}`);
  }
}

export function formatSms(body: string, maxLen = 1600): string {
  const t = body.trim();
  if (t.length === 0) throw new Error("SMS body must not be empty");
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

export interface SmsChannelOptions {
  provider?: SmsProvider;
  retries?: number;
}

/** SRP-compliant SMS channel adapter with retry + validation. */
export class SmsChannel implements ChannelAdapter {
  readonly channel = "sms" as const;
  private provider: SmsProvider;
  private retries: number;

  constructor(opts: SmsChannelOptions = {}) {
    this.provider = opts.provider ?? new MockSmsProvider();
    this.retries = opts.retries ?? 1;
  }

  get providerName(): string {
    return this.provider.name;
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    try {
      const msg = payload as SmsMessage;
      validatePhone(payload.to);
      const sendOpts: Msg91SendOptions = {
        templateId: msg.templateId ?? (payload.data?.templateId as string | undefined),
        variables:
          msg.variables ?? (payload.data?.variables as Record<string, string | number> | undefined),
        shortUrl: msg.shortUrl ?? (payload.data?.shortUrl as boolean | undefined),
      };

      const isTemplated = Boolean(sendOpts.templateId);
      const rawBody = payload.body?.trim();
      let body = "";
      if (isTemplated) {
        body = rawBody ? formatSms(payload.body) : "";
      } else {
        body = formatSms(payload.body);
      }

      let lastErr = "";
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const { messageId } = await this.provider.sendSms(payload.to, body, sendOpts);
          return { success: true, channel: "sms", messageId };
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (attempt === this.retries) break;
        }
      }
      return { success: false, channel: "sms", error: lastErr };
    } catch (e) {
      return { success: false, channel: "sms", error: e instanceof Error ? e.message : String(e) };
    }
  }
}
