import { describe, expect, test } from "bun:test";
import { ApiKeyAuth, ClientSecretAuth, SecureStore, createAuthProvider, AuthError } from "../src/index.js";

describe("ApiKeyAuth", () => {
  test("builds bearer header", () => {
    const a = new ApiKeyAuth("secret123");
    expect(a.headers()).toEqual({ Authorization: "Bearer secret123" });
    expect(a.describe()).not.toContain("secret123");
  });
  test("rejects empty key", () => {
    expect(() => new ApiKeyAuth("")).toThrow(AuthError);
  });
  test("fromEnv reads env", () => {
    const a = ApiKeyAuth.fromEnv({ NOTIFY_API_KEY: "k" } as Record<string, string>);
    expect(a.headers()["Authorization"]).toContain("k");
    expect(() => ApiKeyAuth.fromEnv({} as Record<string, string>)).toThrow(AuthError);
  });
});

describe("ClientSecretAuth", () => {
  test("builds basic header", () => {
    const secretVal = "s3cr3t-value-xyz";
    const a = new ClientSecretAuth("id", secretVal);
    const h = a.headers()["Authorization"];
    expect(h.startsWith("Basic ")).toBe(true);
    expect(a.describe()).not.toContain(secretVal);
  });
  test("rejects empty parts", () => {
    expect(() => new ClientSecretAuth("", "s")).toThrow(AuthError);
    expect(() => new ClientSecretAuth("i", "")).toThrow(AuthError);
  });
  test("getBearerToken delegates", async () => {
    const a = new ClientSecretAuth("id", "s");
    const t = await a.getBearerToken(async () => "tok");
    expect(t).toBe("tok");
  });
});

describe("createAuthProvider", () => {
  test("picks apiKey first", () => {
    expect(createAuthProvider({ apiKey: "k" }).name).toBe("apiKey");
  });
  test("throws when empty", () => {
    expect(() => createAuthProvider({})).toThrow(AuthError);
  });
});

describe("SecureStore", () => {
  test("set/get/require/listKeys", () => {
    const s = new SecureStore();
    s.set("A", "1");
    expect(s.get("A")).toBe("1");
    expect(s.require("A")).toBe("1");
    expect(s.listKeys()).toEqual(["A"]);
    s.delete("A");
    expect(s.get("A", false)).toBeUndefined();
  });
  test("env fallback", () => {
    process.env["NOTIFY_TEST_XYZ"] = "v";
    const s = new SecureStore();
    expect(s.get("NOTIFY_TEST_XYZ")).toBe("v");
    delete process.env["NOTIFY_TEST_XYZ"];
  });
  test("require throws when missing", () => {
    expect(() => new SecureStore().require("NOPE_XYZ")).toThrow(AuthError);
  });
});
