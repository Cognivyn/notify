import { describe, expect, test } from "bun:test";
import {
  ApnsPushProvider,
  FcmPushProvider,
  FcmV1PushProvider,
  PushChannel,
  validateDeepLink,
  validateDeviceToken,
  type PushMessage,
} from "../src/push.js";

describe("PushChannel", () => {
  test("sends push", async () => {
    const c = new PushChannel();
    const r = await c.send({ channel: "push", to: "device-token-123", title: "Hi", body: "hello" });
    expect(r.success).toBe(true);
    expect(c.providerName).toBe("mock");
  });

  test("rejects empty body", async () => {
    const c = new PushChannel();
    expect((await c.send({ channel: "push", to: "tok", body: " " })).success).toBe(false);
  });

  test("token registry", () => {
    const c = new PushChannel();
    c.registerToken("u1", "t1");
    expect(c.getRegisteredTokens("u1")).toEqual(["t1"]);
  });

  test("retries on failure", async () => {
    const mock = new PushChannel({ retries: 1 });
    const r = await mock.send({ channel: "push", to: "tok", body: "retry test" });
    expect(r.success).toBe(true);
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

describe("FcmV1PushProvider", () => {
  test("sends message via modern FCM HTTP v1 API with Bearer token", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ name: "projects/my-firebase-app/messages/0:1700000000123" }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const provider = new FcmV1PushProvider({
      projectId: "my-firebase-app",
      accessToken: "oauth2-bearer-token",
      fetchFn,
    });

    const res = await provider.sendPush({
      token: "fcm-registration-token",
      title: "New Order",
      body: "You have a new order #101",
      imageUrl: "https://example.com/item.png",
      data: { orderId: 101, status: "pending" },
    });

    expect(res.messageId).toBe("projects/my-firebase-app/messages/0:1700000000123");
    expect(capturedUrl).toBe(
      "https://fcm.googleapis.com/v1/projects/my-firebase-app/messages:send",
    );
    expect(capturedHeaders["Authorization"]).toBe("Bearer oauth2-bearer-token");

    const message = capturedBody.message as {
      token: string;
      notification: { title: string; body: string; image?: string };
      data: Record<string, string>;
    };
    expect(message.token).toBe("fcm-registration-token");
    expect(message.notification.title).toBe("New Order");
    expect(message.notification.body).toBe("You have a new order #101");
    expect(message.notification.image).toBe("https://example.com/item.png");
    expect(message.data.orderId).toBe("101");
    expect(message.data.status).toBe("pending");
  });

  test("supports async token provider function", async () => {
    let called = false;
    const tokenProvider = async () => {
      called = true;
      return "dynamic-access-token";
    };

    let capturedHeaders: Record<string, string> = {};
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ name: "projects/p/messages/1" }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new FcmV1PushProvider({
      projectId: "p",
      accessToken: tokenProvider,
      fetchFn,
    });

    const res = await provider.sendPush({ token: "tok", title: "T", body: "B" });
    expect(res.messageId).toBe("projects/p/messages/1");
    expect(called).toBe(true);
    expect(capturedHeaders["Authorization"]).toBe("Bearer dynamic-access-token");
  });

  test("surfaces FCM v1 detailed error responses", async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 404,
            message: "Requested entity was not found.",
            status: "NOT_FOUND",
          },
        }),
        { status: 404 },
      )) as unknown as typeof fetch;

    const provider = new FcmV1PushProvider({
      projectId: "p",
      accessToken: "tok",
      fetchFn,
    });

    await expect(provider.sendPush({ token: "t", title: "T", body: "B" })).rejects.toThrow(
      "FCM v1 error: Requested entity was not found.",
    );
  });

  test("works through PushChannel", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ name: "projects/p/messages/msg-v1" }), {
        status: 200,
      })) as unknown as typeof fetch;

    const provider = new FcmV1PushProvider({
      projectId: "p",
      accessToken: "tok",
      fetchFn,
    });

    const channel = new PushChannel(provider);
    const res = await channel.send({
      channel: "push",
      to: "device-token-123",
      title: "Hello",
      body: "World",
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe("projects/p/messages/msg-v1");
  });

  test("validates constructor options", () => {
    expect(() => new FcmV1PushProvider({ projectId: "", accessToken: "tok" })).toThrow();
    expect(() => new FcmV1PushProvider({ projectId: "p", accessToken: "" })).toThrow();
  });
});

describe("FcmPushProvider (legacy)", () => {
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
