import type { CasePriority, CaseStatus } from "./employeeTree";
import type { Role } from "./roles";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RawApiResponse = {
  status?: unknown;
  message?: unknown;
  data?: unknown;
};

export type EndorsementStatus = "Pending" | "Accepted" | "Rejected" | "Cancelled";
export type EndorsementDecision = "Accepted" | "Rejected";

export type WorkflowUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

export type CaseWorkflowCase = {
  id: string;
  customerId: string;
  assignedTo: string | null;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  createdAt: string;
  updatedAt: string;
  hasPendingEndorsement: boolean;
  pendingEndorsementCount: number;
  assignedToUser: WorkflowUser | null;
};

export type CaseWorkflowEndorsement = {
  id: string;
  caseId: string;
  status: EndorsementStatus;
  createdAt: string;
  endorsedBy: WorkflowUser;
  endorsedTo: WorkflowUser;
  isPendingForViewer: boolean;
};

export type CaseWorkflowDetails = {
  case: CaseWorkflowCase;
  endorsements: CaseWorkflowEndorsement[];
  endorsementTargets: WorkflowUser[];
  reassignmentCandidates: WorkflowUser[];
};

export type ReassignResult = {
  case: CaseWorkflowCase;
  previousAssignee: WorkflowUser | null;
  newAssignee: WorkflowUser;
  cancelledEndorsementCount: number;
};

const CASE_STATUSES = ["Open", "In Progress", "Resolved", "Dropped"] as const;
const CASE_PRIORITIES = ["High", "Medium", "Low"] as const;
const ENDORSEMENT_STATUSES = ["Pending", "Accepted", "Rejected", "Cancelled"] as const;
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

function isEndorsementStatus(value: unknown): value is EndorsementStatus {
  return (
    typeof value === "string" &&
    ENDORSEMENT_STATUSES.includes(value as (typeof ENDORSEMENT_STATUSES)[number])
  );
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

function parseWorkflowUser(value: unknown): WorkflowUser {
  if (!isRecord(value)) {
    throw new Error("Unexpected workflow user payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    typeof value.email !== "string" ||
    !isRole(value.role)
  ) {
    throw new Error("Unexpected workflow user payload format.");
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
  };
}

function parseWorkflowCase(value: unknown): CaseWorkflowCase {
  if (!isRecord(value)) {
    throw new Error("Unexpected workflow case payload.");
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
    typeof value.updatedAt !== "string" ||
    typeof value.hasPendingEndorsement !== "boolean" ||
    typeof value.pendingEndorsementCount !== "number" ||
    (!isRecord(value.assignedToUser) && value.assignedToUser !== null)
  ) {
    throw new Error("Unexpected workflow case payload format.");
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
    hasPendingEndorsement: value.hasPendingEndorsement,
    pendingEndorsementCount: value.pendingEndorsementCount,
    assignedToUser: value.assignedToUser ? parseWorkflowUser(value.assignedToUser) : null,
  };
}

function parseWorkflowEndorsement(value: unknown): CaseWorkflowEndorsement {
  if (!isRecord(value)) {
    throw new Error("Unexpected endorsement payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.caseId !== "string" ||
    !isEndorsementStatus(value.status) ||
    typeof value.createdAt !== "string" ||
    typeof value.isPendingForViewer !== "boolean"
  ) {
    throw new Error("Unexpected endorsement payload format.");
  }

  return {
    id: value.id,
    caseId: value.caseId,
    status: value.status,
    createdAt: value.createdAt,
    endorsedBy: parseWorkflowUser(value.endorsedBy),
    endorsedTo: parseWorkflowUser(value.endorsedTo),
    isPendingForViewer: value.isPendingForViewer,
  };
}

function parseWorkflowDetails(body: unknown): CaseWorkflowDetails {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected workflow details response.");
  }

  const data = body.data;
  if (
    !Array.isArray(data.endorsements) ||
    !Array.isArray(data.endorsementTargets) ||
    !Array.isArray(data.reassignmentCandidates)
  ) {
    throw new Error("Unexpected workflow details payload.");
  }

  return {
    case: parseWorkflowCase(data.case),
    endorsements: data.endorsements.map(parseWorkflowEndorsement),
    endorsementTargets: data.endorsementTargets.map(parseWorkflowUser),
    reassignmentCandidates: data.reassignmentCandidates.map(parseWorkflowUser),
  };
}

function parseCreatedEndorsement(body: unknown): CaseWorkflowEndorsement {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected endorsement create response.");
  }

  return parseWorkflowEndorsement(body.data.endorsement);
}

function parseDecisionEndorsement(body: unknown): CaseWorkflowEndorsement {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected endorsement decision response.");
  }

  return parseWorkflowEndorsement(body.data.endorsement);
}

function parseReassignResult(body: unknown): ReassignResult {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected case reassign response.");
  }

  const data = body.data;
  if (!isRecord(data.newAssignee) || typeof data.cancelledEndorsementCount !== "number") {
    throw new Error("Unexpected case reassign payload.");
  }

  return {
    case: parseWorkflowCase(data.case),
    previousAssignee: data.previousAssignee ? parseWorkflowUser(data.previousAssignee) : null,
    newAssignee: parseWorkflowUser(data.newAssignee),
    cancelledEndorsementCount: data.cancelledEndorsementCount,
  };
}

async function request(
  path: string,
  accessToken: string,
  options?: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
  },
): Promise<RawApiResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(typeof options?.body !== "undefined" ? { "Content-Type": "application/json" } : {}),
    },
    ...(typeof options?.body !== "undefined" ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });

  const rawBody = (await parseJsonResponse(response)) as RawApiResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, `Request failed: ${path}`));
  }

  return rawBody;
}

export async function fetchCaseWorkflowDetails(
  accessToken: string,
  caseId: string,
): Promise<CaseWorkflowDetails> {
  const rawBody = await request(`/employee/cases/${caseId}/workflow`, accessToken);
  return parseWorkflowDetails(rawBody);
}

export async function endorseCaseToEmployee(
  accessToken: string,
  caseId: string,
  endorsedToId: string,
): Promise<CaseWorkflowEndorsement> {
  const rawBody = await request(`/employee/cases/${caseId}/endorsements`, accessToken, {
    method: "POST",
    body: { endorsedToId },
  });

  return parseCreatedEndorsement(rawBody);
}

export async function decideCaseEndorsement(
  accessToken: string,
  endorsementId: string,
  status: EndorsementDecision,
): Promise<CaseWorkflowEndorsement> {
  const rawBody = await request(`/employee/endorsements/${endorsementId}`, accessToken, {
    method: "PATCH",
    body: { status },
  });

  return parseDecisionEndorsement(rawBody);
}

export async function reassignCase(
  accessToken: string,
  caseId: string,
  assigneeId: string,
  reason?: string,
): Promise<ReassignResult> {
  const rawBody = await request(`/employee/cases/${caseId}/reassign`, accessToken, {
    method: "PATCH",
    body: {
      assigneeId,
      ...(reason ? { reason } : {}),
    },
  });

  return parseReassignResult(rawBody);
}
