import { describe, expect, test } from "bun:test";
import {
  MockWhatsAppProvider,
  TwilioWhatsAppProvider,
  WhatsAppChannel,
  WhatsAppCloudApiProvider,
  validateWhatsApp,
  type WhatsAppMessage,
} from "../src/whatsapp.js";

describe("WhatsAppChannel", () => {
  test("sends text", async () => {
    const c = new WhatsAppChannel();
    const r = await c.send({ channel: "whatsapp", to: "+15551234567", body: "hi" });
    expect(r.success).toBe(true);
    expect(c.providerName).toBe("mock");
  });

  test("template + media", async () => {
    const c = new WhatsAppChannel();
    const r = await c.send({
      channel: "whatsapp",
      to: "+15551234567",
      body: "code 123",
      data: {},
    } as never);
    expect(r.success).toBe(true);
  });

  test("rejects bad phone", async () => {
    const c = new WhatsAppChannel();
    expect((await c.send({ channel: "whatsapp", to: "x", body: "hi" })).success).toBe(false);
  });

  test("replaces multiple {{body}} occurrences without replacement pattern injection", async () => {
    const mock = new MockWhatsAppProvider();
    const c = new WhatsAppChannel(mock);
    const msg: WhatsAppMessage = {
      channel: "whatsapp",
      to: "+15551234567",
      body: "Price is $100 & fee is $& total",
      template: "Notice: {{body}} - repeat: {{body}}",
    };
    const r = await c.send(msg);
    expect(r.success).toBe(true);
    expect(mock.sent[0].body).toBe(
      "Notice: Price is $100 & fee is $& total - repeat: Price is $100 & fee is $& total",
    );
  });

  test("retries on failure", async () => {
    const mock = new MockWhatsAppProvider();
    mock.failNext = true;
    const c = new WhatsAppChannel({ provider: mock, retries: 1 });
    const r = await c.send({ channel: "whatsapp", to: "+15551234567", body: "retry test" });
    expect(r.success).toBe(true);
    expect(mock.sent.length).toBe(1);
  });

  test("validateWhatsApp validates mediaUrl format", () => {
    expect(() =>
      validateWhatsApp({
        channel: "whatsapp",
        to: "+15551234567",
        body: "hi",
        mediaUrl: "javascript://alert(1)",
      }),
    ).toThrow("mediaUrl must be a valid http(s) URL");

    expect(() =>
      validateWhatsApp({
        channel: "whatsapp",
        to: "+15551234567",
        body: "hi",
        mediaUrl: "https://example.com/image.png\r\nBad-Header: true",
      }),
    ).toThrow("mediaUrl must be a valid http(s) URL");
  });
});

describe("WhatsAppCloudApiProvider", () => {
  test("sends text message via Meta Graph API v21.0", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ input: "15551234567", wa_id: "15551234567" }],
          messages: [{ id: "wamid.HBgL12345" }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const provider = new WhatsAppCloudApiProvider({
      accessToken: "meta-access-token",
      phoneNumberId: "10987654321",
      fetchFn,
    });

    const res = await provider.sendWhatsApp({
      to: "+15551234567",
      body: "Hello from Meta Cloud API!",
      previewUrl: true,
    });

    expect(res.messageId).toBe("wamid.HBgL12345");
    expect(capturedUrl).toBe("https://graph.facebook.com/v21.0/10987654321/messages");
    expect(capturedHeaders["Authorization"]).toBe("Bearer meta-access-token");
    expect(capturedBody.to).toBe("15551234567");
    expect(capturedBody.type).toBe("text");
    expect((capturedBody.text as { body: string }).body).toBe("Hello from Meta Cloud API!");
    expect((capturedBody.text as { preview_url: boolean }).preview_url).toBe(true);
  });

  test("sends template message with components", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.tmpl-999" }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const provider = new WhatsAppCloudApiProvider({
      accessToken: "meta-tok",
      phoneNumberId: "12345",
      fetchFn,
    });

    const res = await provider.sendWhatsApp({
      to: "+15551234567",
      body: "",
      templateName: "order_confirmation",
      languageCode: "en_US",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "Order #456" }],
        },
      ],
    });

    expect(res.messageId).toBe("wamid.tmpl-999");
    expect(capturedBody.type).toBe("template");
    const tmpl = capturedBody.template as {
      name: string;
      language: { code: string };
      components: unknown[];
    };
    expect(tmpl.name).toBe("order_confirmation");
    expect(tmpl.language.code).toBe("en_US");
    expect(tmpl.components.length).toBe(1);
  });

  test("sends media message with caption", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.media-1" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new WhatsAppCloudApiProvider({
      accessToken: "meta-tok",
      phoneNumberId: "12345",
      fetchFn,
    });

    const res = await provider.sendWhatsApp({
      to: "+15551234567",
      body: "Invoice receipt",
      mediaUrl: "https://example.com/receipt.pdf",
      mediaType: "document",
    });

    expect(res.messageId).toBe("wamid.media-1");
    expect(capturedBody.type).toBe("document");
    expect((capturedBody.document as { link: string; caption: string }).link).toBe(
      "https://example.com/receipt.pdf",
    );
    expect((capturedBody.document as { caption: string }).caption).toBe("Invoice receipt");
  });

  test("surfaces Meta Graph API error messages", async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid OAuth access token.",
            type: "OAuthException",
            code: 190,
          },
        }),
        { status: 401 },
      )) as unknown as typeof fetch;

    const provider = new WhatsAppCloudApiProvider({
      accessToken: "invalid-tok",
      phoneNumberId: "12345",
      fetchFn,
    });

    await expect(provider.sendWhatsApp({ to: "+15551234567", body: "test" })).rejects.toThrow(
      "WhatsApp Cloud API error: Invalid OAuth access token.",
    );
  });

  test("validates required options", () => {
    expect(() => new WhatsAppCloudApiProvider({ accessToken: "", phoneNumberId: "123" })).toThrow();
    expect(() => new WhatsAppCloudApiProvider({ accessToken: "abc", phoneNumberId: "" })).toThrow();
  });
});

