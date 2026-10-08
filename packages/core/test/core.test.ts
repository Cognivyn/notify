import { describe, expect, test } from "bun:test";
import { NotificationService, NotificationBuilder, NotificationQueue, notify } from "../src/index.js";
import type { ChannelAdapter, NotificationPayload } from "@notify/types";

function mockAdapter(channel: "sms" | "email" | "whatsapp" | "push", ok = true): ChannelAdapter {
  return {
    channel,
    send: async (p: NotificationPayload) => ({
      success: ok,
      channel,
      messageId: ok ? `${channel}-1` : undefined,
      error: ok ? undefined : "boom",
    }),
  };
}

describe("NotificationService", () => {
  test("sends via registered adapter", async () => {
    const s = new NotificationService().register(mockAdapter("sms"));
    const r = await s.send({ channel: "sms", to: "+1", body: "hi" });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe("sms-1");
  });
  test("fails without adapter", async () => {
    const s = new NotificationService();
    const r = await s.send({ channel: "sms", to: "x", body: "hi" });
    expect(r.success).toBe(false);
  });
  test("fallback channel recovers", async () => {
    const s = new NotificationService()
      .register(mockAdapter("sms", false))
      .register(mockAdapter("email", true));
    const r = await s.send(
      { channel: "sms", to: "x", body: "hi" },
      { fallbackChannels: ["email"] },
    );
    expect(r.success).toBe(true);
  });
  test("sendMany batches", async () => {
    const s = new NotificationService().register(mockAdapter("sms"));
    const rs = await s.sendMany([
      { channel: "sms", to: "a", body: "1" },
      { channel: "sms", to: "b", body: "2" },
    ]);
    expect(rs.length).toBe(2);
  });
});

describe("Builder", () => {
  test("builds payload", () => {
    const p = new NotificationBuilder().channel("email").to("a@b.c").body("hi").build();
    expect(p.channel).toBe("email");
  });
  test("requires fields", () => {
    expect(() => new NotificationBuilder().build()).toThrow();
  });
  test("notify helper", () => {
    expect(notify("sms", "+1", "hi").to).toBe("+1");
  });
});

describe("Queue", () => {
  test("enqueue + flushAll", async () => {
    const s = new NotificationService().register(mockAdapter("sms"));
    const q = new NotificationQueue(s, 1);
    q.enqueue({ channel: "sms", to: "a", body: "1" });
    q.enqueue({ channel: "sms", to: "b", body: "2" });
    expect(q.size).toBe(2);
    const rs = await q.flushAll();
    expect(rs.length).toBe(2);
    expect(q.size).toBe(0);
  });
});
