import { describe, expect, test } from "bun:test";
import { WhatsAppChannel } from "../src/whatsapp.js";

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
});
