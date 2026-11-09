import { NotificationService } from "@cognivyn/core";
import { SmsChannel, EmailChannel, WhatsAppChannel, PushChannel } from "@cognivyn/channels";

const svc = new NotificationService()
  .register(new SmsChannel())
  .register(new EmailChannel())
  .register(new WhatsAppChannel())
  .register(new PushChannel());

await svc.send({ channel: "sms", to: "+15551234567", body: "hello" });
await svc.send({ channel: "email", to: "dev@example.com", title: "Hi", body: "hello" });
await svc.send({ channel: "whatsapp", to: "+15551234567", body: "hello" });
await svc.send({ channel: "push", to: "device-token", title: "Hi", body: "hello" });
