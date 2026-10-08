import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@notify/types";

export interface EmailAttachment {
  filename: string;
  content: string | Uint8Array;
  contentType?: string;
}

export interface EmailOptions extends NotificationPayload {
  subject?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ messageId: string }>;
}

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  sent: Array<{ to: string; subject: string }> = [];
  async sendEmail(opts: { to: string; subject: string; text: string }) {
    this.sent.push({ to: opts.to, subject: opts.subject });
    return { messageId: `email-mock-${this.sent.length}` };
  }
}

/** Minimal template renderer: replaces {{key}} tokens. Zero deps. */
export function renderTemplate(template: string, vars: Record<string, unknown> = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function validateEmail(to: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error(`Invalid email: ${to}`);
}

export class EmailChannel implements ChannelAdapter {
  readonly channel = "email" as const;
  constructor(private provider: EmailProvider = new MockEmailProvider()) {}

  get providerName(): string {
    return this.provider.name;
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    try {
      validateEmail(payload.to);
      const subject = payload.title ?? "(no subject)";
      const text = payload.body;
      if (!text.trim()) throw new Error("Email body must not be empty");
      const html = payload.data?.["html"] as string | undefined;
      const { messageId } = await this.provider.sendEmail({ to: payload.to, subject, text, html });
      return { success: true, channel: "email", messageId };
    } catch (e) {
      return { success: false, channel: "email", error: e instanceof Error ? e.message : String(e) };
    }
  }
}
