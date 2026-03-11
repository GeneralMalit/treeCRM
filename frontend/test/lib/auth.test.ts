import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredAccessToken,
  getLandingRoute,
  getStoredAccessToken,
  login,
  me,
  register,
  setStoredAccessToken,
} from "@/lib/auth";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("auth client", () => {
  it("surfaces server errors and parses successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: "Bad credentials" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            token: "token-1",
            user: { id: "user-1", email: "user@example.com", role: "Customer" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { sub: "user-1", email: "user@example.com", role: "Customer" } }),
        }),
    );

    await expect(login("user@example.com", "password123")).rejects.toThrow("Bad credentials");
    await expect(login("user@example.com", "password123")).resolves.toMatchObject({
      token: "token-1",
    });
    await expect(me("token-1")).resolves.toMatchObject({
      email: "user@example.com",
      role: "Customer",
    });
  });

  it("stores tokens locally and maps landing routes by role", () => {
    expect(getStoredAccessToken()).toBeNull();
    setStoredAccessToken("token-1");
    expect(getStoredAccessToken()).toBe("token-1");
    clearStoredAccessToken();
    expect(getStoredAccessToken()).toBeNull();
    expect(getLandingRoute("Admin")).toBe("/admin");
  });

  it("accepts register responses without an app token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ok",
          message: "User registered successfully.",
          emailConfirmationRequired: true,
          user: { id: "user-1", email: "user@example.com", role: "Customer" },
        }),
      }),
    );

    await expect(register("user@example.com", "password123", "User")).resolves.toMatchObject({
      emailConfirmationRequired: true,
      user: {
        role: "Customer",
      },
    });
  });
});
