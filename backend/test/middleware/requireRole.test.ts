import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireRole } from "../../src/middleware/requireRole";

function buildApp(role?: string) {
  const app = express();
  app.use(express.json());
  app.get(
    "/protected",
    (req, _res, next) => {
      if (role) {
        req.user = {
          sub: "user-1",
          email: "user@example.com",
          role,
          emailVerified: true,
        };
      }
      next();
    },
    requireRole("Admin", "Manager"),
    (_req, res) => {
      res.json({ status: "ok" });
    },
  );
  return app;
}

describe("requireRole", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request(buildApp()).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Authentication is required");
  });

  it("rejects disallowed roles", async () => {
    const response = await request(buildApp("Customer")).get("/protected");

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Access denied");
  });

  it("allows matching roles", async () => {
    const response = await request(buildApp("Manager")).get("/protected");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
