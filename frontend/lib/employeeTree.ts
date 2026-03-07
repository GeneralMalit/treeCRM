import { isRole, type Role } from "./roles";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CasePriority = "High" | "Medium" | "Low";
export type CaseStatus = "Open" | "In Progress" | "Resolved" | "Dropped";

export type EmployeeTreeCase = {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  createdAt: string;
  updatedAt: string;
  hasPendingEndorsement: boolean;
  pendingEndorsementCount: number;
};

export type EmployeeTreeCustomer = {
  id: string;
  userId: string;
  company: string;
  contactInfo: Record<string, unknown>;
  createdAt: string;
  cases: EmployeeTreeCase[];
};

export type EmployeeTreeEmployee = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: string;
  customers: EmployeeTreeCustomer[];
};

export type EmployeeTreeScope = {
  viewerId: string;
  viewerRole: Role;
  employeeCount: number;
  customerCount: number;
  caseCount: number;
};

export type EmployeeTreeResponse = {
  scope: EmployeeTreeScope;
  data: EmployeeTreeEmployee[];
};

type RawTreeResponse = {
  status?: unknown;
  scope?: unknown;
  data?: unknown;
  message?: unknown;
};

const CASE_STATUSES = ["Open", "In Progress", "Resolved", "Dropped"] as const;
const CASE_PRIORITIES = ["High", "Medium", "Low"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCaseStatus(value: unknown): value is CaseStatus {
  return typeof value === "string" && CASE_STATUSES.includes(value as (typeof CASE_STATUSES)[number]);
}

function isCasePriority(value: unknown): value is CasePriority {
  return typeof value === "string" && CASE_PRIORITIES.includes(value as (typeof CASE_PRIORITIES)[number]);
}

function parseScope(value: unknown): EmployeeTreeScope {
  if (!isRecord(value)) {
    throw new Error("Unexpected tree scope format.");
  }

  if (
    typeof value.viewerId !== "string" ||
    !isRole(value.viewerRole) ||
    typeof value.employeeCount !== "number" ||
    typeof value.customerCount !== "number" ||
    typeof value.caseCount !== "number"
  ) {
    throw new Error("Unexpected tree scope payload.");
  }

  return {
    viewerId: value.viewerId,
    viewerRole: value.viewerRole,
    employeeCount: value.employeeCount,
    customerCount: value.customerCount,
    caseCount: value.caseCount,
  };
}

function parseCase(value: unknown): EmployeeTreeCase {
  if (!isRecord(value)) {
    throw new Error("Unexpected case payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    !isCaseStatus(value.status) ||
    !isCasePriority(value.priority) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.hasPendingEndorsement !== "boolean" ||
    typeof value.pendingEndorsementCount !== "number"
  ) {
    throw new Error("Unexpected case payload format.");
  }

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    status: value.status,
    priority: value.priority,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    hasPendingEndorsement: value.hasPendingEndorsement,
    pendingEndorsementCount: value.pendingEndorsementCount,
  };
}

function parseCustomer(value: unknown): EmployeeTreeCustomer {
  if (!isRecord(value)) {
    throw new Error("Unexpected customer payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.company !== "string" ||
    !isRecord(value.contactInfo) ||
    typeof value.createdAt !== "string" ||
    !Array.isArray(value.cases)
  ) {
    throw new Error("Unexpected customer payload format.");
  }

  return {
    id: value.id,
    userId: value.userId,
    company: value.company,
    contactInfo: value.contactInfo,
    createdAt: value.createdAt,
    cases: value.cases.map(parseCase),
  };
}

function parseEmployee(value: unknown): EmployeeTreeEmployee {
  if (!isRecord(value)) {
    throw new Error("Unexpected employee payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    typeof value.email !== "string" ||
    !isRole(value.role) ||
    typeof value.createdAt !== "string" ||
    !Array.isArray(value.customers)
  ) {
    throw new Error("Unexpected employee payload format.");
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    createdAt: value.createdAt,
    customers: value.customers.map(parseCustomer),
  };
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

export async function fetchEmployeeTree(accessToken: string): Promise<EmployeeTreeResponse> {
  const response = await fetch(`${API_BASE_URL}/employee/tree`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const rawBody = (await parseJsonResponse(response)) as RawTreeResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to load employee tree."));
  }

  if (!rawBody || rawBody.status !== "ok" || typeof rawBody !== "object") {
    throw new Error("Unexpected employee tree response.");
  }

  if (!Array.isArray(rawBody.data)) {
    throw new Error("Employee tree payload is missing.");
  }

  return {
    scope: parseScope(rawBody.scope),
    data: rawBody.data.map(parseEmployee),
  };
}
