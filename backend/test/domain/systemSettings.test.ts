import { describe, expect, it, vi } from "vitest";

type QueryResult<T = unknown> = {
  data: T;
  error: { message: string } | null;
};

function ok<T>(data: T): QueryResult<T> {
  return { data, error: null };
}

function createSupabaseAdminMock(options: {
  select?: QueryResult<Array<{ key: string; value: unknown }>>;
  upsert?: QueryResult<null>;
}) {
  const upsertCalls: unknown[] = [];

  const builder = {
    select() {
      return {
        in() {
          return Promise.resolve(options.select ?? ok([]));
        },
      };
    },
    upsert(payload: unknown) {
      upsertCalls.push(payload);
      return Promise.resolve(options.upsert ?? ok(null));
    },
  };

  return {
    client: {
      from() {
        return builder;
      },
    },
    upsertCalls,
  };
}

describe("systemSettings", () => {
  it("rejects empty and invalid patches", async () => {
    const { parseSystemSettingsPatch } = await import("../../src/services/systemSettings");

    expect(parseSystemSettingsPatch({})).toEqual({
      error:
        "Provide at least one setting to update: availabilityRefreshMinutes, defaultCasePriority, priorityStyleMap.",
    });
    expect(parseSystemSettingsPatch({ availabilityRefreshMinutes: 0 })).toEqual({
      error: "availabilityRefreshMinutes must be between 1 and 240.",
    });
    expect(parseSystemSettingsPatch({ defaultCasePriority: "Urgent" })).toEqual({
      error: "defaultCasePriority must be one of: High, Medium, Low.",
    });
    expect(parseSystemSettingsPatch(null)).toEqual({
      error: "Request body must be a JSON object.",
    });
  });

  it("normalizes valid partial patches", async () => {
    const { parseSystemSettingsPatch } = await import("../../src/services/systemSettings");

    expect(
      parseSystemSettingsPatch({
        availabilityRefreshMinutes: 15.4,
        priorityStyleMap: { High: { label: " Rush ", color: " #f00 ", background: " #fee " } },
      }),
    ).toEqual({
      data: {
        availabilityRefreshMinutes: 15,
        priorityStyleMap: {
          High: { label: "Rush", color: "#f00", background: "#fee" },
          Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
          Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
        },
      },
    });
  });

  it("rejects invalid setting value types", async () => {
    const { parseSystemSettingsPatch } = await import("../../src/services/systemSettings");

    expect(parseSystemSettingsPatch({ availabilityRefreshMinutes: "fast" })).toEqual({
      error: "availabilityRefreshMinutes must be a number.",
    });
    expect(parseSystemSettingsPatch({ priorityStyleMap: "nope" })).toEqual({
      error: "priorityStyleMap must be a JSON object.",
    });
  });

  it("accepts a standalone default case priority patch", async () => {
    const { parseSystemSettingsPatch } = await import("../../src/services/systemSettings");

    expect(parseSystemSettingsPatch({ defaultCasePriority: "High" })).toEqual({
      data: {
        defaultCasePriority: "High",
      },
    });
  });

  it("falls back to default style values for malformed priority style entries", async () => {
    const { parseSystemSettingsPatch, DEFAULT_PRIORITY_STYLE_MAP } = await import(
      "../../src/services/systemSettings"
    );

    expect(
      parseSystemSettingsPatch({
        priorityStyleMap: {
          High: { label: "   ", color: "", background: null },
          Medium: 123,
          Low: null,
        },
      }),
    ).toEqual({
      data: {
        priorityStyleMap: {
          High: DEFAULT_PRIORITY_STYLE_MAP.High,
          Medium: DEFAULT_PRIORITY_STYLE_MAP.Medium,
          Low: DEFAULT_PRIORITY_STYLE_MAP.Low,
        },
      },
    });
  });

  it("falls back to default styles when priority style entries are not records", async () => {
    const { parseSystemSettingsPatch, DEFAULT_PRIORITY_STYLE_MAP } = await import(
      "../../src/services/systemSettings"
    );

    expect(
      parseSystemSettingsPatch({
        priorityStyleMap: {
          High: 42,
          Medium: "bad",
          Low: null,
        },
      }),
    ).toEqual({
      data: {
        priorityStyleMap: DEFAULT_PRIORITY_STYLE_MAP,
      },
    });
  });

  it("reads settings from Supabase when admin access exists", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: 30 },
        { key: "default_case_priority", value: "High" },
        {
          key: "priority_style_map",
          value: {
            High: { label: "Rush", color: "#f00", background: "#fee" },
            Medium: { label: "Medium", color: "#0f0", background: "#efe" },
            Low: { label: "Low", color: "#00f", background: "#eef" },
          },
        },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { getSystemSettings } = await import("../../src/services/systemSettings");
    await expect(getSystemSettings()).resolves.toEqual({
      availabilityRefreshMinutes: 30,
      defaultCasePriority: "High",
      priorityStyleMap: {
        High: { label: "Rush", color: "#f00", background: "#fee" },
        Medium: { label: "Medium", color: "#0f0", background: "#efe" },
        Low: { label: "Low", color: "#00f", background: "#eef" },
      },
    });
  });

  it("falls back to defaults when the system settings query fails", async () => {
    vi.resetModules();
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: {
        from() {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({
                    data: null,
                    error: { message: "query failed" },
                  });
                },
              };
            },
          };
        },
      },
    }));

    const { DEFAULT_SYSTEM_SETTINGS, getSystemSettings } = await import("../../src/services/systemSettings");
    await expect(getSystemSettings()).resolves.toEqual({
      ...DEFAULT_SYSTEM_SETTINGS,
    });
  });

  it("falls back to defaults when the system settings query returns null data", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: {
        data: null,
        error: null,
      },
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { DEFAULT_SYSTEM_SETTINGS, getSystemSettings } = await import("../../src/services/systemSettings");
    await expect(getSystemSettings()).resolves.toEqual(DEFAULT_SYSTEM_SETTINGS);
  });

  it("falls back to defaults for malformed setting rows", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: "bad" },
        { key: "default_case_priority", value: "Urgent" },
        {
          key: "priority_style_map",
          value: {
            High: { label: 42, color: "", background: null },
            Medium: null,
            Low: null,
          },
        },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { DEFAULT_SYSTEM_SETTINGS, getSystemSettings } = await import("../../src/services/systemSettings");
    await expect(getSystemSettings()).resolves.toEqual(DEFAULT_SYSTEM_SETTINGS);
  });

  it("falls back to defaults for out-of-range and non-record rows", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: 999 },
        { key: "default_case_priority", value: "High" },
        { key: "priority_style_map", value: null },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { DEFAULT_SYSTEM_SETTINGS, getSystemSettings } = await import("../../src/services/systemSettings");
    await expect(getSystemSettings()).resolves.toEqual({
      ...DEFAULT_SYSTEM_SETTINGS,
      defaultCasePriority: "High",
    });
  });

  it("falls back to defaults when admin access is unavailable", async () => {
    vi.resetModules();
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: false,
      supabaseAdmin: null,
    }));

    const { DEFAULT_SYSTEM_SETTINGS, getSystemSettings } = await import("../../src/services/systemSettings");
    await expect(getSystemSettings()).resolves.toEqual(DEFAULT_SYSTEM_SETTINGS);
  });

  it("writes only the provided settings when admin access exists", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: 45 },
        { key: "default_case_priority", value: "Low" },
        {
          key: "priority_style_map",
          value: {
            High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
            Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
            Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
          },
        },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { upsertSystemSettings } = await import("../../src/services/systemSettings");
    await expect(upsertSystemSettings({ availabilityRefreshMinutes: 20 })).resolves.toMatchObject({
      availabilityRefreshMinutes: 45,
      defaultCasePriority: "Low",
    });

    expect(supabaseMock.upsertCalls).toHaveLength(1);
    expect(supabaseMock.upsertCalls[0]).toEqual([
      {
        key: "availability_refresh_minutes",
        value: 20,
        description: "How often employee availability indicators should refresh.",
      },
    ]);
  });

  it("writes multiple provided settings when admin access exists", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: 15 },
        { key: "default_case_priority", value: "Medium" },
        {
          key: "priority_style_map",
          value: {
            High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
            Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
            Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
          },
        },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { DEFAULT_PRIORITY_STYLE_MAP, upsertSystemSettings } = await import("../../src/services/systemSettings");
    await expect(
      upsertSystemSettings({
        defaultCasePriority: "High",
        priorityStyleMap: DEFAULT_PRIORITY_STYLE_MAP,
      }),
    ).resolves.toMatchObject({
      availabilityRefreshMinutes: 15,
      defaultCasePriority: "Medium",
    });

    expect(supabaseMock.upsertCalls).toHaveLength(1);
    expect(supabaseMock.upsertCalls[0]).toEqual([
      {
        key: "default_case_priority",
        value: "High",
        description: "Default priority used when creating new customer tickets.",
      },
      {
        key: "priority_style_map",
        value: DEFAULT_PRIORITY_STYLE_MAP,
        description: "Display labels and colors for case priority badges.",
      },
    ]);
  });

  it("updates the default case priority when it is the only field provided", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: 15 },
        { key: "default_case_priority", value: "High" },
        {
          key: "priority_style_map",
          value: {
            High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
            Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
            Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
          },
        },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { upsertSystemSettings } = await import("../../src/services/systemSettings");
    await expect(upsertSystemSettings({ defaultCasePriority: "High" })).resolves.toMatchObject({
      defaultCasePriority: "High",
    });

    expect(supabaseMock.upsertCalls).toHaveLength(1);
    expect(supabaseMock.upsertCalls[0]).toEqual([
      {
        key: "default_case_priority",
        value: "High",
        description: "Default priority used when creating new customer tickets.",
      },
    ]);
  });

  it("returns current settings unchanged when no patch fields are provided", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([
        { key: "availability_refresh_minutes", value: 25 },
        { key: "default_case_priority", value: "Low" },
        {
          key: "priority_style_map",
          value: {
            High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
            Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
            Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
          },
        },
      ]),
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { upsertSystemSettings } = await import("../../src/services/systemSettings");
    await expect(upsertSystemSettings({})).resolves.toMatchObject({
      availabilityRefreshMinutes: 25,
      defaultCasePriority: "Low",
    });
    expect(supabaseMock.upsertCalls).toHaveLength(0);
  });

  it("throws when the system settings upsert fails", async () => {
    vi.resetModules();
    const supabaseMock = createSupabaseAdminMock({
      select: ok([]),
      upsert: {
        data: null,
        error: { message: "upsert failed" },
      },
    });

    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: supabaseMock.client,
    }));

    const { upsertSystemSettings } = await import("../../src/services/systemSettings");
    await expect(upsertSystemSettings({ availabilityRefreshMinutes: 30 })).rejects.toThrow("upsert failed");
  });

  it("rejects updates when admin access is missing", async () => {
    vi.resetModules();
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: false,
      supabaseAdmin: null,
    }));

    const { upsertSystemSettings } = await import("../../src/services/systemSettings");
    await expect(upsertSystemSettings({ availabilityRefreshMinutes: 20 })).rejects.toThrow(
      "SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required in backend/.env for admin settings.",
    );
  });
});
