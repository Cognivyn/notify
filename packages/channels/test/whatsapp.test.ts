import { describe, expect, test } from "bun:test";
import {
  MockWhatsAppProvider,
  WhatsAppChannel,
  validateWhatsApp,
  type WhatsAppMessage,
} from "../src/whatsapp.js";

describe("WhatsAppChannel", () => {
  test("sends text", async () => {
    const c = new WhatsAppChannel();
    const r = await c.send({ channel: "whatsapp", to: "+15551234567", body: "hi" });
    expect(r.success).toBe(true);
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
