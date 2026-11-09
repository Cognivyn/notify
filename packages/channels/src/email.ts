import type { ChannelAdapter, DeliveryResult, NotificationPayload } from "@cognivyn/types";
import { createHash, createHmac } from "node:crypto";

export interface EmailAttachment {
  filename: string;
  content: string | Uint8Array;
  contentType?: string;
}

export interface EmailOptions extends NotificationPayload {
  subject?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  attachments?: EmailAttachment[];
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(opts: EmailSendOptions): Promise<{ messageId: string }>;
}

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  sent: Array<EmailSendOptions> = [];
  failNext = false;

  async sendEmail(opts: EmailSendOptions) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("mock email failure");
    }
    this.sent.push(opts);
    return { messageId: `email-mock-${this.sent.length}` };
  }
}

export function validateEmail(to: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error(`Invalid email: ${to}`);
}

export function validateSubject(subject: string): void {
  if (/[\r\n]/.test(subject)) {
    throw new Error("Email subject must not contain CRLF characters");
  }
  if (subject.length > 998) {
    throw new Error("Email subject exceeds maximum length of 998 characters");
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resend (https://resend.com) email provider. Zero deps, injectable fetch for tests. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
    private fetchFn: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("Resend apiKey required");
    if (!from) throw new Error("Resend from address required");
    validateEmail(from);
  }

  async sendEmail(opts: EmailSendOptions) {
    validateEmail(opts.to);
    validateSubject(opts.subject);
    if (!opts.subject?.trim()) throw new Error("Email subject required");
    if (!opts.text?.trim() && !opts.html?.trim()) throw new Error("Email body must not be empty");
    if (opts.cc) opts.cc.forEach(validateEmail);
    if (opts.bcc) opts.bcc.forEach(validateEmail);
    if (opts.replyTo) validateEmail(opts.replyTo);

    const payload: Record<string, unknown> = {
      from: this.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
      ...(opts.cc && opts.cc.length > 0 ? { cc: opts.cc } : {}),
      ...(opts.bcc && opts.bcc.length > 0 ? { bcc: opts.bcc } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
      ...(opts.tags && opts.tags.length > 0 ? { tags: opts.tags } : {}),
      ...(opts.attachments && opts.attachments.length > 0
        ? {
            attachments: opts.attachments.map((a) => ({
              filename: a.filename,
              content:
                typeof a.content === "string"
                  ? a.content
                  : Buffer.from(a.content).toString("base64"),
              ...(a.contentType ? { content_type: a.contentType } : {}),
            })),
          }
        : {}),
    };

    const res = await this.fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Resend error: ${res.status}`);
    const data = (await res.json()) as { id?: string };
    return { messageId: data.id ?? "resend-unknown" };
  }
}

export interface SesEmailOptions {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  from: string;
  sessionToken?: string;
  fetchFn?: typeof fetch;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function awsUriEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Minimal AWS Signature V4 signer for SESv2 (stdlib crypto only, RFC 3986 compliant). */
function signSesV4(opts: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payload: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  amzDate: string;
}): Record<string, string> {
  const dateStamp = opts.amzDate.slice(0, 8);
  const signedHeaders = ["content-type", "host", "x-amz-date"];
  if (opts.sessionToken) signedHeaders.push("x-amz-security-token");
  signedHeaders.sort();
  const canonicalHeaders = signedHeaders
    .map((h) => `${h}:${opts.headers[h]!.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const searchEntries = Array.from(opts.url.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const canonicalQueryString = searchEntries
    .map(([k, v]) => `${awsUriEncode(k)}=${awsUriEncode(v)}`)
    .join("&");
  const canonicalRequest = [
    opts.method,
    opts.url.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders.join(";"),
    sha256Hex(opts.payload),
  ].join("\n");
  const scope = `${dateStamp}/${opts.region}/ses/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", opts.amzDate, scope, sha256Hex(canonicalRequest)].join(
    "\n",
  );
  const kDate = hmacSha256(`AWS4${opts.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, opts.region);
  const kService = hmacSha256(kRegion, "ses");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");
  return {
    ...opts.headers,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`,
  };
}

/** AWS SESv2 (Simple Email Service) provider. SigV4-signed, zero deps. */
export class SesEmailProvider implements EmailProvider {
  readonly name = "ses";
  private fetchFn: typeof fetch;
  constructor(private opts: SesEmailOptions) {
    if (!opts.accessKeyId) throw new Error("SES accessKeyId required");
    if (!opts.secretAccessKey) throw new Error("SES secretAccessKey required");
    if (!opts.region) throw new Error("SES region required");
    if (!opts.from) throw new Error("SES from address required");
    validateEmail(opts.from);
    this.fetchFn = opts.fetchFn ?? fetch;
  }
  async sendEmail(msg: EmailSendOptions) {
    validateEmail(msg.to);
    validateSubject(msg.subject);
    if (!msg.subject?.trim()) throw new Error("Email subject required");
    if (!msg.text?.trim() && !msg.html?.trim()) throw new Error("Email body must not be empty");
    if (msg.cc) msg.cc.forEach(validateEmail);
    if (msg.bcc) msg.bcc.forEach(validateEmail);
    if (msg.replyTo) validateEmail(msg.replyTo);

    const url = new URL(`https://email.${this.opts.region}.amazonaws.com/v2/email/outbound-emails`);
    const destination: Record<string, string[]> = { ToAddresses: [msg.to] };
    if (msg.cc && msg.cc.length > 0) destination.CcAddresses = msg.cc;
    if (msg.bcc && msg.bcc.length > 0) destination.BccAddresses = msg.bcc;

    const emailPayload: Record<string, unknown> = {
      FromEmailAddress: this.opts.from,
      Destination: destination,
      Content: {
        Simple: {
          Subject: { Data: msg.subject },
          Body: {
            Text: { Data: msg.text },
            ...(msg.html ? { Html: { Data: msg.html } } : {}),
          },
        },
      },
      ...(msg.replyTo ? { ReplyToAddresses: [msg.replyTo] } : {}),
      ...(msg.tags && msg.tags.length > 0
        ? {
            EmailTags: msg.tags.map((t) => ({
              ResourceTagName: t.name,
              ResourceTagValue: t.value,
            })),
          }
        : {}),
    };

    const payload = JSON.stringify(emailPayload);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const baseHeaders: Record<string, string> = {
      "content-type": "application/json",
      host: url.host,
      "x-amz-date": amzDate,
      ...(this.opts.sessionToken ? { "x-amz-security-token": this.opts.sessionToken } : {}),
    };
    const headers = signSesV4({
      method: "POST",
      url,
      headers: baseHeaders,
      payload,
      region: this.opts.region,
      accessKeyId: this.opts.accessKeyId,
      secretAccessKey: this.opts.secretAccessKey,
      sessionToken: this.opts.sessionToken,
      amzDate,
    });
    const res = await this.fetchFn(url.toString(), { method: "POST", headers, body: payload });
    if (!res.ok) throw new Error(`SES error: ${res.status}`);
    const data = (await res.json()) as { MessageId?: string };
    return { messageId: data.MessageId ?? "ses-unknown" };
  }
}

export interface RenderTemplateOptions {
  escapeHtml?: boolean;
}

/** Minimal template renderer: replaces {{key}} tokens. Zero deps. Supports HTML entity escaping. */
export function renderTemplate(
  template: string,
  vars: Record<string, unknown> = {},
  options: RenderTemplateOptions = {},
): string {
  const shouldEscape = options.escapeHtml ?? false;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const val = String(vars[k] ?? "");
    return shouldEscape ? escapeHtml(val) : val;
  });
}

export interface EmailChannelOptions {
  provider?: EmailProvider;
  retries?: number;
}

export class EmailChannel implements ChannelAdapter {
  readonly channel = "email" as const;
  private provider: EmailProvider;
  private retries: number;

  constructor(optsOrProvider?: EmailChannelOptions | EmailProvider) {
    if (optsOrProvider && "sendEmail" in optsOrProvider) {
      this.provider = optsOrProvider;
      this.retries = 1;
    } else {
      const opts = optsOrProvider as EmailChannelOptions | undefined;
      this.provider = opts?.provider ?? new MockEmailProvider();
      this.retries = opts?.retries ?? 1;
    }
  }

  get providerName(): string {
    return this.provider.name;
  }

  async send(payload: NotificationPayload | EmailOptions): Promise<DeliveryResult> {
    try {
      validateEmail(payload.to);
      const emailMsg = payload as EmailOptions;
      const subject = emailMsg.subject ?? payload.title ?? "(no subject)";
      validateSubject(subject);
      const text = payload.body ?? "";
      const html = emailMsg.html ?? (payload.data?.["html"] as string | undefined);
      if (!text.trim() && !html?.trim()) throw new Error("Email body must not be empty");

      const cc = emailMsg.cc ?? (payload.data?.["cc"] as string[] | undefined);
      const bcc = emailMsg.bcc ?? (payload.data?.["bcc"] as string[] | undefined);
      const replyTo = emailMsg.replyTo ?? (payload.data?.["replyTo"] as string | undefined);
      const headers =
        emailMsg.headers ?? (payload.data?.["headers"] as Record<string, string> | undefined);
      const tags =
        emailMsg.tags ??
        (payload.data?.["tags"] as Array<{ name: string; value: string }> | undefined);
      const attachments =
        emailMsg.attachments ?? (payload.data?.["attachments"] as EmailAttachment[] | undefined);

      if (cc) cc.forEach(validateEmail);
      if (bcc) bcc.forEach(validateEmail);
      if (replyTo) validateEmail(replyTo);

      let lastErr = "";
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const { messageId } = await this.provider.sendEmail({
            to: payload.to,
            subject,
            text,
            html,
            cc,
            bcc,
            replyTo,
            headers,
            tags,
            attachments,
          });
          return { success: true, channel: "email", messageId };
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (attempt === this.retries) break;
        }
      }
      return { success: false, channel: "email", error: lastErr };
    } catch (e) {
      return {
        success: false,
        channel: "email",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
