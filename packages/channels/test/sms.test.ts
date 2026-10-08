import { describe, expect, test } from "bun:test";
import { SmsChannel, MockSmsProvider, Msg91SmsProvider, validatePhone } from "../src/sms.js";

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

describe("Msg91SmsProvider", () => {
  test("sends via MSG91 API with authkey header", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return new Response(JSON.stringify({ message: "msg91-id-1", type: "success" }), { status: 200 });
    }) as typeof fetch;
    const p = new Msg91SmsProvider("auth-key", "SENDER", { fetchFn });
    const r = await p.sendSms("+919876543210", "hello");
    expect(r.messageId).toBe("msg91-id-1");
    expect(seen.url).toBe("https://api.msg91.com/api/v5/sms");
    expect((seen.headers as Record<string, string>)["authkey"]).toBe("auth-key");
    const body = JSON.parse(seen.body as string);
    expect(body.sender).toBe("SENDER");
    expect(body.mobiles).toBe("919876543210");
    expect(body.message).toBe("hello");
  });
  test("surfaces MSG91 API errors", async () => {
    const fetchFn = (async () => new Response("err", { status: 401 })) as typeof fetch;
    const p = new Msg91SmsProvider("k", "S", { fetchFn });
    await expect(p.sendSms("+15551234567", "hi")).rejects.toThrow("MSG91 error: 401");
  });
  test("validates config and phone", () => {
    expect(() => new Msg91SmsProvider("", "S")).toThrow();
    expect(() => new Msg91SmsProvider("k", "")).toThrow();
  });
  test("retries through SmsChannel on transient failure", async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls === 1) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({ message: "msg91-id-2" }), { status: 200 });
    }) as typeof fetch;
    const c = new SmsChannel({ provider: new Msg91SmsProvider("k", "S", { fetchFn }), retries: 1 });
    expect(c.providerName).toBe("msg91");
    const r = await c.send({ channel: "sms", to: "+15551234567", body: "hi" });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe("msg91-id-2");
  });
  test("channel rejects invalid phone before provider call", async () => {
    const c = new SmsChannel({ provider: new Msg91SmsProvider("k", "S") });
    expect((await c.send({ channel: "sms", to: "bad", body: "hi" })).success).toBe(false);
  });
});
