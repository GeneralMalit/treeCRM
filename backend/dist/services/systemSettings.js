"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SYSTEM_SETTINGS = exports.DEFAULT_PRIORITY_STYLE_MAP = void 0;
exports.getSystemSettings = getSystemSettings;
exports.upsertSystemSettings = upsertSystemSettings;
exports.parseSystemSettingsPatch = parseSystemSettingsPatch;
const supabaseClient_1 = require("./supabaseClient");
exports.DEFAULT_PRIORITY_STYLE_MAP = {
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
exports.DEFAULT_SYSTEM_SETTINGS = {
    availabilityRefreshMinutes: 15,
    defaultCasePriority: "Medium",
    priorityStyleMap: exports.DEFAULT_PRIORITY_STYLE_MAP,
};
const SYSTEM_SETTING_KEYS = {
    availabilityRefreshMinutes: "availability_refresh_minutes",
    defaultCasePriority: "default_case_priority",
    priorityStyleMap: "priority_style_map",
};
const SYSTEM_SETTING_DESCRIPTIONS = {
    availability_refresh_minutes: "How often employee availability indicators should refresh.",
    default_case_priority: "Default priority used when creating new customer tickets.",
    priority_style_map: "Display labels and colors for case priority badges.",
};
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCasePriority(value) {
    return value === "High" || value === "Medium" || value === "Low";
}
function normalizeLabel(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim();
    return normalized ? normalized : fallback;
}
function normalizeColor(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = value.trim();
    if (!normalized) {
        return fallback;
    }
    return normalized;
}
function parseAvailabilityRefreshMinutes(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return exports.DEFAULT_SYSTEM_SETTINGS.availabilityRefreshMinutes;
    }
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 240) {
        return exports.DEFAULT_SYSTEM_SETTINGS.availabilityRefreshMinutes;
    }
    return rounded;
}
function parseDefaultCasePriority(value) {
    if (!isCasePriority(value)) {
        return exports.DEFAULT_SYSTEM_SETTINGS.defaultCasePriority;
    }
    return value;
}
function parsePriorityStyleMap(value) {
    if (!isRecord(value)) {
        return exports.DEFAULT_PRIORITY_STYLE_MAP;
    }
    return {
        High: isRecord(value.High)
            ? {
                label: normalizeLabel(value.High.label, exports.DEFAULT_PRIORITY_STYLE_MAP.High.label),
                color: normalizeColor(value.High.color, exports.DEFAULT_PRIORITY_STYLE_MAP.High.color),
                background: normalizeColor(value.High.background, exports.DEFAULT_PRIORITY_STYLE_MAP.High.background),
            }
            : exports.DEFAULT_PRIORITY_STYLE_MAP.High,
        Medium: isRecord(value.Medium)
            ? {
                label: normalizeLabel(value.Medium.label, exports.DEFAULT_PRIORITY_STYLE_MAP.Medium.label),
                color: normalizeColor(value.Medium.color, exports.DEFAULT_PRIORITY_STYLE_MAP.Medium.color),
                background: normalizeColor(value.Medium.background, exports.DEFAULT_PRIORITY_STYLE_MAP.Medium.background),
            }
            : exports.DEFAULT_PRIORITY_STYLE_MAP.Medium,
        Low: isRecord(value.Low)
            ? {
                label: normalizeLabel(value.Low.label, exports.DEFAULT_PRIORITY_STYLE_MAP.Low.label),
                color: normalizeColor(value.Low.color, exports.DEFAULT_PRIORITY_STYLE_MAP.Low.color),
                background: normalizeColor(value.Low.background, exports.DEFAULT_PRIORITY_STYLE_MAP.Low.background),
            }
            : exports.DEFAULT_PRIORITY_STYLE_MAP.Low,
    };
}
function toSettingRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => typeof row.key === "string" && Object.hasOwn(row, "value"))
        .map((row) => ({
        key: row.key,
        value: row.value,
    }));
}
function resolveSettingsFromRows(rows) {
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    return {
        availabilityRefreshMinutes: parseAvailabilityRefreshMinutes(byKey.get(SYSTEM_SETTING_KEYS.availabilityRefreshMinutes)),
        defaultCasePriority: parseDefaultCasePriority(byKey.get(SYSTEM_SETTING_KEYS.defaultCasePriority)),
        priorityStyleMap: parsePriorityStyleMap(byKey.get(SYSTEM_SETTING_KEYS.priorityStyleMap)),
    };
}
async function getSystemSettings() {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return exports.DEFAULT_SYSTEM_SETTINGS;
    }
    const { data, error } = await supabaseClient_1.supabaseAdmin
        .from("system_settings")
        .select("key,value")
        .in("key", Object.values(SYSTEM_SETTING_KEYS));
    if (error) {
        return exports.DEFAULT_SYSTEM_SETTINGS;
    }
    return resolveSettingsFromRows(toSettingRows((data ?? [])));
}
async function upsertSystemSettings(input) {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for admin settings.");
    }
    const upserts = [];
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
    const { error } = await supabaseClient_1.supabaseAdmin.from("system_settings").upsert(upserts, {
        onConflict: "key",
    });
    if (error) {
        throw new Error(error.message);
    }
    return getSystemSettings();
}
function parseSystemSettingsPatch(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    const patch = {};
    if (Object.hasOwn(body, "availabilityRefreshMinutes")) {
        if (typeof body.availabilityRefreshMinutes !== "number" ||
            !Number.isFinite(body.availabilityRefreshMinutes)) {
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
            error: "Provide at least one setting to update: availabilityRefreshMinutes, defaultCasePriority, priorityStyleMap.",
        };
    }
    return { data: patch };
}
