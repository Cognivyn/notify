# Email — SendGrid / SMTP

```ts
import { EmailChannel, renderTemplate } from "@notify/channels";
const html = renderTemplate("<p>Hi {{name}}</p>", { name: "Bo" });
await new EmailChannel().send({ channel: "email", to: "a@b.com", title: "Hi", body: "hello", data: { html } });
```
