import { describe, expect, test } from "bun:test";
import { EmailChannel, ResendEmailProvider, SesEmailProvider, renderTemplate } from "../src/email.js";

const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

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

describe("ResendEmailProvider", () => {
  test("sends html + text via Resend API", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), auth: (init?.headers as Record<string, string>)["Authorization"], body: init?.body };
      return okJson({ id: "re_123" });
    }) as typeof fetch;
    const p = new ResendEmailProvider("re_key", "noreply@acme.com", fetchFn);
    const r = await p.sendEmail({ to: "a@b.com", subject: "Hi", text: "hello", html: "<b>hello</b>" });
    expect(r.messageId).toBe("re_123");
    expect(seen.url).toBe("https://api.resend.com/emails");
    expect(seen.auth).toBe("Bearer re_key");
    const body = JSON.parse(seen.body as string);
    expect(body.from).toBe("noreply@acme.com");
    expect(body.html).toBe("<b>hello</b>");
  });
  test("surfaces Resend API errors", async () => {
    const fetchFn = (async () => new Response("bad", { status: 422 })) as typeof fetch;
    const p = new ResendEmailProvider("k", "noreply@acme.com", fetchFn);
    await expect(p.sendEmail({ to: "a@b.com", subject: "Hi", text: "x" })).rejects.toThrow("Resend error: 422");
  });
  test("validates config and recipients", () => {
    expect(() => new ResendEmailProvider("", "noreply@acme.com")).toThrow();
    expect(() => new ResendEmailProvider("k", "bad")).toThrow();
  });
  test("works through EmailChannel with html payload", async () => {
    const fetchFn = (async () => okJson({ id: "re_1" })) as typeof fetch;
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
      return okJson({ MessageId: "ses-msg-1" });
    }) as typeof fetch;
    const p = new SesEmailProvider({
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      region: "us-east-1",
      from: "noreply@acme.com",
      fetchFn,
    });
    const r = await p.sendEmail({ to: "a@b.com", subject: "Hi", text: "hello", html: "<b>hi</b>" });
    expect(r.messageId).toBe("ses-msg-1");
    expect(seen.url).toBe("https://email.us-east-1.amazonaws.com/v2/email/outbound-emails");
    const headers = seen.headers as Record<string, string>;
    expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=AKID/");
    const body = JSON.parse(seen.body as string);
    expect(body.Destination.ToAddresses).toEqual(["a@b.com"]);
    expect(body.Content.Simple.Body.Html.Data).toBe("<b>hi</b>");
  });
  test("surfaces SES errors", async () => {
    const fetchFn = (async () => new Response("err", { status: 400 })) as typeof fetch;
    const p = new SesEmailProvider({ accessKeyId: "A", secretAccessKey: "S", region: "eu-west-1", from: "n@acme.com", fetchFn });
    await expect(p.sendEmail({ to: "a@b.com", subject: "Hi", text: "x" })).rejects.toThrow("SES error: 400");
  });
  test("validates config", () => {
    expect(() => new SesEmailProvider({ accessKeyId: "", secretAccessKey: "s", region: "r", from: "n@acme.com" })).toThrow();
  });
});
