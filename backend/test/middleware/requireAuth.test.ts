import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signTestJwt } from "../utils/testJwt";

async function loadRequireAuth(options?: { hasJwtSecret?: boolean; jwtSecret?: string }) {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      jwtSecret: options?.jwtSecret ?? "test-secret",
    },
    hasJwtSecret: options?.hasJwtSecret ?? true,
  }));

  const { requireAuth } = await import("../../src/middleware/requireAuth");
  const app = express();
  app.use(express.json());
  app.get("/protected", requireAuth, (_req, res) => {
    res.json({ status: "ok" });
  });
  return app;
}

describe("requireAuth", () => {
  it("rejects requests when jwt config is missing", async () => {
    const app = await loadRequireAuth({ hasJwtSecret: false });

    const response = await request(app).get("/protected");

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("JWT_SECRET");
  });

  it("rejects requests without a bearer token", async () => {
    const app = await loadRequireAuth();

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Authorization header");
  });

  it("rejects malformed and invalid tokens", async () => {
    const app = await loadRequireAuth();

    const malformedResponse = await request(app).get("/protected").set("Authorization", "Token abc");
    expect(malformedResponse.status).toBe(401);

    const invalidResponse = await request(app).get("/protected").set("Authorization", "Bearer not-a-token");
    expect(invalidResponse.status).toBe(401);
  });

  it("accepts valid verified tokens", async () => {
    const app = await loadRequireAuth();
    const token = signTestJwt({
      sub: "user-1",
      email: "user@example.com",
      role: "Customer",
      name: "User",
    });

    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
