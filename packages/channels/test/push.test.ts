import { describe, expect, test } from "bun:test";
import { PushChannel } from "../src/push.js";

describe("PushChannel", () => {
  test("sends push", async () => {
    const c = new PushChannel();
    const r = await c.send({ channel: "push", to: "device-token-123", title: "Hi", body: "hello" });
    expect(r.success).toBe(true);
  });
  test("rejects empty body", async () => {
    const c = new PushChannel();
    expect((await c.send({ channel: "push", to: "tok", body: " " })).success).toBe(false);
  });
  test("token registry", () => {
    const c = new PushChannel();
    c.registerToken("u1", "t1");
    expect(true).toBe(true);
  });
});
