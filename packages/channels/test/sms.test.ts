import { describe, expect, test } from "bun:test";
import { SmsChannel, MockSmsProvider, validatePhone } from "../src/sms.js";

describe("SmsChannel", () => {
  test("sends valid SMS", async () => {
    const c = new SmsChannel();
    const r = await c.send({ channel: "sms", to: "+15551234567", body: "hello" });
    expect(r.success).toBe(true);
    expect(r.messageId).toContain("sms-mock");
  });
  test("rejects invalid phone", async () => {
    const c = new SmsChannel();
    const r = await c.send({ channel: "sms", to: "bad", body: "hi" });
    expect(r.success).toBe(false);
  });
  test("rejects empty body", async () => {
    const c = new SmsChannel();
    const r = await c.send({ channel: "sms", to: "+15551234567", body: "  " });
    expect(r.success).toBe(false);
  });
  test("retries on provider failure", async () => {
    const p = new MockSmsProvider();
    p.failNext = true;
    const c = new SmsChannel({ provider: p, retries: 1 });
    const r = await c.send({ channel: "sms", to: "+15551234567", body: "hi" });
    expect(r.success).toBe(true);
  });
  test("validatePhone throws", () => {
    expect(() => validatePhone("+1")).toThrow();
  });
});
