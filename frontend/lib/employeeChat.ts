import { isRole, type Role } from "./roles";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RawApiResponse = {
  status?: unknown;
  message?: unknown;
  data?: unknown;
};

export type EmployeeCaseChatMessage = {
  id: string;
  caseId: string;
  senderId: string | null;
  senderRole: Role;
  senderName: string;
  messageText: string;
  createdAt: string;
  isCustomer: boolean;
  isSelf: boolean;
};

export type InternalChatContact = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: string;
};

export type InternalChatPeer = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

export type InternalChatMessage = {
  id: string;
  senderId: string;
  senderRole: Role;
  senderName: string;
  recipientId: string;
  recipientRole: Role;
  recipientName: string;
  messageText: string;
  createdAt: string;
  isSelf: boolean;
};

export type InternalChatThread = {
  peer: InternalChatPeer;
  messages: InternalChatMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parseCaseChatMessage(value: unknown): EmployeeCaseChatMessage {
  if (!isRecord(value)) {
    throw new Error("Unexpected case message payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.caseId !== "string" ||
    (typeof value.senderId !== "string" && value.senderId !== null) ||
    !isRole(value.senderRole) ||
    typeof value.senderName !== "string" ||
    typeof value.messageText !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.isCustomer !== "boolean" ||
    typeof value.isSelf !== "boolean"
  ) {
    throw new Error("Unexpected case message payload format.");
  }

  return {
    id: value.id,
    caseId: value.caseId,
    senderId: value.senderId,
    senderRole: value.senderRole,
    senderName: value.senderName,
    messageText: value.messageText,
    createdAt: value.createdAt,
    isCustomer: value.isCustomer,
    isSelf: value.isSelf,
  };
}

function parseInternalContact(value: unknown): InternalChatContact {
  if (!isRecord(value)) {
    throw new Error("Unexpected internal chat contact payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    typeof value.email !== "string" ||
    !isRole(value.role) ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Unexpected internal chat contact format.");
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    createdAt: value.createdAt,
  };
}

function parseInternalPeer(value: unknown): InternalChatPeer {
  if (!isRecord(value)) {
    throw new Error("Unexpected internal chat peer payload.");
  }

  if (
    typeof value.id !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    typeof value.email !== "string" ||
    !isRole(value.role)
  ) {
    throw new Error("Unexpected internal chat peer format.");
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
  };
}

function parseInternalMessage(value: unknown): InternalChatMessage {
  if (!isRecord(value)) {
    throw new Error("Unexpected internal message payload.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.senderId !== "string" ||
    !isRole(value.senderRole) ||
    typeof value.senderName !== "string" ||
    typeof value.recipientId !== "string" ||
    !isRole(value.recipientRole) ||
    typeof value.recipientName !== "string" ||
    typeof value.messageText !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.isSelf !== "boolean"
  ) {
    throw new Error("Unexpected internal message payload format.");
  }

  return {
    id: value.id,
    senderId: value.senderId,
    senderRole: value.senderRole,
    senderName: value.senderName,
    recipientId: value.recipientId,
    recipientRole: value.recipientRole,
    recipientName: value.recipientName,
    messageText: value.messageText,
    createdAt: value.createdAt,
    isSelf: value.isSelf,
  };
}

function parseCaseMessagesResponse(body: unknown): EmployeeCaseChatMessage[] {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.messages)) {
    throw new Error("Unexpected case chat response.");
  }

  return body.data.messages.map(parseCaseChatMessage);
}

function parseCreatedCaseMessage(body: unknown): EmployeeCaseChatMessage {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.message)) {
    throw new Error("Unexpected case message create response.");
  }

  return parseCaseChatMessage(body.data.message);
}

function parseInternalContactsResponse(body: unknown): InternalChatContact[] {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.contacts)) {
    throw new Error("Unexpected internal contacts response.");
  }

  return body.data.contacts.map(parseInternalContact);
}

function parseInternalThreadResponse(body: unknown): InternalChatThread {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.messages)) {
    throw new Error("Unexpected internal thread response.");
  }

  return {
    peer: parseInternalPeer(body.data.peer),
    messages: body.data.messages.map(parseInternalMessage),
  };
}

function parseCreatedInternalMessage(body: unknown): InternalChatMessage {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.message)) {
    throw new Error("Unexpected internal message create response.");
  }

  return parseInternalMessage(body.data.message);
}

async function request(
  path: string,
  accessToken: string,
  options?: {
    method?: "GET" | "POST";
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

export async function fetchEmployeeCaseMessages(
  accessToken: string,
  caseId: string,
): Promise<EmployeeCaseChatMessage[]> {
  const rawBody = await request(`/employee/cases/${caseId}/messages`, accessToken);
  return parseCaseMessagesResponse(rawBody);
}

export async function postEmployeeCaseMessage(
  accessToken: string,
  caseId: string,
  messageText: string,
): Promise<EmployeeCaseChatMessage> {
  const rawBody = await request(`/employee/cases/${caseId}/messages`, accessToken, {
    method: "POST",
    body: { messageText },
  });

  return parseCreatedCaseMessage(rawBody);
}

export async function fetchInternalChatContacts(accessToken: string): Promise<InternalChatContact[]> {
  const rawBody = await request("/employee/internal-chat/contacts", accessToken);
  return parseInternalContactsResponse(rawBody);
}

export async function fetchInternalChatMessages(
  accessToken: string,
  peerUserId: string,
): Promise<InternalChatThread> {
  const rawBody = await request(`/employee/internal-chat/${peerUserId}/messages`, accessToken);
  return parseInternalThreadResponse(rawBody);
}

export async function postInternalChatMessage(
  accessToken: string,
  peerUserId: string,
  messageText: string,
): Promise<InternalChatMessage> {
  const rawBody = await request(`/employee/internal-chat/${peerUserId}/messages`, accessToken, {
    method: "POST",
    body: { messageText },
  });

  return parseCreatedInternalMessage(rawBody);
}
