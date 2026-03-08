import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

async function loadAuthRouter() {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      jwtSecret: "test-secret",
    },
    hasJwtSecret: true,
    hasSupabaseConfig: true,
  }));
  vi.doMock("../../src/services/supabaseClient", () => ({
    supabase: createSupabaseAuthMock({
      signUp: ok({
        user: {
          id: "user-1",
          email: "user@example.com",
          user_metadata: { role: "Customer", name: "User" },
        },
      }),
      signInWithPassword: ok({
        user: {
          id: "user-1",
          email: "user@example.com",
          user_metadata: { role: "Customer", name: "User" },
        },
      }),
    }),
  }));

  const { authRouter } = await import("../../src/routes/authRoutes");
  return createRouterApp(authRouter);
}

async function loadProtectedRouter() {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      jwtSecret: "test-secret",
    },
    hasJwtSecret: true,
  }));

  const { protectedRouter } = await import("../../src/routes/protectedRoutes");
  const app = express();
  app.use(express.json());
  app.use(protectedRouter);
  return app;
}

describe("auth and protected routes", () => {
  it("validates register/login and supports /auth/me", async () => {
    const app = await loadAuthRouter();

    const invalidRegister = await request(app).post("/register").send({ email: "", password: "short" });
    expect(invalidRegister.status).toBe(400);

    const registerResponse = await request(app)
      .post("/register")
      .send({ email: "user@example.com", password: "password123", role: "Customer", name: "User" });
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.role).toBe("Customer");

    const loginResponse = await request(app)
      .post("/login")
      .send({ email: "user@example.com", password: "password123" });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toEqual(expect.any(String));

    const meResponse = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user).toMatchObject({
      email: "user@example.com",
      role: "Customer",
    });

    const logoutResponse = await request(app)
      .post("/logout")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);
    expect(logoutResponse.status).toBe(200);
  });

  it("enforces auth and role-based access on protected routes", async () => {
    const app = await loadProtectedRouter();
    const customerToken = signTestJwt({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
    });
    const csrToken = signTestJwt({
      sub: "csr-1",
      email: "csr@example.com",
      role: "CSR",
    });

    const missingAuthResponse = await request(app).get("/portal");
    expect(missingAuthResponse.status).toBe(401);

    const forbiddenResponse = await request(app)
      .get("/employee/csr")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(forbiddenResponse.status).toBe(403);

    const allowedResponse = await request(app)
      .get("/employee/csr")
      .set("Authorization", `Bearer ${csrToken}`);
    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.body.message).toContain("CSR dashboard access granted");
  });
});
