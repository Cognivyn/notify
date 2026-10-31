import { describe, expect, test } from "bun:test";
import { SmsChannel, MockSmsProvider } from "@notify/channels/sms";
import { EmailChannel, MockEmailProvider } from "@notify/channels/email";
import { WhatsAppChannel } from "@notify/channels/whatsapp";
import { PushChannel } from "@notify/channels/push";
import { NotificationService } from "@notify/core/service";
import { NotificationBuilder } from "@notify/core/builder";
import { NotificationQueue } from "@notify/core/queue";
import { ApiKeyAuth } from "@notify/auth/providers";
import { SecureStore } from "@notify/auth/store";
import { ConfigManager } from "@notify/config/manager";

describe("tree-shakable subpath imports", () => {
  test("imports individual channel subpaths without root barrel", async () => {
    const sms = new SmsChannel({ provider: new MockSmsProvider() });
    const res = await sms.send({ channel: "sms", to: "+15551234567", body: "subpath sms" });
    expect(res.success).toBe(true);

    const email = new EmailChannel(new MockEmailProvider());
    const emailRes = await email.send({
      channel: "email",
      to: "test@example.com",
      body: "subpath email",
    });
    expect(emailRes.success).toBe(true);

    const whatsapp = new WhatsAppChannel();
    const waRes = await whatsapp.send({
      channel: "whatsapp",
      to: "+15551234567",
      body: "subpath wa",
    });
    expect(waRes.success).toBe(true);

    const push = new PushChannel();
    const pushRes = await push.send({ channel: "push", to: "device-tok", body: "subpath push" });
    expect(pushRes.success).toBe(true);
  });

  test("imports individual core subpaths", async () => {
    const service = new NotificationService();
    const sms = new SmsChannel();
    service.register(sms);

    const payload = new NotificationBuilder()
      .channel("sms")
      .to("+15551234567")
      .body("built")
      .build();
    const res = await service.send(payload);
    expect(res.success).toBe(true);

    const queue = new NotificationQueue(service);
    queue.enqueue(payload);
    expect(queue.size).toBe(1);
    const flushRes = await queue.flushAll();
    expect(flushRes.length).toBe(1);
    expect(queue.size).toBe(0);
  });

  test("imports individual auth and config subpaths", () => {
    const auth = new ApiKeyAuth("secret-key");
    expect(auth.headers().Authorization).toBe("Bearer secret-key");

    const store = new SecureStore();
    store.set("TEST_KEY", "value");
    expect(store.get("TEST_KEY")).toBe("value");

    const config = new ConfigManager({ appName: "NotifyApp" });
    expect(config.get<string>("appName")).toBe("NotifyApp");
  });
});
