import { describe, expect, it, vi } from "vitest";

describe("authLogic", () => {
  it("validates email and password", async () => {
    const { parseEmailPassword } = await import("../../src/domain/authLogic");

    expect(parseEmailPassword("", "password123")).toEqual({ error: "Email is required." });
    expect(parseEmailPassword("user@example.com", "short")).toEqual({
      error: "Password is required and must be at least 8 characters.",
    });
    expect(parseEmailPassword(" user@example.com ", "password123")).toEqual({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("normalizes invalid roles to the default role", async () => {
    const { normalizeUserRole } = await import("../../src/domain/authLogic");
    expect(normalizeUserRole("Bogus")).toBe("Customer");
    expect(normalizeUserRole("Admin")).toBe("Admin");
  });

  it("issues signed tokens when jwt config exists", async () => {
    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));

    const { issueToken } = await import("../../src/domain/authLogic");
    const token = issueToken({
      sub: "user-1",
      email: "user@example.com",
      role: "Customer",
    });

    expect(token).toEqual(expect.any(String));
  });
});
