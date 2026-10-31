import { describe, expect, test } from "bun:test";
import {
  EmailChannel,
  MockEmailProvider,
  ResendEmailProvider,
  SesEmailProvider,
  renderTemplate,
} from "../src/email.js";

const okJson = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("EmailChannel", () => {
  test("sends email", async () => {
    const c = new EmailChannel();
    const r = await c.send({
      channel: "email",
      to: "user@example.com",
      title: "Hi",
      body: "Hello",
    });
    expect(r.success).toBe(true);
    expect(r.messageId).toContain("email-mock");
  });
  test("rejects bad email", async () => {
    const c = new EmailChannel();
    const r = await c.send({ channel: "email", to: "bad", body: "hi" });
    expect(r.success).toBe(false);
  });
  test("template renderer", () => {
    const out = renderTemplate("Hello {{name}}, order {{id}}", { name: "Alice", id: 42 });
    expect(out).toBe("Hello Alice, order 42");
  });
});

describe("ResendEmailProvider", () => {
  test("sends html + text via Resend API", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return okJson({ id: "re_123" });
    }) as unknown as typeof fetch;
    const p = new ResendEmailProvider("resend-key", "noreply@acme.com", fetchFn);
    const r = await p.sendEmail({
      to: "user@example.com",
      subject: "Hi",
      text: "hello",
      html: "<b>hello</b>",
    });
    expect(r.messageId).toBe("re_123");
    expect(seen.url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(seen.body as string);
    expect(body.from).toBe("noreply@acme.com");
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("Hi");
    expect(body.text).toBe("hello");
    expect(body.html).toBe("<b>hello</b>");
  });
  test("surfaces Resend API errors", async () => {
    const fetchFn = (async () => new Response("bad", { status: 422 })) as unknown as typeof fetch;
    const p = new ResendEmailProvider("k", "noreply@acme.com", fetchFn);
    await expect(p.sendEmail({ to: "a@b.com", subject: "Hi", text: "x" })).rejects.toThrow(
      "Resend error: 422",
    );
  });
  test("validates config and recipients", () => {
    expect(() => new ResendEmailProvider("", "noreply@acme.com")).toThrow();
    expect(() => new ResendEmailProvider("k", "bad")).toThrow();
  });
  test("works through EmailChannel with html payload", async () => {
    const fetchFn = (async () => okJson({ id: "re_1" })) as unknown as typeof fetch;
    const c = new EmailChannel(new ResendEmailProvider("k", "noreply@acme.com", fetchFn));
    expect(c.providerName).toBe("resend");
    const r = await c.send({
      channel: "email",
      to: "a@b.com",
      title: "Hi",
      body: "hello",
      data: { html: "<b>hello</b>" },
    });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe("re_1");
  });
});

describe("SesEmailProvider", () => {
  test("sends SigV4-signed SESv2 request", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), headers: init?.headers, body: init?.body };
      return okJson({ MessageId: "ses-msg-123" });
    }) as unknown as typeof fetch;
    const p = new SesEmailProvider({
      accessKeyId: "AKID",
      secretAccessKey: "SECRET123",
      region: "us-east-1",
      from: "alerts@acme.com",
      fetchFn,
    });
    const r = await p.sendEmail({ to: "a@b.com", subject: "Alert", text: "hi", html: "<b>hi</b>" });
    expect(r.messageId).toBe("ses-msg-123");
    expect(seen.url).toBe("https://email.us-east-1.amazonaws.com/v2/email/outbound-emails");
    const headers = seen.headers as Record<string, string>;
    expect(headers["x-amz-date"]).toBeDefined();
    expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=AKID/");
    const body = JSON.parse(seen.body as string);
    expect(body.Destination.ToAddresses).toEqual(["a@b.com"]);
    expect(body.Content.Simple.Body.Html.Data).toBe("<b>hi</b>");
  });
  test("surfaces SES errors", async () => {
    const fetchFn = (async () => new Response("err", { status: 400 })) as unknown as typeof fetch;
    const p = new SesEmailProvider({
      accessKeyId: "A",
      secretAccessKey: "S",
      region: "eu-west-1",
      from: "n@acme.com",
      fetchFn,
    });
    await expect(p.sendEmail({ to: "a@b.com", subject: "Hi", text: "x" })).rejects.toThrow(
      "SES error: 400",
    );
  });
  test("validates config", () => {
    expect(
      () =>
        new SesEmailProvider({
          accessKeyId: "",
          secretAccessKey: "s",
          region: "r",
          from: "n@acme.com",
        }),
    ).toThrow();
  });
});
