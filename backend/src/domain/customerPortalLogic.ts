import type { Role } from "../constants/roles";

export type ValidationResult<T> = { data: T } | { error: string };
export type CaseStatus = "Open" | "In Progress" | "Resolved" | "Dropped";
export type CasePriority = "High" | "Medium" | "Low";
export type MessageType = "text" | "internal_note" | "system";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
};

export type CaseRow = {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  category: string;
  attachments: string[];
  customer_satisfaction_rating: number | null;
  customer_satisfaction_submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  case_id: string;
  sender_id: string | null;
  sender_role: Role;
  message_type: MessageType;
  message_text: string;
  created_at: string;
};

export type PortalTimelineItem = {
  id: string;
  type: "created" | "status" | "system";
  label: string;
  createdAt: string;
};

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

export function parseStringField(
  value: unknown,
  fieldName: string,
  options?: { required?: boolean; allowEmpty?: boolean; maxLength?: number },
): ValidationResult<string | undefined> {
  const required = options?.required ?? true;
  const allowEmpty = options?.allowEmpty ?? false;
  const maxLength = options?.maxLength;

  if (typeof value === "undefined" || value === null) {
    return required ? { error: `${fieldName} is required.` } : { data: undefined };
  }

  if (typeof value !== "string") {
    return { error: `${fieldName} must be a string.` };
  }

  const normalized = value.trim();
  if (!allowEmpty && !normalized) {
    return { error: `${fieldName} cannot be empty.` };
  }

  if (typeof maxLength === "number" && normalized.length > maxLength) {
    return { error: `${fieldName} must be at most ${maxLength} characters.` };
  }

  return { data: normalized };
}

export function parseAttachments(value: unknown): ValidationResult<string[]> {
  if (typeof value === "undefined" || value === null) {
    return { data: [] };
  }

  if (!Array.isArray(value)) {
    return { error: "attachments must be an array of non-empty strings." };
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (normalized.length !== value.length) {
    return { error: "attachments must only contain non-empty string values." };
  }

  if (normalized.length > 10) {
    return { error: "attachments may contain at most 10 items." };
  }

  return { data: normalized };
}

export function parseTicketCreateBody(body: unknown): ValidationResult<{
  subject: string;
  description: string;
  category: string;
  attachments: string[];
}> {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const subject = parseStringField(body.subject, "subject", { maxLength: 200 });
  if ("error" in subject) {
    return subject;
  }

  const description = parseStringField(body.description, "description", { maxLength: 4000 });
  if ("error" in description) {
    return description;
  }

  const category = parseStringField(body.category, "category", { maxLength: 80 });
  if ("error" in category) {
    return category;
  }

  const attachments = parseAttachments(body.attachments);
  if ("error" in attachments) {
    return attachments;
  }

  return {
    data: {
      subject: subject.data as string,
      description: description.data as string,
      category: category.data as string,
      attachments: attachments.data,
    },
  };
}

export function parseCreateMessageBody(body: unknown): ValidationResult<{ messageText: string }> {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const messageText = parseStringField(body.messageText, "messageText", { maxLength: 4000 });
  if ("error" in messageText) {
    return messageText;
  }

  return { data: { messageText: messageText.data as string } };
}

export function parseCustomerSatisfactionBody(body: unknown): ValidationResult<{ rating: number }> {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  if (typeof body.rating !== "number" || !Number.isFinite(body.rating)) {
    return { error: "rating must be a number between 1 and 5." };
  }

  const rating = Math.round(body.rating);
  if (rating < 1 || rating > 5) {
    return { error: "rating must be between 1 and 5." };
  }

  return { data: { rating } };
}

export function normalizeAttachmentList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function mapTicketSummary(caseItem: CaseRow, assignedEmployee?: UserRow | null) {
  return {
    id: caseItem.id,
    subject: caseItem.title,
    status: caseItem.status,
    priority: caseItem.priority,
    category: caseItem.category,
    attachmentCount: caseItem.attachments.length,
    customerSatisfactionRating: caseItem.customer_satisfaction_rating,
    customerSatisfactionSubmittedAt: caseItem.customer_satisfaction_submitted_at,
    canSubmitCustomerSatisfaction:
      caseItem.status === "Resolved" && caseItem.customer_satisfaction_rating === null,
    createdAt: caseItem.created_at,
    updatedAt: caseItem.updated_at,
    assignedEmployee: assignedEmployee
      ? {
          id: assignedEmployee.id,
          name: assignedEmployee.name,
          email: assignedEmployee.email,
          role: assignedEmployee.role,
        }
      : null,
  };
}

export function buildTimeline(caseItem: CaseRow, messages: MessageRow[]): PortalTimelineItem[] {
  const events: PortalTimelineItem[] = [
    {
      id: `created:${caseItem.id}`,
      type: "created",
      label: "Ticket created",
      createdAt: caseItem.created_at,
    },
  ];

  if (caseItem.assigned_to) {
    events.push({
      id: `assigned:${caseItem.id}`,
      type: "status",
      label: "Assigned to a support agent",
      createdAt: caseItem.created_at,
    });
  }

  const systemMessages = messages.filter((message) => message.message_type === "system");
  if (systemMessages.length > 0) {
    events.push(
      ...systemMessages.map((message) => ({
        id: `system:${message.id}`,
        type: "system" as const,
        label: message.message_text,
        createdAt: message.created_at,
      })),
    );
  } else if (caseItem.status !== "Open" || caseItem.updated_at !== caseItem.created_at) {
    events.push({
      id: `status:${caseItem.id}`,
      type: "status",
      label: `Status updated to ${caseItem.status}`,
      createdAt: caseItem.updated_at,
    });
  }

  return events.sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (byTime !== 0) {
      return byTime;
    }

    return a.id.localeCompare(b.id);
  });
}
