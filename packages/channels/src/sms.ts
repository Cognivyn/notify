import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@notify/types";

export interface SmsProvider {
  readonly name: string;
  sendSms(to: string, body: string): Promise<{ messageId: string }>;
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  sent: Array<{ to: string; body: string }> = [];
  failNext = false;
  async sendSms(to: string, body: string) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("mock sms failure");
    }
    this.sent.push({ to, body });
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
    if (!authToken) throw new Error("Twilio authToken required");
    if (!from) throw new Error("Twilio from number required");
  }
  async sendSms(to: string, body: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }).toString(),
    });
    if (!res.ok) throw new Error(`Twilio error: ${res.status}`);
    const data = (await res.json()) as { sid?: string };
    return { messageId: data.sid ?? "twilio-unknown" };
  }
}

export interface Msg91Options {
  authKey: string;
  sender: string;
  route?: string;
  country?: string;
  fetchFn?: typeof fetch;
}

/** MSG91 SMS provider (India + global). Auth-key header, injectable fetch for tests. */
export class Msg91SmsProvider implements SmsProvider {
  readonly name = "msg91";
  private fetchFn: typeof fetch;
  private route: string;
  private country: string;
  constructor(
    private authKey: string,
    private sender: string,
    opts: { route?: string; country?: string; fetchFn?: typeof fetch } = {},
  ) {
    if (!authKey) throw new Error("MSG91 authKey required");
    if (!sender) throw new Error("MSG91 sender ID required");
    this.fetchFn = opts.fetchFn ?? fetch;
    this.route = opts.route ?? "4";
    this.country = opts.country ?? "91";
  }
  async sendSms(to: string, body: string) {
    validatePhone(to);
    const digits = to.replace("+", "");
    const res = await this.fetchFn("https://api.msg91.com/api/v5/sms", {
      method: "POST",
      headers: { authkey: this.authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: this.sender,
        route: this.route,
        country: this.country,
        mobiles: digits,
        message: body,
      }),
    });
    if (!res.ok) throw new Error(`MSG91 error: ${res.status}`);
    const data = (await res.json()) as { message?: string; type?: string };
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
      validatePhone(payload.to);
      const body = formatSms(payload.body);
      let lastErr = "";
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const { messageId } = await this.provider.sendSms(payload.to, body);
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
