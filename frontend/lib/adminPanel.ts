import { isRole, type Role } from "./roles";
import type { CasePriority } from "./customerPortal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
};

export type AdminTag = {
  id: string;
  name: string;
  color: string;
  affectsNodeColor: boolean;
};

export type PriorityStyleValue = {
  label: string;
  color: string;
  background: string;
};

export type AdminSettings = {
  availabilityRefreshMinutes: number;
  defaultCasePriority: CasePriority;
  priorityStyleMap: Record<CasePriority, PriorityStyleValue>;
};

type RawResponse = {
  status?: unknown;
  message?: unknown;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCasePriority(value: unknown): value is CasePriority {
  return value === "High" || value === "Medium" || value === "Low";
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && typeof body.message === "string") {
    return body.message;
  }

  return fallback;
}

async function requestWithAuth(
  accessToken: string,
  path: string,
  options?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<RawResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(typeof options?.body !== "undefined" ? { "Content-Type": "application/json" } : {}),
    },
    ...(typeof options?.body !== "undefined" ? { body: JSON.stringify(options.body) } : {}),
  });

  const rawBody = (await parseJsonResponse(response)) as RawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, `Request failed: ${options?.method ?? "GET"} ${path}`));
  }

  return rawBody;
}

function parseAdminUser(value: unknown): AdminUser {
  if (!isRecord(value)) {
    throw new Error("Unexpected admin user payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    !isRole(value.role) ||
    typeof value.created_at !== "string"
  ) {
    throw new Error("Unexpected admin user payload format.");
  }

  return {
    id: value.id,
    email: value.email,
    name: value.name,
    role: value.role,
    createdAt: value.created_at,
  };
}

function parseAdminTag(value: unknown): AdminTag {
  if (!isRecord(value)) {
    throw new Error("Unexpected tag payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.color !== "string" ||
    typeof value.affects_node_color !== "boolean"
  ) {
    throw new Error("Unexpected tag payload format.");
  }

  return {
    id: value.id,
    name: value.name,
    color: value.color,
    affectsNodeColor: value.affects_node_color,
  };
}

function parsePriorityStyleValue(value: unknown, fallback: PriorityStyleValue): PriorityStyleValue {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : fallback.label,
    color: typeof value.color === "string" && value.color.trim() ? value.color.trim() : fallback.color,
    background:
      typeof value.background === "string" && value.background.trim()
        ? value.background.trim()
        : fallback.background,
  };
}

function parseAdminSettings(value: unknown): AdminSettings {
  const defaultPriorityStyleMap: Record<CasePriority, PriorityStyleValue> = {
    High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
    Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
    Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
  };

  if (!isRecord(value)) {
    throw new Error("Unexpected settings payload.");
  }

  if (
    typeof value.availabilityRefreshMinutes !== "number" ||
    !isCasePriority(value.defaultCasePriority) ||
    !isRecord(value.priorityStyleMap)
  ) {
    throw new Error("Unexpected settings payload format.");
  }

  return {
    availabilityRefreshMinutes: Math.round(value.availabilityRefreshMinutes),
    defaultCasePriority: value.defaultCasePriority,
    priorityStyleMap: {
      High: parsePriorityStyleValue(value.priorityStyleMap.High, defaultPriorityStyleMap.High),
      Medium: parsePriorityStyleValue(value.priorityStyleMap.Medium, defaultPriorityStyleMap.Medium),
      Low: parsePriorityStyleValue(value.priorityStyleMap.Low, defaultPriorityStyleMap.Low),
    },
  };
}

function extractDataArray(rawBody: RawResponse, label: string): unknown[] {
  if (!isRecord(rawBody) || !Array.isArray(rawBody.data)) {
    throw new Error(`Unexpected ${label} response.`);
  }

  return rawBody.data;
}

export async function fetchAdminUsers(accessToken: string): Promise<AdminUser[]> {
  const rawBody = await requestWithAuth(accessToken, "/data/users");
  return extractDataArray(rawBody, "users").map(parseAdminUser);
}

export async function createAdminUser(
  accessToken: string,
  payload: { email: string; password: string; role: Role; name?: string },
): Promise<void> {
  await requestWithAuth(accessToken, "/data/users", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminUser(
  accessToken: string,
  userId: string,
  payload: { email?: string; name?: string | null; role?: Role },
): Promise<void> {
  await requestWithAuth(accessToken, `/data/users/${userId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteAdminUser(accessToken: string, userId: string): Promise<void> {
  await requestWithAuth(accessToken, `/data/users/${userId}`, {
    method: "DELETE",
  });
}

export async function fetchAdminTags(accessToken: string): Promise<AdminTag[]> {
  const rawBody = await requestWithAuth(accessToken, "/data/tags");
  return extractDataArray(rawBody, "tags").map(parseAdminTag);
}

export async function createAdminTag(
  accessToken: string,
  payload: { name: string; color: string; affectsNodeColor: boolean },
): Promise<void> {
  await requestWithAuth(accessToken, "/data/tags", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminTag(
  accessToken: string,
  tagId: string,
  payload: { name?: string; color?: string; affectsNodeColor?: boolean },
): Promise<void> {
  await requestWithAuth(accessToken, `/data/tags/${tagId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteAdminTag(accessToken: string, tagId: string): Promise<void> {
  await requestWithAuth(accessToken, `/data/tags/${tagId}`, {
    method: "DELETE",
  });
}

export async function fetchAdminSettings(accessToken: string): Promise<AdminSettings> {
  const rawBody = await requestWithAuth(accessToken, "/admin/settings");
  if (!isRecord(rawBody) || !isRecord(rawBody.data)) {
    throw new Error("Unexpected admin settings response.");
  }

  return parseAdminSettings(rawBody.data.settings);
}

export async function updateAdminSettings(
  accessToken: string,
  payload: Partial<AdminSettings>,
): Promise<AdminSettings> {
  const rawBody = await requestWithAuth(accessToken, "/admin/settings", {
    method: "PATCH",
    body: payload,
  });

  if (!isRecord(rawBody) || !isRecord(rawBody.data)) {
    throw new Error("Unexpected admin settings update response.");
  }

  return parseAdminSettings(rawBody.data.settings);
}
