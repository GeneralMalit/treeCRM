import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

type AuthRouterOptions = {
  signUp?: ReturnType<typeof ok>;
  signInWithPassword?: ReturnType<typeof ok>;
};

async function loadAuthRouter(options?: AuthRouterOptions) {
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
      signUp:
        options?.signUp ??
        ok({
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: { role: "Customer", name: "User" },
            email_confirmed_at: "2026-03-08T00:00:00.000Z",
          },
          session: { access_token: "supabase-session-token" },
        }),
      signInWithPassword:
        options?.signInWithPassword ??
        ok({
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: { role: "Customer", name: "User" },
            email_confirmed_at: "2026-03-08T00:00:00.000Z",
          },
          session: { access_token: "supabase-session-token" },
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
      .send({ email: "user@example.com", password: "password123", role: "Admin", name: "User" });
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.role).toBe("Customer");
    expect(registerResponse.body.token).toEqual(expect.any(String));

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

  it("does not issue an app token until the user email is verified", async () => {
    const app = await loadAuthRouter({
      signUp: ok({
        user: {
          id: "user-2",
          email: "pending@example.com",
          user_metadata: { role: "Customer", name: "Pending User" },
          email_confirmed_at: null,
        },
        session: null,
      }),
      signInWithPassword: ok({
        user: {
          id: "user-2",
          email: "pending@example.com",
          user_metadata: { role: "Customer", name: "Pending User" },
          email_confirmed_at: null,
        },
        session: null,
      }),
    });

    const registerResponse = await request(app)
      .post("/register")
      .send({ email: "pending@example.com", password: "password123", role: "Admin", name: "Pending User" });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.role).toBe("Customer");
    expect(registerResponse.body.token).toBeUndefined();
    expect(registerResponse.body.emailConfirmationRequired).toBe(true);

    const loginResponse = await request(app)
      .post("/login")
      .send({ email: "pending@example.com", password: "password123" });

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.emailConfirmationRequired).toBe(true);
    expect(loginResponse.body.token).toBeUndefined();
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
