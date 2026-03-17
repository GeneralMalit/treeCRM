import { hasSupabaseAdmin, supabaseAdmin } from "./supabaseClient";

export type CasePriority = "High" | "Medium" | "Low";

export type PriorityStyleValue = {
  label: string;
  color: string;
  background: string;
};

export type PriorityStyleMap = Record<CasePriority, PriorityStyleValue>;

export type SystemSettings = {
  availabilityRefreshMinutes: number;
  defaultCasePriority: CasePriority;
  priorityStyleMap: PriorityStyleMap;
};

export const DEFAULT_PRIORITY_STYLE_MAP: PriorityStyleMap = {
  High: {
    label: "High",
    color: "#B91C1C",
    background: "#FEF2F2",
  },
  Medium: {
    label: "Medium",
    color: "#B45309",
    background: "#FFFBEB",
  },
  Low: {
    label: "Low",
    color: "#1D4ED8",
    background: "#EFF6FF",
  },
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  availabilityRefreshMinutes: 15,
  defaultCasePriority: "Medium",
  priorityStyleMap: DEFAULT_PRIORITY_STYLE_MAP,
};

const SYSTEM_SETTING_KEYS = {
  availabilityRefreshMinutes: "availability_refresh_minutes",
  defaultCasePriority: "default_case_priority",
  priorityStyleMap: "priority_style_map",
} as const;

const SYSTEM_SETTING_DESCRIPTIONS: Record<string, string> = {
  availability_refresh_minutes: "How often employee availability indicators should refresh.",
  default_case_priority: "Default priority used when creating new customer tickets.",
  priority_style_map: "Display labels and colors for case priority badges.",
};

type RawSettingRow = {
  key: string;
  value: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCasePriority(value: unknown): value is CasePriority {
  return value === "High" || value === "Medium" || value === "Low";
}

function normalizeLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized ? normalized : fallback;
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized;
}

function parseAvailabilityRefreshMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SYSTEM_SETTINGS.availabilityRefreshMinutes;
  }

  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 240) {
    return DEFAULT_SYSTEM_SETTINGS.availabilityRefreshMinutes;
  }

  return rounded;
}

function parseDefaultCasePriority(value: unknown): CasePriority {
  if (!isCasePriority(value)) {
    return DEFAULT_SYSTEM_SETTINGS.defaultCasePriority;
  }

  return value;
}

function parsePriorityStyleMap(value: unknown): PriorityStyleMap {
  if (!isRecord(value)) {
    return DEFAULT_PRIORITY_STYLE_MAP;
  }

  return {
    High: isRecord(value.High)
      ? {
          label: normalizeLabel(value.High.label, DEFAULT_PRIORITY_STYLE_MAP.High.label),
          color: normalizeColor(value.High.color, DEFAULT_PRIORITY_STYLE_MAP.High.color),
          background: normalizeColor(value.High.background, DEFAULT_PRIORITY_STYLE_MAP.High.background),
        }
      : DEFAULT_PRIORITY_STYLE_MAP.High,
    Medium: isRecord(value.Medium)
      ? {
          label: normalizeLabel(value.Medium.label, DEFAULT_PRIORITY_STYLE_MAP.Medium.label),
          color: normalizeColor(value.Medium.color, DEFAULT_PRIORITY_STYLE_MAP.Medium.color),
          background: normalizeColor(value.Medium.background, DEFAULT_PRIORITY_STYLE_MAP.Medium.background),
        }
      : DEFAULT_PRIORITY_STYLE_MAP.Medium,
    Low: isRecord(value.Low)
      ? {
          label: normalizeLabel(value.Low.label, DEFAULT_PRIORITY_STYLE_MAP.Low.label),
          color: normalizeColor(value.Low.color, DEFAULT_PRIORITY_STYLE_MAP.Low.color),
          background: normalizeColor(value.Low.background, DEFAULT_PRIORITY_STYLE_MAP.Low.background),
        }
      : DEFAULT_PRIORITY_STYLE_MAP.Low,
  };
}

