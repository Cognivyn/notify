import { describe, expect, test } from "bun:test";
import {
  SmsChannel,
  MockSmsProvider,
  TwilioSmsProvider,
  Msg91SmsProvider,
} from "@cognivyn/channels/sms";
import {
  EmailChannel,
  MockEmailProvider,
  ResendEmailProvider,
  SesEmailProvider,
} from "@cognivyn/channels/email";
import {
  WhatsAppChannel,
  MockWhatsAppProvider,
  WhatsAppCloudApiProvider,
  TwilioWhatsAppProvider,
} from "@cognivyn/channels/whatsapp";
import {
  PushChannel,
  MockPushProvider,
  FcmV1PushProvider,
  FcmPushProvider,
  ApnsPushProvider,
} from "@cognivyn/channels/push";
import { NotificationService } from "@cognivyn/core/service";
import { NotificationBuilder } from "@cognivyn/core/builder";
import { NotificationQueue } from "@cognivyn/core/queue";
import { ApiKeyAuth, ClientSecretAuth } from "@cognivyn/auth/providers";
import { SecureStore } from "@cognivyn/auth/store";
import { ConfigManager } from "@cognivyn/config/manager";

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

    const whatsapp = new WhatsAppChannel(new MockWhatsAppProvider());
    const waRes = await whatsapp.send({
      channel: "whatsapp",
      to: "+15551234567",
      body: "subpath wa",
    });
    expect(waRes.success).toBe(true);

    const push = new PushChannel(new MockPushProvider());
    const pushRes = await push.send({ channel: "push", to: "device-tok", body: "subpath push" });
    expect(pushRes.success).toBe(true);
  });

  test("imports all modern providers directly from their subpaths", () => {
    expect(TwilioSmsProvider).toBeDefined();
    expect(Msg91SmsProvider).toBeDefined();
    expect(ResendEmailProvider).toBeDefined();
    expect(SesEmailProvider).toBeDefined();
    expect(WhatsAppCloudApiProvider).toBeDefined();
    expect(TwilioWhatsAppProvider).toBeDefined();
    expect(FcmV1PushProvider).toBeDefined();
    expect(FcmPushProvider).toBeDefined();
    expect(ApnsPushProvider).toBeDefined();
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

    const clientSecretAuth = new ClientSecretAuth("client-id", "client-secret");
    expect(clientSecretAuth.headers().Authorization).toBeDefined();

    const store = new SecureStore();
    store.set("TEST_KEY", "value");
    expect(store.get("TEST_KEY")).toBe("value");

    const config = new ConfigManager({ appName: "NotifyApp" });
    expect(config.get<string>("appName")).toBe("NotifyApp");
  });
});
