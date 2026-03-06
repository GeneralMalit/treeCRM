import type { Role } from "./roles";
import type { CasePriority, CaseStatus } from "./employeeTree";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type CaseManagementRawResponse = {
  status?: unknown;
  message?: unknown;
  data?: unknown;
};

export type CaseManagementCase = {
  id: string;
  customerId: string;
  assignedTo: string | null;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  createdAt: string;
  updatedAt: string;
};

export type CaseTagOption = {
  id: string;
  name: string;
  color: string;
  affectsNodeColor: boolean;
  selected: boolean;
};

export type InternalNote = {
  id: string;
  senderId: string | null;
  senderRole: Role;
  messageText: string;
  createdAt: string;
};

export type CaseManagementDetails = {
  case: CaseManagementCase;
  tags: CaseTagOption[];
  internalNotes: InternalNote[];
};

const CASE_STATUSES = ["Open", "In Progress", "Resolved", "Dropped"] as const;
const CASE_PRIORITIES = ["High", "Medium", "Low"] as const;
const ROLES = ["CSR", "Manager", "Executive", "Admin", "Customer"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCaseStatus(value: unknown): value is CaseStatus {
  return typeof value === "string" && CASE_STATUSES.includes(value as (typeof CASE_STATUSES)[number]);
}

function isCasePriority(value: unknown): value is CasePriority {
  return typeof value === "string" && CASE_PRIORITIES.includes(value as (typeof CASE_PRIORITIES)[number]);
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as (typeof ROLES)[number]);
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

function parseCase(value: unknown): CaseManagementCase {
  if (!isRecord(value)) {
    throw new Error("Unexpected case payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.customerId !== "string" ||
    (typeof value.assignedTo !== "string" && value.assignedTo !== null) ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    !isCaseStatus(value.status) ||
    !isCasePriority(value.priority) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Unexpected case payload format.");
  }

  return {
    id: value.id,
    customerId: value.customerId,
    assignedTo: value.assignedTo,
    title: value.title,
    description: value.description,
    status: value.status,
    priority: value.priority,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseTag(value: unknown): CaseTagOption {
  if (!isRecord(value)) {
    throw new Error("Unexpected tag payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.color !== "string" ||
    typeof value.affectsNodeColor !== "boolean" ||
    typeof value.selected !== "boolean"
  ) {
    throw new Error("Unexpected tag payload format.");
  }

  return {
    id: value.id,
    name: value.name,
    color: value.color,
    affectsNodeColor: value.affectsNodeColor,
    selected: value.selected,
  };
}

function parseInternalNote(value: unknown): InternalNote {
  if (!isRecord(value)) {
    throw new Error("Unexpected internal note payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.senderId !== "string" && value.senderId !== null) ||
    !isRole(value.senderRole) ||
    typeof value.messageText !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Unexpected internal note payload format.");
  }

  return {
    id: value.id,
    senderId: value.senderId,
    senderRole: value.senderRole,
    messageText: value.messageText,
    createdAt: value.createdAt,
  };
}

function parseCaseManagementDetails(body: unknown): CaseManagementDetails {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected case management response.");
  }

  const data = body.data;
  if (!Array.isArray(data.tags) || !Array.isArray(data.internalNotes)) {
    throw new Error("Unexpected case management response format.");
  }

  return {
    case: parseCase(data.case),
    tags: data.tags.map(parseTag),
    internalNotes: data.internalNotes.map(parseInternalNote),
  };
}

function parseCaseUpdate(body: unknown): CaseManagementCase {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected case update response.");
  }

  return parseCase(body.data);
}

function parseTagUpdate(body: unknown): CaseTagOption[] {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.tags)) {
    throw new Error("Unexpected case tag update response.");
  }

  return body.data.tags.map(parseTag);
}

function parseCreatedNote(body: unknown): InternalNote {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected internal note response.");
  }

  return parseInternalNote(body.data);
}

export async function fetchCaseManagementDetails(
  accessToken: string,
  caseId: string,
): Promise<CaseManagementDetails> {
  const response = await fetch(`${API_BASE_URL}/employee/cases/${caseId}/manage`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const rawBody = (await parseJsonResponse(response)) as CaseManagementRawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to load case management details."));
  }

  return parseCaseManagementDetails(rawBody);
}

export async function updateCaseStatusPriority(
  accessToken: string,
  caseId: string,
  payload: { status?: CaseStatus; priority?: CasePriority },
): Promise<CaseManagementCase> {
  const response = await fetch(`${API_BASE_URL}/employee/cases/${caseId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const rawBody = (await parseJsonResponse(response)) as CaseManagementRawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to update case."));
  }

  return parseCaseUpdate(rawBody);
}

export async function updateCaseTags(
  accessToken: string,
  caseId: string,
  tagIds: string[],
): Promise<CaseTagOption[]> {
  const response = await fetch(`${API_BASE_URL}/employee/cases/${caseId}/tags`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ tagIds }),
  });

  const rawBody = (await parseJsonResponse(response)) as CaseManagementRawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to update case tags."));
  }

  return parseTagUpdate(rawBody);
}

export async function addInternalNote(
  accessToken: string,
  caseId: string,
  messageText: string,
): Promise<InternalNote> {
  const response = await fetch(`${API_BASE_URL}/employee/cases/${caseId}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messageText }),
  });

  const rawBody = (await parseJsonResponse(response)) as CaseManagementRawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to add internal note."));
  }

  return parseCreatedNote(rawBody);
}