function toSettingRows(rows: unknown[]): RawSettingRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => typeof row.key === "string" && Object.hasOwn(row, "value"))
    .map((row) => ({
      key: row.key as string,
      value: row.value,
    }));
}

function resolveSettingsFromRows(rows: RawSettingRow[]): SystemSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    availabilityRefreshMinutes: parseAvailabilityRefreshMinutes(
      byKey.get(SYSTEM_SETTING_KEYS.availabilityRefreshMinutes),
    ),
    defaultCasePriority: parseDefaultCasePriority(byKey.get(SYSTEM_SETTING_KEYS.defaultCasePriority)),
    priorityStyleMap: parsePriorityStyleMap(byKey.get(SYSTEM_SETTING_KEYS.priorityStyleMap)),
  };
}

export async function getSystemSettings(): Promise<SystemSettings> {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("key,value")
    .in("key", Object.values(SYSTEM_SETTING_KEYS));

  if (error) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  return resolveSettingsFromRows(toSettingRows((data ?? []) as unknown[]));
}

export async function upsertSystemSettings(input: Partial<SystemSettings>): Promise<SystemSettings> {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    throw new Error("SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required in backend/.env for admin settings.");
  }

  const upserts: Array<{ key: string; value: unknown; description: string }> = [];

  if (typeof input.availabilityRefreshMinutes !== "undefined") {
    upserts.push({
      key: SYSTEM_SETTING_KEYS.availabilityRefreshMinutes,
      value: input.availabilityRefreshMinutes,
      description: SYSTEM_SETTING_DESCRIPTIONS[SYSTEM_SETTING_KEYS.availabilityRefreshMinutes],
    });
  }

  if (typeof input.defaultCasePriority !== "undefined") {
    upserts.push({
      key: SYSTEM_SETTING_KEYS.defaultCasePriority,
      value: input.defaultCasePriority,
      description: SYSTEM_SETTING_DESCRIPTIONS[SYSTEM_SETTING_KEYS.defaultCasePriority],
    });
  }

  if (typeof input.priorityStyleMap !== "undefined") {
    upserts.push({
      key: SYSTEM_SETTING_KEYS.priorityStyleMap,
      value: input.priorityStyleMap,
      description: SYSTEM_SETTING_DESCRIPTIONS[SYSTEM_SETTING_KEYS.priorityStyleMap],
    });
  }

  if (upserts.length === 0) {
    return getSystemSettings();
  }

  const { error } = await supabaseAdmin.from("system_settings").upsert(upserts, {
    onConflict: "key",
  });

  if (error) {
    throw new Error(error.message);
  }

  return getSystemSettings();
}

export function parseSystemSettingsPatch(body: unknown):
  | { data: Partial<SystemSettings> }
  | { error: string } {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const patch: Partial<SystemSettings> = {};

  if (Object.hasOwn(body, "availabilityRefreshMinutes")) {
    if (
      typeof body.availabilityRefreshMinutes !== "number" ||
      !Number.isFinite(body.availabilityRefreshMinutes)
    ) {
      return { error: "availabilityRefreshMinutes must be a number." };
    }

    const value = Math.round(body.availabilityRefreshMinutes);
    if (value < 1 || value > 240) {
      return { error: "availabilityRefreshMinutes must be between 1 and 240." };
    }

    patch.availabilityRefreshMinutes = value;
  }

  if (Object.hasOwn(body, "defaultCasePriority")) {
    if (!isCasePriority(body.defaultCasePriority)) {
      return { error: "defaultCasePriority must be one of: High, Medium, Low." };
    }

    patch.defaultCasePriority = body.defaultCasePriority;
  }

  if (Object.hasOwn(body, "priorityStyleMap")) {
    if (!isRecord(body.priorityStyleMap)) {
      return { error: "priorityStyleMap must be a JSON object." };
    }

    patch.priorityStyleMap = parsePriorityStyleMap(body.priorityStyleMap);
  }

  if (Object.keys(patch).length === 0) {
    return {
      error:
        "Provide at least one setting to update: availabilityRefreshMinutes, defaultCasePriority, priorityStyleMap.",
    };
  }

  return { data: patch };
}