describe("TwilioWhatsAppProvider", () => {
  test("sends text message with automatic whatsapp: prefix", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ sid: "SM1234567890" }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new TwilioWhatsAppProvider({
      accountSid: "AC1234567890abcdef",
      authToken: "auth-secret",
      from: "+14155238886",
      fetchFn,
    });

    const res = await provider.sendWhatsApp({
      to: "+15551234567",
      body: "Twilio WhatsApp test",
    });

    const capturedParams = new URLSearchParams(capturedBody);
    expect(res.messageId).toBe("SM1234567890");
    expect(capturedUrl).toContain("AC1234567890abcdef/Messages.json");
    expect(capturedParams.get("To")).toBe("whatsapp:+15551234567");
    expect(capturedParams.get("From")).toBe("whatsapp:+14155238886");
    expect(capturedParams.get("Body")).toBe("Twilio WhatsApp test");
    expect(capturedHeaders["Authorization"]).toBe(
      `Basic ${Buffer.from("AC1234567890abcdef:auth-secret").toString("base64")}`,
    );
  });

  test("sends media message with MediaUrl param", async () => {
    let capturedBody = "";
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ sid: "MM1234567890" }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new TwilioWhatsAppProvider({
      accountSid: "AC1234567890abcdef",
      authToken: "auth-secret",
      from: "whatsapp:+14155238886",
      fetchFn,
    });

    const res = await provider.sendWhatsApp({
      to: "whatsapp:+15551234567",
      body: "Here is your picture",
      mediaUrl: "https://example.com/pic.jpg",
    });

    const capturedParams = new URLSearchParams(capturedBody);
    expect(res.messageId).toBe("MM1234567890");
    expect(capturedParams.get("MediaUrl")).toBe("https://example.com/pic.jpg");
  });

  test("surfaces Twilio error status", async () => {
    const fetchFn = (async () =>
      new Response("Forbidden", { status: 403 })) as unknown as typeof fetch;
    const provider = new TwilioWhatsAppProvider({
      accountSid: "AC1234567890abcdef",
      authToken: "bad",
      from: "+14155238886",
      fetchFn,
    });

    await expect(provider.sendWhatsApp({ to: "+15551234567", body: "test" })).rejects.toThrow(
      "Twilio WhatsApp error: 403",
    );
  });

  test("validates constructor options and characters", () => {
    expect(
      () => new TwilioWhatsAppProvider({ accountSid: "", authToken: "x", from: "y" }),
    ).toThrow();
    expect(
      () => new TwilioWhatsAppProvider({ accountSid: "AC bad; sid", authToken: "x", from: "y" }),
    ).toThrow("Twilio accountSid contains illegal characters");
    expect(
      () => new TwilioWhatsAppProvider({ accountSid: "AC123", authToken: "", from: "y" }),
    ).toThrow();
    expect(
      () => new TwilioWhatsAppProvider({ accountSid: "AC123", authToken: "x", from: "" }),
    ).toThrow();
  });
});
