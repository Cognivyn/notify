# Email — mock / Resend / AWS SES

```ts
import { EmailChannel, ResendEmailProvider, SesEmailProvider, renderTemplate } from "@notify/channels";
const html = renderTemplate("<p>Hi {{name}}</p>", { name: "Bo" });
await new EmailChannel().send({ channel: "email", to: "a@b.com", title: "Hi", body: "hello", data: { html } });

// Resend
const resend = new EmailChannel(new ResendEmailProvider(process.env.RESEND_API_KEY!, "noreply@acme.com"));
await resend.send({ channel: "email", to: "a@b.com", title: "Hi", body: "hello", data: { html } });

// AWS SESv2 (SigV4-signed, stdlib crypto only)
const ses = new EmailChannel(
  new SesEmailProvider({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION ?? "us-east-1",
    from: "noreply@acme.com",
  }),
);
await ses.send({ channel: "email", to: "a@b.com", title: "Hi", body: "hello", data: { html } });
```

Env: `RESEND_API_KEY`, `RESEND_FROM`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
