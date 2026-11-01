# Email — Resend / AWS SES / Mock

The Email channel provides multi-provider transactional email delivery through the `EmailProvider` adapter interface. Built-in providers include `MockEmailProvider`, `ResendEmailProvider`, and `SesEmailProvider`.

## Quick start

### 1. Resend (https://resend.com)

High-deliverability developer email platform. Supports HTML templates, CC, BCC, Reply-To, custom tags, and file attachments.

```ts
import { EmailChannel, ResendEmailProvider, renderTemplate } from "@notify/channels/email";

const channel = new EmailChannel({
  provider: new ResendEmailProvider(process.env.RESEND_API_KEY!, "noreply@acme.com"),
  retries: 2,
});

const html = renderTemplate("<p>Hello {{name}}, welcome aboard!</p>", { name: "Alice" });

await channel.send({
  channel: "email",
  to: "alice@example.com",
  title: "Welcome to Acme",
  body: "Welcome to Acme! We are excited to have you.",
  html,
  cc: ["team@acme.com"],
  replyTo: "support@acme.com",
  tags: [{ name: "category", value: "onboarding" }],
  attachments: [
    {
      filename: "welcome.pdf",
      content: "base64-or-buffer",
      contentType: "application/pdf",
    },
  ],
});
```

### 2. AWS SESv2 (SigV4-signed, zero dependencies)

Direct AWS Simple Email Service v2 delivery. Implements RFC-compliant AWS Signature Version 4 authentication using Node.js built-in crypto without requiring the heavy `@aws-sdk/client-sesv2`.

```ts
import { EmailChannel, SesEmailProvider } from "@notify/channels/email";

const channel = new EmailChannel({
  provider: new SesEmailProvider({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION ?? "us-east-1",
    from: "alerts@acme.com",
  }),
  retries: 2,
});

await channel.send({
  channel: "email",
  to: "user@example.com",
  title: "System Alert",
  body: "Database backup completed successfully.",
  replyTo: "devops@acme.com",
});
```

## Security & Validation

- **RFC 5322 Email Validation**: Recipient, CC, BCC, and sender addresses are strictly validated.
- **CRLF Injection Prevention**: Email subjects are strictly checked to prevent newline injection (`\r`, `\n`) which could allow malicious header injection (Bcc spoofing).
- **Subject Length Limit**: Subjects are constrained to 998 characters per RFC 5322 section 2.1.1.
- **HTML Escaping**: The built-in `renderTemplate` utility supports `{ escapeHtml: true }` to sanitize dynamic template variables and neutralize XSS risks.
