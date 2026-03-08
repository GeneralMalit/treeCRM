import type { Role } from "../constants/roles";

export type ValidationResult<T> = { data: T } | { error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseUuidParam(raw: unknown, fieldName: string): ValidationResult<string> {
  if (typeof raw !== "string" || !isUuid(raw)) {
    return { error: `${fieldName} must be a valid UUID.` };
  }

  return { data: raw };
}

export function parseMessageBody(body: unknown): ValidationResult<{ messageText: string }> {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  if (typeof body.messageText !== "string") {
    return { error: "messageText must be a string." };
  }

  const messageText = body.messageText.trim();
  if (!messageText) {
    return { error: "messageText cannot be empty." };
  }

  if (messageText.length > 4000) {
    return { error: "messageText must be at most 4000 characters." };
  }

  return { data: { messageText } };
}

export function getAllowedInternalPeerRoles(role: Role): Role[] {
  switch (role) {
    case "CSR":
      return ["Manager", "Executive", "Admin"];
    case "Manager":
      return ["CSR", "Executive", "Admin"];
    case "Executive":
      return ["CSR", "Manager", "Admin"];
    case "Admin":
      return ["CSR", "Manager", "Executive", "Admin"];
    case "Customer":
      return [];
    default:
      return [];
  }
}

export function canUsersChatInternally(roleA: Role, roleB: Role): boolean {
  return getAllowedInternalPeerRoles(roleA).includes(roleB) && getAllowedInternalPeerRoles(roleB).includes(roleA);
}
