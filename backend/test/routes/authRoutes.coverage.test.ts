import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

type AuthRouterOptions = {
  hasSupabaseConfig?: boolean;
  hasJwtSecret?: boolean;
  signUp?: ReturnType<typeof ok>;
  signInWithPassword?: ReturnType<typeof ok>;
};

async function loadAuthRouter(options: AuthRouterOptions = {}) {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      jwtSecret: "test-secret",
    },
    hasJwtSecret: options.hasJwtSecret ?? true,
    hasSupabaseConfig: options.hasSupabaseConfig ?? true,
  }));
  vi.doMock("../../src/services/supabaseClient", () => ({
    supabase: createSupabaseAuthMock({
      signUp:
        options.signUp ??
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
        options.signInWithPassword ??
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

describe("authRoutes coverage", () => {
  it("returns config errors when supabase or jwt are missing", async () => {
    const app = await loadAuthRouter({ hasSupabaseConfig: false });
    await expect(request(app).post("/register").send({ email: "a@example.com", password: "password123" })).resolves.toMatchObject({
      status: 500,
    });

    const jwtMissingApp = await loadAuthRouter({ hasJwtSecret: false });
    await expect(request(jwtMissingApp).post("/login").send({ email: "a@example.com", password: "password123" })).resolves.toMatchObject({
      status: 500,
    });
  });

  it("rejects malformed auth responses and unverified users", async () => {
    const app = await loadAuthRouter({
      signUp: ok({
        user: null,
        session: null,
      }),
      signInWithPassword: ok({
        user: {
          id: "user-1",
          email: "user@example.com",
          user_metadata: { role: "Customer", name: "User" },
          email_confirmed_at: null,
        },
        session: null,
      }),
    });

    const registerResponse = await request(app)
      .post("/register")
      .send({ email: "user@example.com", password: "password123" });
    expect(registerResponse.status).toBe(500);

    const loginResponse = await request(app)
      .post("/login")
      .send({ email: "user@example.com", password: "password123" });
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.emailConfirmationRequired).toBe(true);
  });

  it("registers verified users with a token", async () => {
    const app = await loadAuthRouter();

    const response = await request(app)
      .post("/register")
      .send({ email: "user@example.com", password: "password123", name: "User" });

    expect(response.status).toBe(201);
    expect(response.body.emailConfirmationRequired).toBe(false);
    expect(response.body.token).toBeDefined();
  });

  it("rejects login attempts with invalid credentials", async () => {
    const app = await loadAuthRouter({
      signInWithPassword: ok({
        user: null,
        session: null,
      }),
    });

    const response = await request(app)
      .post("/login")
      .send({ email: "user@example.com", password: "password123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password.");
  });

  it("rejects malformed register and login payloads", async () => {
    const app = await loadAuthRouter();

    const registerResponse = await request(app)
      .post("/register")
      .send({ email: "", password: "long-enough-password" });
    expect(registerResponse.status).toBe(400);
    expect(registerResponse.body.message).toBe("Email is required.");

    const loginResponse = await request(app)
      .post("/login")
      .send({ email: "user@example.com", password: "short" });
    expect(loginResponse.status).toBe(400);
    expect(loginResponse.body.message).toBe("Password is required and must be at least 8 characters.");
  });

  it("rejects provider errors and missing auth user data", async () => {
    const app = await loadAuthRouter({
      signUp: ok({
        user: {
          id: "user-1",
          user_metadata: { role: "Customer" },
        },
        session: null,
      }),
      signInWithPassword: {
        data: null,
        error: { message: "bad auth" },
      } as ReturnType<typeof ok>,
    });

    const registerResponse = await request(app)
      .post("/register")
      .send({ email: "user@example.com", password: "long-enough-password" });
    expect(registerResponse.status).toBe(500);
    expect(registerResponse.body.message).toBe("User registration did not return a valid user object.");

    const loginResponse = await request(app)
      .post("/login")
      .send({ email: "user@example.com", password: "long-enough-password" });
    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.message).toBe("bad auth");
  });

  it("rejects sign-up provider errors", async () => {
    const app = await loadAuthRouter({
      signUp: {
        data: null,
        error: { message: "sign up failed" },
      } as ReturnType<typeof ok>,
    });

    const response = await request(app)
      .post("/register")
      .send({ email: "user@example.com", password: "long-enough-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("sign up failed");
  });

  it("serves the authenticated user and logout response", async () => {
    const app = await loadAuthRouter();
    const token = signTestJwt({
      sub: "user-1",
      email: "user@example.com",
      role: "Customer",
      name: "User",
    });

    const meResponse = await request(app).get("/me").set("Authorization", `Bearer ${token}`);
    const logoutResponse = await request(app).post("/logout").set("Authorization", `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user).toMatchObject({
      sub: "user-1",
      email: "user@example.com",
      role: "Customer",
    });
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toContain("Logout successful");
  });
});
