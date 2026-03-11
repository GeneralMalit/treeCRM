import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";
import { createRouterApp } from "../utils/routerApp";

async function loadSystemRouter(options?: {
  hasSupabaseConfig?: boolean;
  fetchImpl?: typeof fetch;
}) {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
    },
    hasSupabaseConfig: options?.hasSupabaseConfig ?? true,
  }));
  vi.stubGlobal("fetch", options?.fetchImpl ?? vi.fn());

  const { systemRouter } = await import("../../src/routes/systemRoutes");
  return createRouterApp(systemRouter);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("systemRoutes", () => {
  it("serves health and version payloads", async () => {
    const app = await loadSystemRouter();

    const healthResponse = await request(app).get("/health");
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toMatchObject({
      status: "ok",
      service: "treecrm-backend",
    });

    const versionResponse = await request(app).get("/version");
    expect(versionResponse.status).toBe(200);
    expect(versionResponse.body).toMatchObject({
      name: "backend",
      version: packageJson.version,
    });
  });

  it("handles missing supabase config and upstream failures", async () => {
    const missingConfigApp = await loadSystemRouter({ hasSupabaseConfig: false });
    const missingConfigResponse = await request(missingConfigApp).get("/health/supabase");
    expect(missingConfigResponse.status).toBe(500);
    expect(missingConfigResponse.body.message).toContain("SUPABASE_URL and SUPABASE_KEY");

    const unauthorizedApp = await loadSystemRouter({
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    });
    const unauthorizedResponse = await request(unauthorizedApp).get("/health/supabase");
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.body.message).toContain("key is invalid or unauthorized");

    const timeoutApp = await loadSystemRouter({
      fetchImpl: vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    });
    const timeoutResponse = await request(timeoutApp).get("/health/supabase");
    expect(timeoutResponse.status).toBe(500);
    expect(timeoutResponse.body.message).toBe("Supabase health check timed out.");
  });

  it("reports successful supabase reachability", async () => {
    const app = await loadSystemRouter({
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    });
    const response = await request(app).get("/health/supabase");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      httpStatus: 200,
    });
  });
});
