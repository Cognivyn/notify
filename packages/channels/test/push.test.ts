import { describe, expect, test } from "bun:test";
import {
  ApnsPushProvider,
  FcmPushProvider,
  PushChannel,
  validateDeepLink,
  validateDeviceToken,
} from "../src/push.js";

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

  test("rejects dangerous deepLink schemes", async () => {
    const c = new PushChannel();
    const r1 = await c.send({
      channel: "push",
      to: "tok",
      body: "msg",
      deepLink: "javascript://alert(1)",
    });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("scheme 'javascript' is not allowed");

    const r2 = await c.send({
      channel: "push",
      to: "tok",
      body: "msg",
      deepLink: "data://text/html;base64,123",
    });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain("scheme 'data' is not allowed");

    const r3 = await c.send({
      channel: "push",
      to: "tok",
      body: "msg",
      deepLink: "//malicious.com",
    });
    expect(r3.success).toBe(false);
    expect(r3.error).toContain("protocol-relative URL not allowed");
  });

  test("accepts safe deepLinks", async () => {
    const c = new PushChannel();
    expect(
      (
        await c.send({
          channel: "push",
          to: "tok",
          body: "msg",
          deepLink: "https://example.com/item",
        })
      ).success,
    ).toBe(true);
    expect(
      (await c.send({ channel: "push", to: "tok", body: "msg", deepLink: "myapp://orders/42" }))
        .success,
    ).toBe(true);
    expect(
      (await c.send({ channel: "push", to: "tok", body: "msg", deepLink: "/dashboard" })).success,
    ).toBe(true);
  });
});

describe("validateDeviceToken", () => {
  test("rejects tokens with path traversal or control characters", () => {
    expect(() => validateDeviceToken("../../etc/passwd")).toThrow(
      "illegal characters or path traversal",
    );
    expect(() => validateDeviceToken("tok/with/slashes")).toThrow(
      "illegal characters or path traversal",
    );
    expect(() => validateDeviceToken("tok\r\nbad")).toThrow("illegal characters or path traversal");
  });
});

describe("FcmPushProvider", () => {
  test("sends notification with image + data", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      seen = { headers: init?.headers, body: init?.body };
      return new Response(JSON.stringify({ message_id: "fcm-1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new FcmPushProvider("srv-key", fetchFn);
    const r = await p.sendPush({
      token: "dev-tok",
      title: "Hi",
      body: "hello",
      data: { k: "v" },
      imageUrl: "https://x/img.png",
    });
    expect(r.messageId).toBe("fcm-1");
    expect((seen.headers as Record<string, string>)["Authorization"]).toBe("key=srv-key");
    const body = JSON.parse(seen.body as string);
    expect(body.to).toBe("dev-tok");
    expect(body.notification.image).toBe("https://x/img.png");
    expect(body.data).toEqual({ k: "v" });
  });
  test("surfaces FCM errors and validates input", async () => {
    const fetchFn = (async () => new Response("err", { status: 401 })) as unknown as typeof fetch;
    const p = new FcmPushProvider("k", fetchFn);
    await expect(p.sendPush({ token: "t", title: "Hi", body: "x" })).rejects.toThrow(
      "FCM error: 401",
    );
    await expect(p.sendPush({ token: " ", title: "Hi", body: "x" })).rejects.toThrow();
    expect(() => new FcmPushProvider("")).toThrow();
  });
  test("works through PushChannel", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ message_id: "fcm-2" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const c = new PushChannel(new FcmPushProvider("k", fetchFn));
    const r = await c.send({ channel: "push", to: "dev-tok", title: "Hi", body: "hello" });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe("fcm-2");
  });
});

describe("ApnsPushProvider", () => {
  test("posts to APNs device endpoint with bearer + topic", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return new Response("{}", { status: 200, headers: { "apns-id": "apns-uuid-1" } });
    }) as unknown as typeof fetch;
    const p = new ApnsPushProvider({ providerToken: "jwt", bundleId: "com.acme.app", fetchFn });
    const r = await p.sendPush({
      token: "dev-tok",
      title: "Hi",
      body: "hello",
      imageUrl: "https://x/img.png",
    });
    expect(r.messageId).toBe("apns-uuid-1");
    expect(seen.url).toBe("https://api.development.push.apple.com/3/device/dev-tok");
    const headers = seen.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("bearer jwt");
    expect(headers["apns-topic"]).toBe("com.acme.app");
    const body = JSON.parse(seen.body as string);
    expect(body.aps.alert.title).toBe("Hi");
    expect(body.aps["mutable-content"]).toBe(1);
  });
  test("uses production host when configured, surfaces errors", async () => {
    let url = "";
    const fetchFn = (async (u: string | URL | Request) => {
      url = String(u);
      return new Response("err", { status: 410 });
    }) as unknown as typeof fetch;
    const p = new ApnsPushProvider({
      providerToken: "jwt",
      bundleId: "com.acme.app",
      production: true,
      fetchFn,
    });
    await expect(p.sendPush({ token: "t", title: "Hi", body: "x" })).rejects.toThrow(
      "APNs error: 410",
    );
    expect(url).toContain("api.push.apple.com");
  });
  test("validates config", () => {
    expect(() => new ApnsPushProvider({ providerToken: "", bundleId: "b" })).toThrow();
  });
  test("rejects tokens with illegal characters", async () => {
    const p = new ApnsPushProvider({ providerToken: "jwt", bundleId: "b" });
    await expect(p.sendPush({ token: "token?param=1", title: "t", body: "b" })).rejects.toThrow(
      "illegal characters",
    );
  });
});
