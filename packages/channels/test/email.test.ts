import { describe, expect, test } from "bun:test";
import { EmailChannel, renderTemplate } from "../src/email.js";

describe("EmailChannel", () => {
  test("sends email", async () => {
    const c = new EmailChannel();
    const r = await c.send({ channel: "email", to: "a@b.com", title: "Hi", body: "hello" });
    expect(r.success).toBe(true);
  });
  test("rejects bad email", async () => {
    const c = new EmailChannel();
    expect((await c.send({ channel: "email", to: "bad", body: "hi" })).success).toBe(false);
  });
  test("template renderer", () => {
    expect(renderTemplate("Hi {{name}}", { name: "Bo" })).toBe("Hi Bo");
  });
});
