import { isRole, type Role } from "./roles";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CaseStatus = "Open" | "In Progress" | "Resolved" | "Dropped";
export type CasePriority = "High" | "Medium" | "Low";

export type PortalAssignedEmployee = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

export type PortalTicketSummary = {
  id: string;
  subject: string;
  status: CaseStatus;
  priority: CasePriority;
  category: string;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  assignedEmployee: PortalAssignedEmployee | null;
};

export type PortalTicketDetail = PortalTicketSummary & {
  description: string;
  attachments: string[];
};

export type PortalTimelineItem = {
  id: string;
  type: "created" | "status" | "system";
  label: string;
  createdAt: string;
};

export type PortalMessage = {
  id: string;
  senderId: string | null;
  senderRole: Role;
  senderName: string;
  messageText: string;
  createdAt: string;
  isCustomer: boolean;
};

export type PortalDashboardResponse = {
  customer: {
    id: string;
    company: string;
  };
  tickets: PortalTicketSummary[];
};

export type PortalTicketDetailResponse = {
  ticket: PortalTicketDetail;
  timeline: PortalTimelineItem[];
  messages: PortalMessage[];
};

type RawResponse = {
  status?: unknown;
  message?: unknown;
  data?: unknown;
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

function parseAssignedEmployee(value: unknown): PortalAssignedEmployee | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error("Unexpected assigned employee payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    typeof value.email !== "string" ||
    !isRole(value.role)
  ) {
    throw new Error("Unexpected assigned employee payload format.");
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
  };
}

function parseTicketSummary(value: unknown): PortalTicketSummary {
  if (!isRecord(value)) {
    throw new Error("Unexpected ticket payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.subject !== "string" ||
    !isCaseStatus(value.status) ||
    !isCasePriority(value.priority) ||
    typeof value.category !== "string" ||
    typeof value.attachmentCount !== "number" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Unexpected ticket payload format.");
  }

  return {
    id: value.id,
    subject: value.subject,
    status: value.status,
    priority: value.priority,
    category: value.category,
    attachmentCount: value.attachmentCount,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    assignedEmployee: parseAssignedEmployee(value.assignedEmployee),
  };
}

function parseTicketDetail(value: unknown): PortalTicketDetail {
  if (!isRecord(value)) {
    throw new Error("Unexpected ticket detail payload.");
  }

  const summary = parseTicketSummary(value);
  if (typeof value.description !== "string" || !Array.isArray(value.attachments)) {
    throw new Error("Unexpected ticket detail payload format.");
  }

  const attachments = value.attachments
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return {
    ...summary,
    description: value.description,
    attachments,
  };
}

function parseTimelineItem(value: unknown): PortalTimelineItem {
  if (!isRecord(value)) {
    throw new Error("Unexpected timeline item payload.");
  }

  if (
    typeof value.id !== "string" ||
    (value.type !== "created" && value.type !== "status" && value.type !== "system") ||
    typeof value.label !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Unexpected timeline item format.");
  }

  return {
    id: value.id,
    type: value.type,
    label: value.label,
    createdAt: value.createdAt,
  };
}

function parseMessage(value: unknown): PortalMessage {
  if (!isRecord(value)) {
    throw new Error("Unexpected message payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.senderId !== "string" && value.senderId !== null) ||
    !isRole(value.senderRole) ||
    typeof value.senderName !== "string" ||
    typeof value.messageText !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.isCustomer !== "boolean"
  ) {
    throw new Error("Unexpected message payload format.");
  }

  return {
    id: value.id,
    senderId: value.senderId,
    senderRole: value.senderRole,
    senderName: value.senderName,
    messageText: value.messageText,
    createdAt: value.createdAt,
    isCustomer: value.isCustomer,
  };
}

function parseDashboard(body: unknown): PortalDashboardResponse {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected dashboard response.");
  }

  const data = body.data;
  if (!isRecord(data.customer) || !Array.isArray(data.tickets)) {
    throw new Error("Unexpected dashboard response format.");
  }

  if (typeof data.customer.id !== "string" || typeof data.customer.company !== "string") {
    throw new Error("Unexpected customer payload format.");
  }

  return {
    customer: {
      id: data.customer.id,
      company: data.customer.company,
    },
    tickets: data.tickets.map(parseTicketSummary),
  };
}

function parseCreatedTicket(body: unknown): PortalTicketSummary {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.ticket)) {
    throw new Error("Unexpected create-ticket response.");
  }

  return parseTicketSummary(body.data.ticket);
}

function parseTicketDetailResponse(body: unknown): PortalTicketDetailResponse {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error("Unexpected ticket detail response.");
  }

  const data = body.data;
  if (!Array.isArray(data.timeline) || !Array.isArray(data.messages)) {
    throw new Error("Unexpected ticket detail response format.");
  }

  return {
    ticket: parseTicketDetail(data.ticket),
    timeline: data.timeline.map(parseTimelineItem),
    messages: data.messages.map(parseMessage),
  };
}

function parseCreatedMessage(body: unknown): PortalMessage {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.message)) {
    throw new Error("Unexpected message response.");
  }

  return parseMessage(body.data.message);
}

export async function fetchPortalTickets(accessToken: string): Promise<PortalDashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/portal/tickets`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const rawBody = (await parseJsonResponse(response)) as RawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to load portal tickets."));
  }

  return parseDashboard(rawBody);
}

export async function createPortalTicket(
  accessToken: string,
  payload: {
    subject: string;
    description: string;
    category: string;
    attachments: string[];
  },
): Promise<PortalTicketSummary> {
  const response = await fetch(`${API_BASE_URL}/portal/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const rawBody = (await parseJsonResponse(response)) as RawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to create ticket."));
  }

  return parseCreatedTicket(rawBody);
}

export async function fetchPortalTicketDetail(
  accessToken: string,
  ticketId: string,
): Promise<PortalTicketDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/portal/tickets/${ticketId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const rawBody = (await parseJsonResponse(response)) as RawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to load ticket detail."));
  }

  return parseTicketDetailResponse(rawBody);
}

export async function postPortalTicketMessage(
  accessToken: string,
  ticketId: string,
  messageText: string,
): Promise<PortalMessage> {
  const response = await fetch(`${API_BASE_URL}/portal/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messageText }),
  });

  const rawBody = (await parseJsonResponse(response)) as RawResponse;
  if (!response.ok) {
    throw new Error(extractErrorMessage(rawBody, "Failed to send message."));
  }

  return parseCreatedMessage(rawBody);
}
