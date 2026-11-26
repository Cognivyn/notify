import { describe, expect, test, spyOn } from "bun:test";
import { main } from "../src/index.js";

describe("CLI", () => {
  test("help exits 0", async () => {
    expect(await main(["--help"])).toBe(0);
  });
  test("providers lists Fast2SMS for SMS and WhatsApp", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await main(["providers"])).toBe(0);
      const output = log.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(output).toContain("sms(mock,twilio,msg91,fast2sms)");
      expect(output).toContain("whatsapp(mock,cloudapi,twilio,fast2sms)");
    } finally {
      log.mockRestore();
    }
  });
  test("test sms mock", async () => {
    const c = await main(["test", "sms", "--to", "+15551234567", "--body", "hi"]);
    expect(c).toBe(0);
  });
  test("test fails with bad dest", async () => {
    expect(await main(["test", "sms", "--to", "bad", "--body", "hi"])).toBe(2);
  });
  test("auth setup validates", async () => {
    expect(await main(["auth", "setup", "sms", "--api-key", "k"])).toBe(0);
    expect(await main(["auth", "setup", "sms"])).toBe(1);
  });
});
