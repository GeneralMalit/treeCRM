import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("supabaseClient", () => {
  it("exports null clients when config is missing", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(),
    }));
    vi.doMock("../../src/config/env", () => ({
      env: {
        supabaseUrl: "",
        supabaseKey: "",
        supabaseAdminKey: "",
      },
      hasSupabaseConfig: false,
      hasSupabaseAdminConfig: false,
    }));

    const { hasSupabaseAdmin, supabase, supabaseAdmin } = await import(
      "../../src/services/supabaseClient"
    );

    expect(supabase).toBeNull();
    expect(supabaseAdmin).toBeNull();
    expect(hasSupabaseAdmin).toBe(false);
  });

  it("creates both clients when config is present", async () => {
    const createClient = vi.fn().mockReturnValue({ client: true });
    vi.doMock("@supabase/supabase-js", () => ({
      createClient,
    }));
    vi.doMock("../../src/config/env", () => ({
      env: {
        supabaseUrl: "https://supabase.example.com",
        supabaseKey: "public-key",
        supabaseAdminKey: "admin-key",
      },
      hasSupabaseConfig: true,
      hasSupabaseAdminConfig: true,
    }));

    const { hasSupabaseAdmin, supabase, supabaseAdmin } = await import(
      "../../src/services/supabaseClient"
    );

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(supabase).toEqual({ client: true });
    expect(supabaseAdmin).toEqual({ client: true });
    expect(hasSupabaseAdmin).toBe(true);
  });
});
