import { describe, expect, test } from "bun:test";
import {
  SmsChannel,
  MockSmsProvider,
  Msg91SmsProvider,
  validatePhone,
  type Msg91Options,
} from "../src/sms.js";

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
      return new Response(JSON.stringify({ message: "msg91-id-1", type: "success" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const p = new Msg91SmsProvider("auth-key", "SENDER", { fetchFn });
    const r = await p.sendSms("+919876543210", "hello");
    expect(r.messageId).toBe("msg91-id-1");
    expect(seen.url).toBe("https://api.msg91.com/api/v5/sms");
    expect((seen.headers as Record<string, string>)["authkey"]).toBe("auth-key");
    const body = JSON.parse(seen.body as string);
    expect(body.sender).toBe("SENDER");
    expect(body.route).toBe("4");
    expect(body.country).toBe("91");
    expect(body.mobiles).toBe("919876543210");
    expect(body.message).toBe("hello");
  });

  test("supports options object in constructor with custom route and country", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return new Response(JSON.stringify({ message: "msg91-id-custom", type: "success" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const opts: Msg91Options = {
      authKey: "opt-auth-key",
      sender: "ALERTS",
      route: "1",
      country: "1",
      fetchFn,
    };
    const p = new Msg91SmsProvider(opts);
    const r = await p.sendSms("+15551234567", "alert msg");
    expect(r.messageId).toBe("msg91-id-custom");
    expect((seen.headers as Record<string, string>)["authkey"]).toBe("opt-auth-key");
    const body = JSON.parse(seen.body as string);
    expect(body.sender).toBe("ALERTS");
    expect(body.route).toBe("1");
    expect(body.country).toBe("1");
    expect(body.mobiles).toBe("15551234567");
    expect(body.message).toBe("alert msg");
  });

  test("surfaces MSG91 HTTP errors", async () => {
    const fetchFn = (async () =>
      new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch;
    const p = new Msg91SmsProvider("k", "S", { fetchFn });
    await expect(p.sendSms("+15551234567", "hi")).rejects.toThrow("MSG91 error: 401");
  });

  test("surfaces MSG91 API error responses with HTTP 200", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ message: "IP not whitelisted", type: "error" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const p = new Msg91SmsProvider({ authKey: "k", sender: "S", fetchFn });
    await expect(p.sendSms("+15551234567", "hi")).rejects.toThrow(
      "MSG91 error: IP not whitelisted",
    );
  });

  test("validates required constructor parameters", () => {
    expect(() => new Msg91SmsProvider("", "S")).toThrow("MSG91 authKey required");
    expect(() => new Msg91SmsProvider("k", "")).toThrow("MSG91 sender ID required");
    expect(() => new Msg91SmsProvider({ authKey: "", sender: "S" })).toThrow(
      "MSG91 authKey required",
    );
    expect(() => new Msg91SmsProvider({ authKey: "k", sender: "" })).toThrow(
      "MSG91 sender ID required",
    );
  });

  test("validates destination phone number and message body", async () => {
    const p = new Msg91SmsProvider("k", "S");
    await expect(p.sendSms("bad-number", "hi")).rejects.toThrow(
      "Invalid E.164 phone number: bad-number",
    );
    await expect(p.sendSms("+15551234567", "   ")).rejects.toThrow("SMS body must not be empty");
  });

  test("retries through SmsChannel on transient failure", async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls === 1) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({ message: "msg91-id-2", type: "success" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
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
