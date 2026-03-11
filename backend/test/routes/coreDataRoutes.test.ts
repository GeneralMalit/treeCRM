import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock, ok } from "../utils/mockSupabase";
import { signTestJwt } from "../utils/testJwt";

async function loadCoreDataApp() {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      jwtSecret: "test-secret",
    },
    hasJwtSecret: true,
  }));

  const updateUserById = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
      },
    },
    error: null,
  });

  vi.doMock("../../src/services/supabaseClient", () => ({
    hasSupabaseAdmin: true,
    supabaseAdmin: {
      ...createSupabaseAdminMock({
        users: {
          maybeSingle: ok({
            id: "550e8400-e29b-41d4-a716-446655440000",
            email: "target@example.com",
            name: "Target User",
            role: "Admin",
          }),
        },
      }),
      auth: {
        admin: {
          updateUserById,
        },
      },
    },
  }));

  const { coreDataRouter } = await import("../../src/routes/coreDataRoutes");
  const app = express();
  app.use(express.json());
  app.use("/data", coreDataRouter);

  return {
    app,
    updateUserById,
  };
}

describe("coreDataRoutes", () => {
  it("blocks non-admin users from assigning privileged roles", async () => {
    const { app, updateUserById } = await loadCoreDataApp();
    const customerToken = signTestJwt({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
    });

    const response = await request(app)
      .patch("/data/users/550e8400-e29b-41d4-a716-446655440000")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("allows admin users to assign privileged roles", async () => {
    const { app, updateUserById } = await loadCoreDataApp();
    const adminToken = signTestJwt({
      sub: "admin-1",
      email: "admin@example.com",
      role: "Admin",
    });

    const response = await request(app)
      .patch("/data/users/550e8400-e29b-41d4-a716-446655440000")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000", {
      email: "target@example.com",
      user_metadata: {
        role: "Admin",
        name: "Target User",
      },
    });
    expect(response.body.data.role).toBe("Admin");
  });
});
