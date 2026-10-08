import { describe, expect, test } from "bun:test";
import { main } from "../src/index.js";

describe("CLI", () => {
  test("help exits 0", async () => {
    expect(await main(["--help"])).toBe(0);
  });
  test("providers exits 0", async () => {
    expect(await main(["providers"])).toBe(0);
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
