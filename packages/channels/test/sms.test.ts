import { describe, expect, test } from "bun:test";
import {
  SmsChannel,
  MockSmsProvider,
  Msg91SmsProvider,
  validatePhone,
  type Msg91Options,
  type SmsMessage,
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

  test("sends via MSG91 Flow API when templateId is configured", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return new Response(JSON.stringify({ message: "flow-msg-id-1", type: "success" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const p = new Msg91SmsProvider({
      authKey: "flow-key",
      templateId: "65a123bc456def789",
      fetchFn,
    });
    const r = await p.sendSms("+919876543210", "Your OTP is 4321");
    expect(r.messageId).toBe("flow-msg-id-1");
    expect(seen.url).toBe("https://control.msg91.com/api/v5/flow");
    expect((seen.headers as Record<string, string>)["authkey"]).toBe("flow-key");
    expect((seen.headers as Record<string, string>)["accept"]).toBe("application/json");
    const body = JSON.parse(seen.body as string);
    expect(body.template_id).toBe("65a123bc456def789");
    expect(body.recipients).toHaveLength(1);
    expect(body.recipients[0].mobiles).toBe("919876543210");
    expect(body.recipients[0].message).toBe("Your OTP is 4321");
  });

  test("supports dynamic variables, short_url, and per-message templateId override", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return new Response(JSON.stringify({ message: "flow-msg-id-override", type: "success" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const p = new Msg91SmsProvider("auth-key", "SENDER", { fetchFn });
    const r = await p.sendSms("+919876543210", "Welcome Alice", {
      templateId: "custom_template_999",
      variables: { VAR1: "Alice", code: 9999 },
      shortUrl: true,
    });
    expect(r.messageId).toBe("flow-msg-id-override");
    expect(seen.url).toBe("https://control.msg91.com/api/v5/flow");
    const body = JSON.parse(seen.body as string);
    expect(body.template_id).toBe("custom_template_999");
    expect(body.short_url).toBe("1");
    expect(body.recipients[0].mobiles).toBe("919876543210");
    expect(body.recipients[0].VAR1).toBe("Alice");
    expect(body.recipients[0].code).toBe(9999);
    expect(body.recipients[0].message).toBe("Welcome Alice");
  });

  test("works through SmsChannel with flow template options in payload", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return new Response(JSON.stringify({ message: "channel-flow-id", type: "success" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const c = new SmsChannel({
      provider: new Msg91SmsProvider({ authKey: "ak", templateId: "default_flow", fetchFn }),
    });
    const payload: SmsMessage = {
      channel: "sms",
      to: "+919876543210",
      body: "Flight confirmed",
      templateId: "flight_flow_id",
      variables: { PNR: "ABCDEF" },
      shortUrl: false,
    };
    const r = await c.send(payload);
    expect(r.success).toBe(true);
    expect(r.messageId).toBe("channel-flow-id");
    const body = JSON.parse(seen.body as string);
    expect(body.template_id).toBe("flight_flow_id");
    expect(body.short_url).toBe("0");
    expect(body.recipients[0].PNR).toBe("ABCDEF");
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

  test("surfaces MSG91 Flow API error responses with hasError or status error", async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({ hasError: true, errors: "The provided flow ID or template ID is invalid." }),
        { status: 200 },
      )) as unknown as typeof fetch;
    const p = new Msg91SmsProvider({ authKey: "k", templateId: "invalid_tmpl", fetchFn });
    await expect(p.sendSms("+919876543210", "hi")).rejects.toThrow(
      "MSG91 error: The provided flow ID or template ID is invalid.",
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
    // When templateId is provided, sender ID is optional
    expect(() => new Msg91SmsProvider({ authKey: "k", templateId: "tmpl" })).not.toThrow();
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
