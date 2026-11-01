import { describe, expect, test } from "bun:test";
import {
  EmailChannel,
  MockEmailProvider,
  ResendEmailProvider,
  SesEmailProvider,
  escapeHtml,
  renderTemplate,
  validateSubject,
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
    expect(c.providerName).toBe("mock");
  });

  test("rejects bad email", async () => {
    const c = new EmailChannel();
    const r = await c.send({ channel: "email", to: "bad", body: "hi" });
    expect(r.success).toBe(false);
  });

  test("retries on provider failure", async () => {
    const mock = new MockEmailProvider();
    mock.failNext = true;
    const c = new EmailChannel({ provider: mock, retries: 1 });
    const r = await c.send({
      channel: "email",
      to: "user@example.com",
      title: "Retry",
      body: "Hello",
    });
    expect(r.success).toBe(true);
    expect(mock.sent.length).toBe(1);
  });

  test("rejects CRLF injection in subject", async () => {
    const c = new EmailChannel();
    const r1 = await c.send({
      channel: "email",
      to: "user@example.com",
      title: "Hi\r\nBcc: evil@attacker.com",
      body: "Hello",
    });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("Email subject must not contain CRLF characters");

    const r2 = await c.send({
      channel: "email",
      to: "user@example.com",
      title: "Hi\nSubject: Spoofed",
      body: "Hello",
    });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain("Email subject must not contain CRLF characters");
  });

  test("template renderer", () => {
    const out = renderTemplate("Hello {{name}}, order {{id}}", { name: "Alice", id: 42 });
    expect(out).toBe("Hello Alice, order 42");
  });

  test("template renderer escapes HTML when requested", () => {
    const out = renderTemplate(
      "<div>Hello {{name}}</div>",
      { name: "<script>alert(1)</script>" },
      { escapeHtml: true },
    );
    expect(out).toBe("<div>Hello &lt;script&gt;alert(1)&lt;/script&gt;</div>");
  });

  test("escapeHtml escapes special characters", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  test("validateSubject enforces limits", () => {
    expect(() => validateSubject("Valid Subject")).not.toThrow();
    expect(() => validateSubject("Bad\nSubject")).toThrow("CRLF");
    expect(() => validateSubject("a".repeat(1000))).toThrow("maximum length");
  });
});

describe("ResendEmailProvider", () => {
  test("sends html + text via Resend API with cc, bcc, replyTo, tags, and attachments", async () => {
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
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      replyTo: "support@acme.com",
      tags: [{ name: "category", value: "receipts" }],
      attachments: [{ filename: "doc.txt", content: "file content" }],
    });
    expect(r.messageId).toBe("re_123");
    expect(seen.url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(seen.body as string);
    expect(body.from).toBe("noreply@acme.com");
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("Hi");
    expect(body.text).toBe("hello");
    expect(body.html).toBe("<b>hello</b>");
    expect(body.cc).toEqual(["cc@example.com"]);
    expect(body.bcc).toEqual(["bcc@example.com"]);
    expect(body.reply_to).toBe("support@acme.com");
    expect(body.tags).toEqual([{ name: "category", value: "receipts" }]);
    expect(body.attachments[0].filename).toBe("doc.txt");
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

  test("rejects CRLF in subject", async () => {
    const p = new ResendEmailProvider("k", "noreply@acme.com");
    await expect(
      p.sendEmail({ to: "a@b.com", subject: "Bad\r\nSubject", text: "x" }),
    ).rejects.toThrow("CRLF");
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
  test("sends SigV4-signed SESv2 request with cc, bcc, and replyTo", async () => {
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
    const r = await p.sendEmail({
      to: "a@b.com",
      subject: "Alert",
      text: "hi",
      html: "<b>hi</b>",
      cc: ["cc@acme.com"],
      bcc: ["bcc@acme.com"],
      replyTo: "support@acme.com",
      tags: [{ name: "tag1", value: "val1" }],
    });
    expect(r.messageId).toBe("ses-msg-123");
    expect(seen.url).toBe("https://email.us-east-1.amazonaws.com/v2/email/outbound-emails");
    const headers = seen.headers as Record<string, string>;
    expect(headers["x-amz-date"]).toBeDefined();
    expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=AKID/");
    const body = JSON.parse(seen.body as string);
    expect(body.Destination.ToAddresses).toEqual(["a@b.com"]);
    expect(body.Destination.CcAddresses).toEqual(["cc@acme.com"]);
    expect(body.Destination.BccAddresses).toEqual(["bcc@acme.com"]);
    expect(body.ReplyToAddresses).toEqual(["support@acme.com"]);
    expect(body.EmailTags).toEqual([{ ResourceTagName: "tag1", ResourceTagValue: "val1" }]);
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
