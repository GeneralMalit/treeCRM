import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("reads explicit environment values", async () => {
    vi.doMock("dotenv", () => ({
      default: { config: vi.fn() },
    }));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PORT", "1234");
    vi.stubEnv("FRONTEND_ORIGIN", "https://example.com");
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("SUPABASE_KEY", "public-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "admin-key");
    vi.stubEnv("JWT_SECRET", "jwt-secret");

    const { env, hasSupabaseConfig, hasSupabaseAdminConfig, hasJwtSecret } = await import(
      "../../src/config/env"
    );

    expect(env).toMatchObject({
      nodeEnv: "production",
      port: 1234,
      frontendOrigin: "https://example.com",
      supabaseUrl: "https://supabase.example.com",
      supabaseKey: "public-key",
      supabaseAdminKey: "admin-key",
      jwtSecret: "jwt-secret",
    });
    expect(hasSupabaseConfig).toBe(true);
    expect(hasSupabaseAdminConfig).toBe(true);
    expect(hasJwtSecret).toBe(true);
  });

  it("falls back to defaults when values are missing", async () => {
    vi.doMock("dotenv", () => ({
      default: { config: vi.fn() },
    }));
    const originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      JWT_SECRET: process.env.JWT_SECRET,
    };

    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.FRONTEND_ORIGIN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.JWT_SECRET;

    const { env, hasSupabaseConfig, hasSupabaseAdminConfig, hasJwtSecret } = await import(
      "../../src/config/env"
    );

    expect(env.nodeEnv).toBe("development");
    expect(env.port).toBe(4000);
    expect(env.frontendOrigin).toBe("http://localhost:3000");
    expect(env.supabaseUrl).toBe("");
    expect(env.supabaseKey).toBe("");
    expect(env.supabaseAdminKey).toBe("");
    expect(env.jwtSecret).toBe("");
    expect(hasSupabaseConfig).toBe(false);
    expect(hasSupabaseAdminConfig).toBe(false);
    expect(hasJwtSecret).toBe(false);

    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.PORT = originalEnv.PORT;
    process.env.FRONTEND_ORIGIN = originalEnv.FRONTEND_ORIGIN;
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    process.env.SUPABASE_KEY = originalEnv.SUPABASE_KEY;
    process.env.SUPABASE_SECRET_KEY = originalEnv.SUPABASE_SECRET_KEY;
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  });
});
