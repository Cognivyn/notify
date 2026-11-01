import { describe, expect, test } from "bun:test";
import { NotificationService } from "@notify/core";
import { SmsChannel, EmailChannel, WhatsAppChannel, PushChannel } from "@notify/channels";

function fullService() {
  return new NotificationService()
    .register(new SmsChannel())
    .register(new EmailChannel())
    .register(new WhatsAppChannel())
    .register(new PushChannel());
}

describe("channels integration", () => {
  test("sms + fallback to email", async () => {
    const svc = fullService();
    const r = await svc.send({ channel: "sms", to: "+15551234567", body: "hi" });
    expect(r.success).toBe(true);
  });
  test("email flow", async () => {
    const svc = fullService();
    const r = await svc.send({ channel: "email", to: "a@b.com", title: "t", body: "b" });
    expect(r.success).toBe(true);
  });
  test("whatsapp + push flows", async () => {
    const svc = fullService();
    expect((await svc.send({ channel: "whatsapp", to: "+15551234567", body: "hi" })).success).toBe(
      true,
    );
    expect((await svc.send({ channel: "push", to: "tok", body: "hi" })).success).toBe(true);
  });
  test("error scenarios surface cleanly", async () => {
    const svc = fullService();
    const r = await svc.send({ channel: "sms", to: "bad", body: "hi" });
    expect(r.success).toBe(false);
    expect(r.error).toBeString();
  });
});

describe("e2e notification flows", () => {
  test("multi-channel batch", async () => {
    const svc = fullService();
    const rs = await svc.sendMany([
      { channel: "sms", to: "+15551234567", body: "a" },
      { channel: "email", to: "a@b.com", body: "b" },
      { channel: "push", to: "tok", body: "c" },
    ]);
    expect(rs.filter((r) => r.success).length).toBe(3);
  });
});
