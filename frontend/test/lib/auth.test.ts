import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredAccessToken,
  getLandingRoute,
  getStoredAccessToken,
  login,
  logout,
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

  it("surfaces malformed auth payloads and logs out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          message: "ok",
          user: { id: "user-1", email: "user@example.com", role: "Bogus" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          message: "ok",
          user: { id: "user-1", email: "user@example.com", role: "Customer" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          message: "ok",
          user: { sub: "user-1", email: "user@example.com", role: "Bogus" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ok", user: { sub: "user-1", email: "user@example.com", role: "Customer" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(register("user@example.com", "password123")).rejects.toThrow(
      "Unexpected registration response format.",
    );
    await expect(login("user@example.com", "password123")).rejects.toThrow(
      "Unexpected login response format.",
    );
    await expect(me("token-1")).rejects.toThrow("Unexpected /auth/me response format.");
    await expect(logout("token-1")).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[3]?.[0]).toBe("http://localhost:4000/auth/logout");
  });

  it("maps landing routes for all supported roles", () => {
    expect(getLandingRoute("CSR")).toBe("/employee/csr");
    expect(getLandingRoute("Manager")).toBe("/employee/manager");
    expect(getLandingRoute("Executive")).toBe("/employee/executive");
    expect(getLandingRoute("Customer")).toBe("/portal");
  });
});
