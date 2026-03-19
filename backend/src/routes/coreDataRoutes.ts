import express, { type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { hasSupabaseAdmin, supabaseAdmin } from "../services/supabaseClient";

type ResourceConfig = {
  path: string;
  table: string;
  orderColumn: string;
  parseCreate: (body: Record<string, unknown>) => ValidationResult<Record<string, unknown>>;
  parseUpdate: (body: Record<string, unknown>) => ValidationResult<Record<string, unknown>>;
};

type ValidationResult<T> = { data: T } | { error: string };

const CASE_STATUSES = ["Open", "In Progress", "Resolved", "Dropped"] as const;
const CASE_PRIORITIES = ["Low", "Medium", "High"] as const;
const MESSAGE_TYPES = ["text", "internal_note", "system"] as const;
const ENDORSEMENT_STATUSES = ["Pending", "Accepted", "Rejected", "Cancelled"] as const;
const ROLES = ["CSR", "Manager", "Executive", "Admin", "Customer"] as const;
type Role = (typeof ROLES)[number];

const router = express.Router();

router.use(requireAuth, requireRole("Admin"));

function ensureSupabase(res: Response) {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required in backend/.env for admin data operations.",
    });
    return null;
  }

  return supabaseAdmin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readUuid(value: unknown, fieldName: string): ValidationResult<string>;
function readUuid(value: unknown, fieldName: string, required: false): ValidationResult<string | undefined>;
function readUuid(value: unknown, fieldName: string, required = true): ValidationResult<string | undefined> {
  if (typeof value === "undefined" || value === null) {
    return required ? { error: `${fieldName} is required.` } : { data: undefined };
  }

  if (typeof value !== "string" || !isUuid(value.trim())) {
    return { error: `${fieldName} must be a valid UUID.` };
  }

  return { data: value.trim() };
}

function readString(
  value: unknown,
  fieldName: string,
  options?: { required?: true; allowEmpty?: boolean },
): ValidationResult<string>;
function readString(
  value: unknown,
  fieldName: string,
  options: { required: false; allowEmpty?: boolean },
): ValidationResult<string | undefined>;
function readString(
  value: unknown,
  fieldName: string,
  options?: { required?: boolean; allowEmpty?: boolean },
): ValidationResult<string | undefined> {
  const required = options?.required ?? true;
  const allowEmpty = options?.allowEmpty ?? false;

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

  return { data: allowEmpty ? value : normalized };
}

function readBoolean(value: unknown, fieldName: string): ValidationResult<boolean>;
function readBoolean(
  value: unknown,
  fieldName: string,
  required: false,
): ValidationResult<boolean | undefined>;
function readBoolean(
  value: unknown,
  fieldName: string,
  required = true,
): ValidationResult<boolean | undefined> {
  if (typeof value === "undefined" || value === null) {
    return required ? { error: `${fieldName} is required.` } : { data: undefined };
  }

  if (typeof value !== "boolean") {
    return { error: `${fieldName} must be a boolean.` };
  }

  return { data: value };
}

function readObject(value: unknown, fieldName: string): ValidationResult<Record<string, unknown>>;
function readObject(
  value: unknown,
  fieldName: string,
  required: false,
): ValidationResult<Record<string, unknown> | undefined>;
function readObject(
  value: unknown,
  fieldName: string,
  required = true,
): ValidationResult<Record<string, unknown> | undefined> {
  if (typeof value === "undefined" || value === null) {
    return required ? { error: `${fieldName} is required.` } : { data: undefined };
  }

  if (!isRecord(value)) {
    return { error: `${fieldName} must be a JSON object.` };
  }

  return { data: value };
}

function readEnum<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T,
): ValidationResult<T[number]>;
function readEnum<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T,
  required: false,
): ValidationResult<T[number] | undefined>;
function readEnum<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T,
  required = true,
): ValidationResult<T[number] | undefined> {
  if (typeof value === "undefined" || value === null) {
    return required ? { error: `${fieldName} is required.` } : { data: undefined };
  }

  if (typeof value !== "string" || !allowedValues.includes(value)) {
    return { error: `${fieldName} must be one of: ${allowedValues.join(", ")}.` };
  }

  return { data: value as T[number] };
}

function requireBody(req: Request): ValidationResult<Record<string, unknown>> {
  if (!isRecord(req.body)) {
    return { error: "Request body must be a JSON object." };
  }

  return { data: req.body };
}

function ensureFieldsPresent(
  payload: Record<string, unknown>,
  fieldNames: string[],
): ValidationResult<Record<string, unknown>> {
  if (!fieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))) {
    return { error: `Provide at least one of: ${fieldNames.join(", ")}.` };
  }

  return { data: payload };
}

function parseUserCreate(body: Record<string, unknown>) {
  const email = readString(body.email, "email");
  if ("error" in email) return email;

  const password = readString(body.password, "password");
  if ("error" in password) return password;

  if ((password.data?.length ?? 0) < 8) {
    return { error: "password must be at least 8 characters." };
  }

  const role = readEnum(body.role, "role", ROLES);
  if ("error" in role) return role;

  const name = readString(body.name, "name", { required: false });
  if ("error" in name) return name;

  const managerId =
    body.managerId === null ? ({ data: null } as ValidationResult<string | null>) : readUuid(body.managerId, "managerId", false);
  if ("error" in managerId) return managerId;

  return {
    data: {
      email: email.data,
      password: password.data,
      role: role.data,
      name: name.data ?? null,
      managerId: managerId.data ?? null,
    },
  };
}

function parseUserUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["email", "name", "role", "managerId"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "email")) {
    const email = readString(body.email, "email");
    if ("error" in email) return email;
    data.email = email.data;
  }

  if (Object.hasOwn(body, "name")) {
    if (body.name === null) {
      data.name = null;
    } else {
      const name = readString(body.name, "name", { required: false });
      if ("error" in name) return name;
      data.name = name.data ?? null;
    }
  }

  if (Object.hasOwn(body, "role")) {
    const role = readEnum(body.role, "role", ROLES);
    if ("error" in role) return role;
    data.role = role.data;
  }

  if (Object.hasOwn(body, "managerId")) {
    if (body.managerId === null) {
      data.managerId = null;
    } else {
      const managerId = readUuid(body.managerId, "managerId", false);
      if ("error" in managerId) return managerId;
      data.managerId = managerId.data ?? null;
    }
  }

  return { data };
}

async function validateManagerAssignment(
  client: NonNullable<typeof supabaseAdmin>,
  role: Role,
  managerId: string | null,
): Promise<ValidationResult<{ managerId: string | null }>> {
  if (role !== "CSR") {
    return { data: { managerId: null } };
  }

  if (!managerId) {
    return { error: "managerId is required when role is CSR." };
  }

  const { data: managerUser, error: managerLookupError } = await client
    .from("users")
    .select("id,role")
    .eq("id", managerId)
    .maybeSingle();

  if (managerLookupError) {
    return { error: managerLookupError.message };
  }

  if (!managerUser) {
    return { error: "managerId must reference an existing Manager user." };
  }

  if (managerUser.role !== "Manager") {
    return { error: "managerId must reference a Manager user." };
  }

  return { data: { managerId } };
}

async function persistUserManagerAssignment(
  client: NonNullable<typeof supabaseAdmin>,
  userId: string,
  managerId: string | null,
): Promise<ValidationResult<{ synced: boolean }>> {
  const { data, error } = await client
    .from("users")
    .update({ manager_id: managerId })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  return { data: { synced: Boolean(data) } };
}

async function countAdminUsers(client: NonNullable<typeof supabaseAdmin>): Promise<ValidationResult<number>> {
  const { data, error } = await client.from("users").select("id").eq("role", "Admin");
  if (error) {
    return { error: error.message };
  }

  return { data: Array.isArray(data) ? data.length : 0 };
}

function parseCustomerCreate(body: Record<string, unknown>) {
  const userId = readUuid(body.userId, "userId");
  if ("error" in userId) return userId;

  const company = readString(body.company, "company");
  if ("error" in company) return company;

  const contactInfo = readObject(body.contactInfo, "contactInfo", false);
  if ("error" in contactInfo) return contactInfo;

  return {
    data: {
      user_id: userId.data,
      company: company.data,
      ...(contactInfo.data ? { contact_info: contactInfo.data } : {}),
    },
  };
}

function parseCustomerUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["userId", "company", "contactInfo"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "userId")) {
    const userId = readUuid(body.userId, "userId");
    if ("error" in userId) return userId;
    data.user_id = userId.data;
  }

  if (Object.hasOwn(body, "company")) {
    const company = readString(body.company, "company");
    if ("error" in company) return company;
    data.company = company.data;
  }

  if (Object.hasOwn(body, "contactInfo")) {
    const contactInfo = readObject(body.contactInfo, "contactInfo");
    if ("error" in contactInfo) return contactInfo;
    data.contact_info = contactInfo.data;
  }

  return { data };
}

function parseCaseCreate(body: Record<string, unknown>) {
  const customerId = readUuid(body.customerId, "customerId");
  if ("error" in customerId) return customerId;

  const assignedTo = readUuid(body.assignedTo, "assignedTo", false);
  if ("error" in assignedTo) return assignedTo;

  const title = readString(body.title, "title");
  if ("error" in title) return title;

  const description = readString(body.description, "description", { required: false, allowEmpty: true });
  if ("error" in description) return description;

  const status = readEnum(body.status, "status", CASE_STATUSES, false);
  if ("error" in status) return status;

  const priority = readEnum(body.priority, "priority", CASE_PRIORITIES, false);
  if ("error" in priority) return priority;

  return {
    data: {
      customer_id: customerId.data,
      ...(typeof assignedTo.data !== "undefined" ? { assigned_to: assignedTo.data } : {}),
      title: title.data,
      ...(typeof description.data !== "undefined" ? { description: description.data } : {}),
      ...(typeof status.data !== "undefined" ? { status: status.data } : {}),
      ...(typeof priority.data !== "undefined" ? { priority: priority.data } : {}),
    },
  };
}

function parseCaseUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, [
    "customerId",
    "assignedTo",
    "title",
    "description",
    "status",
    "priority",
  ]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "customerId")) {
    const customerId = readUuid(body.customerId, "customerId");
    if ("error" in customerId) return customerId;
    data.customer_id = customerId.data;
  }

  if (Object.hasOwn(body, "assignedTo")) {
    if (body.assignedTo === null) {
      data.assigned_to = null;
    } else {
      const assignedTo = readUuid(body.assignedTo, "assignedTo");
      if ("error" in assignedTo) return assignedTo;
      data.assigned_to = assignedTo.data;
    }
  }

  if (Object.hasOwn(body, "title")) {
    const title = readString(body.title, "title");
    if ("error" in title) return title;
    data.title = title.data;
  }

  if (Object.hasOwn(body, "description")) {
    const description = readString(body.description, "description", { required: false, allowEmpty: true });
    if ("error" in description) return description;
    data.description = description.data ?? "";
  }

  if (Object.hasOwn(body, "status")) {
    const status = readEnum(body.status, "status", CASE_STATUSES);
    if ("error" in status) return status;
    data.status = status.data;
  }

  if (Object.hasOwn(body, "priority")) {
    const priority = readEnum(body.priority, "priority", CASE_PRIORITIES);
    if ("error" in priority) return priority;
    data.priority = priority.data;
  }

  return { data };
}

function parseTagCreate(body: Record<string, unknown>) {
  const name = readString(body.name, "name");
  if ("error" in name) return name;

  const color = readString(body.color, "color", { required: false });
  if ("error" in color) return color;

  const affectsNodeColor = readBoolean(body.affectsNodeColor, "affectsNodeColor", false);
  if ("error" in affectsNodeColor) return affectsNodeColor;

  return {
    data: {
      name: name.data,
      ...(typeof color.data !== "undefined" ? { color: color.data } : {}),
      ...(typeof affectsNodeColor.data !== "undefined"
        ? { affects_node_color: affectsNodeColor.data }
        : {}),
    },
  };
}

function parseTagUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["name", "color", "affectsNodeColor"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "name")) {
    const name = readString(body.name, "name");
    if ("error" in name) return name;
    data.name = name.data;
  }

  if (Object.hasOwn(body, "color")) {
    const color = readString(body.color, "color");
    if ("error" in color) return color;
    data.color = color.data;
  }

  if (Object.hasOwn(body, "affectsNodeColor")) {
    const affectsNodeColor = readBoolean(body.affectsNodeColor, "affectsNodeColor");
    if ("error" in affectsNodeColor) return affectsNodeColor;
    data.affects_node_color = affectsNodeColor.data;
  }

  return { data };
}

function parseCaseTagCreate(body: Record<string, unknown>) {
  const caseId = readUuid(body.caseId, "caseId");
  if ("error" in caseId) return caseId;

  const tagId = readUuid(body.tagId, "tagId");
  if ("error" in tagId) return tagId;

  return {
    data: {
      case_id: caseId.data,
      tag_id: tagId.data,
    },
  };
}

function parseCaseTagUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["caseId", "tagId"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "caseId")) {
    const caseId = readUuid(body.caseId, "caseId");
    if ("error" in caseId) return caseId;
    data.case_id = caseId.data;
  }

  if (Object.hasOwn(body, "tagId")) {
    const tagId = readUuid(body.tagId, "tagId");
    if ("error" in tagId) return tagId;
    data.tag_id = tagId.data;
  }

  return { data };
}

function parseMessageCreate(body: Record<string, unknown>) {
  const caseId = readUuid(body.caseId, "caseId");
  if ("error" in caseId) return caseId;

  const senderId = readUuid(body.senderId, "senderId", false);
  if ("error" in senderId) return senderId;

  const senderRole = readEnum(body.senderRole, "senderRole", ROLES);
  if ("error" in senderRole) return senderRole;

  const messageType = readEnum(body.messageType, "messageType", MESSAGE_TYPES, false);
  if ("error" in messageType) return messageType;

  const messageText = readString(body.messageText, "messageText", { allowEmpty: true });
  if ("error" in messageText) return messageText;

  return {
    data: {
      case_id: caseId.data,
      ...(typeof senderId.data !== "undefined" ? { sender_id: senderId.data } : {}),
      sender_role: senderRole.data,
      ...(typeof messageType.data !== "undefined" ? { message_type: messageType.data } : {}),
      message_text: messageText.data,
    },
  };
}

function parseMessageUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["caseId", "senderId", "senderRole", "messageType", "messageText"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "caseId")) {
    const caseId = readUuid(body.caseId, "caseId");
    if ("error" in caseId) return caseId;
    data.case_id = caseId.data;
  }

  if (Object.hasOwn(body, "senderId")) {
    if (body.senderId === null) {
      data.sender_id = null;
    } else {
      const senderId = readUuid(body.senderId, "senderId");
      if ("error" in senderId) return senderId;
      data.sender_id = senderId.data;
    }
  }

  if (Object.hasOwn(body, "senderRole")) {
    const senderRole = readEnum(body.senderRole, "senderRole", ROLES);
    if ("error" in senderRole) return senderRole;
    data.sender_role = senderRole.data;
  }

  if (Object.hasOwn(body, "messageType")) {
    const messageType = readEnum(body.messageType, "messageType", MESSAGE_TYPES);
    if ("error" in messageType) return messageType;
    data.message_type = messageType.data;
  }

  if (Object.hasOwn(body, "messageText")) {
    const messageText = readString(body.messageText, "messageText", { allowEmpty: true });
    if ("error" in messageText) return messageText;
    data.message_text = messageText.data;
  }

  return { data };
}

function parseEndorsementCreate(body: Record<string, unknown>) {
  const caseId = readUuid(body.caseId, "caseId");
  if ("error" in caseId) return caseId;

  const endorsedBy = readUuid(body.endorsedBy, "endorsedBy");
  if ("error" in endorsedBy) return endorsedBy;

  const endorsedTo = readUuid(body.endorsedTo, "endorsedTo");
  if ("error" in endorsedTo) return endorsedTo;

  const status = readEnum(body.status, "status", ENDORSEMENT_STATUSES, false);
  if ("error" in status) return status;

  return {
    data: {
      case_id: caseId.data,
      endorsed_by: endorsedBy.data,
      endorsed_to: endorsedTo.data,
      ...(typeof status.data !== "undefined" ? { status: status.data } : {}),
    },
  };
}

function parseEndorsementUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["caseId", "endorsedBy", "endorsedTo", "status"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "caseId")) {
    const caseId = readUuid(body.caseId, "caseId");
    if ("error" in caseId) return caseId;
    data.case_id = caseId.data;
  }

  if (Object.hasOwn(body, "endorsedBy")) {
    const endorsedBy = readUuid(body.endorsedBy, "endorsedBy");
    if ("error" in endorsedBy) return endorsedBy;
    data.endorsed_by = endorsedBy.data;
  }

  if (Object.hasOwn(body, "endorsedTo")) {
    const endorsedTo = readUuid(body.endorsedTo, "endorsedTo");
    if ("error" in endorsedTo) return endorsedTo;
    data.endorsed_to = endorsedTo.data;
  }

  if (Object.hasOwn(body, "status")) {
    const status = readEnum(body.status, "status", ENDORSEMENT_STATUSES);
    if ("error" in status) return status;
    data.status = status.data;
  }

  return { data };
}

function parseNotificationCreate(body: Record<string, unknown>) {
  const userId = readUuid(body.userId, "userId");
  if ("error" in userId) return userId;

  const type = readString(body.type, "type");
  if ("error" in type) return type;

  const message = readString(body.message, "message", { allowEmpty: true });
  if ("error" in message) return message;

  const read = readBoolean(body.read, "read", false);
  if ("error" in read) return read;

  return {
    data: {
      user_id: userId.data,
      type: type.data,
      message: message.data,
      ...(typeof read.data !== "undefined" ? { read: read.data } : {}),
    },
  };
}

function parseNotificationUpdate(body: Record<string, unknown>) {
  const presence = ensureFieldsPresent(body, ["userId", "type", "message", "read"]);
  if ("error" in presence) return presence;

  const data: Record<string, unknown> = {};

  if (Object.hasOwn(body, "userId")) {
    const userId = readUuid(body.userId, "userId");
    if ("error" in userId) return userId;
    data.user_id = userId.data;
  }

  if (Object.hasOwn(body, "type")) {
    const type = readString(body.type, "type");
    if ("error" in type) return type;
    data.type = type.data;
  }

  if (Object.hasOwn(body, "message")) {
    const message = readString(body.message, "message", { allowEmpty: true });
    if ("error" in message) return message;
    data.message = message.data;
  }

  if (Object.hasOwn(body, "read")) {
    const read = readBoolean(body.read, "read");
    if ("error" in read) return read;
    data.read = read.data;
  }

  return { data };
}

const resources: ResourceConfig[] = [
  {
    path: "customers",
    table: "customers",
    orderColumn: "created_at",
    parseCreate: parseCustomerCreate,
    parseUpdate: parseCustomerUpdate,
  },
  {
    path: "cases",
    table: "cases",
    orderColumn: "created_at",
    parseCreate: parseCaseCreate,
    parseUpdate: parseCaseUpdate,
  },
  {
    path: "tags",
    table: "tags",
    orderColumn: "name",
    parseCreate: parseTagCreate,
    parseUpdate: parseTagUpdate,
  },
  {
    path: "case-tags",
    table: "case_tags",
    orderColumn: "created_at",
    parseCreate: parseCaseTagCreate,
    parseUpdate: parseCaseTagUpdate,
  },
  {
    path: "messages",
    table: "messages",
    orderColumn: "created_at",
    parseCreate: parseMessageCreate,
    parseUpdate: parseMessageUpdate,
  },
  {
    path: "endorsements",
    table: "endorsements",
    orderColumn: "created_at",
    parseCreate: parseEndorsementCreate,
    parseUpdate: parseEndorsementUpdate,
  },
  {
    path: "notifications",
    table: "notifications",
    orderColumn: "created_at",
    parseCreate: parseNotificationCreate,
    parseUpdate: parseNotificationUpdate,
  },
];

async function fetchSingleRecord(table: string, id: string) {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    throw new Error("Supabase client unavailable.");
  }

  const { data, error } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
  return { data, error };
}

router.get("/users", async (_req, res) => {
  const client = ensureSupabase(res);
  if (!client) return;

  const { data, error } = await client.from("users").select("*").order("created_at", { ascending: false });
  if (error) {
    res.status(500).json({ status: "error", message: error.message });
    return;
  }

  res.json({ status: "ok", data });
});

router.post("/users", async (req, res) => {
  const client = ensureSupabase(res);
  if (!client) return;

  const body = requireBody(req);
  if ("error" in body) {
    res.status(400).json({ status: "error", message: body.error });
    return;
  }

  const parsed = parseUserCreate(body.data);
  if ("error" in parsed) {
    res.status(400).json({ status: "error", message: parsed.error });
    return;
  }

  const managerValidation = await validateManagerAssignment(client, parsed.data.role, parsed.data.managerId);
  if ("error" in managerValidation) {
    res.status(400).json({ status: "error", message: managerValidation.error });
    return;
  }

  const shouldPersistManagerAssignment = parsed.data.role === "CSR";

  const createResult = await client.auth.admin.createUser({
    email: String(parsed.data.email),
    password: String(parsed.data.password),
    email_confirm: true,
    user_metadata: {
      role: parsed.data.role,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
    },
  });

  if (createResult.error || !createResult.data.user) {
    res.status(400).json({
      status: "error",
      message: createResult.error?.message ?? "Failed to create auth user.",
    });
    return;
  }

  let managerAssignmentSynced = true;
  if (shouldPersistManagerAssignment) {
    const managerPersistence = await persistUserManagerAssignment(
      client,
      createResult.data.user.id,
      managerValidation.data.managerId,
    );
    if ("error" in managerPersistence) {
      res.status(500).json({
        status: "error",
        message: `Auth user created but failed to persist manager assignment: ${managerPersistence.error}`,
      });
      return;
    }
    managerAssignmentSynced = managerPersistence.data.synced;
  }

  const { data, error } = await fetchSingleRecord("users", createResult.data.user.id);
  if (error || !data || !managerAssignmentSynced) {
    res.status(201).json({
      status: "ok",
      message:
        "Auth user created. Public users row may still be syncing from auth metadata and manager assignment updates.",
      data: {
        id: createResult.data.user.id,
        email: createResult.data.user.email,
        role: parsed.data.role,
        name: parsed.data.name,
        manager_id: managerValidation.data.managerId,
      },
    });
    return;
  }

  res.status(201).json({
    status: "ok",
    data,
  });
});

router.get("/users/:id", async (req, res) => {
  const client = ensureSupabase(res);
  if (!client) return;

  const id = req.params.id;
  if (!isUuid(id)) {
    res.status(400).json({ status: "error", message: "id must be a valid UUID." });
    return;
  }

  const { data, error } = await client.from("users").select("*").eq("id", id).maybeSingle();
  if (error) {
    res.status(500).json({ status: "error", message: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ status: "error", message: "Record not found." });
    return;
  }

  res.json({ status: "ok", data });
});

router.patch("/users/:id", async (req, res) => {
  const client = ensureSupabase(res);
  if (!client) return;

  const id = req.params.id;
  if (!isUuid(id)) {
    res.status(400).json({ status: "error", message: "id must be a valid UUID." });
    return;
  }

  const body = requireBody(req);
  if ("error" in body) {
    res.status(400).json({ status: "error", message: body.error });
    return;
  }

  const parsed = parseUserUpdate(body.data);
  if ("error" in parsed) {
    res.status(400).json({ status: "error", message: parsed.error });
    return;
  }

  const { data: existingUser, error: existingUserError } = await client
    .from("users")
    .select("id,email,name,role,manager_id")
    .eq("id", id)
    .maybeSingle();

  if (existingUserError) {
    res.status(500).json({ status: "error", message: existingUserError.message });
    return;
  }

  if (!existingUser) {
    res.status(404).json({ status: "error", message: "Record not found." });
    return;
  }

  const nextEmail =
    typeof parsed.data.email === "string" ? parsed.data.email : String(existingUser.email ?? "");
  const nextRole = (typeof parsed.data.role === "string" ? parsed.data.role : String(existingUser.role ?? "")) as Role;
  const nextName =
    parsed.data.name === null
      ? null
      : typeof parsed.data.name === "string"
        ? parsed.data.name
        : typeof existingUser.name === "string"
          ? existingUser.name
          : null;
  const nextManagerId =
    parsed.data.managerId === null
      ? null
      : typeof parsed.data.managerId === "string"
        ? parsed.data.managerId
        : typeof existingUser.manager_id === "string"
          ? existingUser.manager_id
          : null;

  const managerValidation = await validateManagerAssignment(client, nextRole, nextManagerId);
  if ("error" in managerValidation) {
    res.status(400).json({ status: "error", message: managerValidation.error });
    return;
  }

  const isSelfTarget = req.user?.sub === id;
  const isAdminDemotion = existingUser.role === "Admin" && nextRole !== "Admin";
  if (isSelfTarget && isAdminDemotion) {
    res.status(400).json({
      status: "error",
      message: "Admin users cannot demote their own account.",
    });
    return;
  }

  if (isAdminDemotion) {
    const adminCountResult = await countAdminUsers(client);
    if ("error" in adminCountResult) {
      res.status(500).json({ status: "error", message: adminCountResult.error });
      return;
    }

    if (adminCountResult.data <= 1) {
      res.status(400).json({
        status: "error",
        message: "Cannot demote the last remaining Admin account.",
      });
      return;
    }
  }

  const updateResult = await client.auth.admin.updateUserById(id, {
    email: nextEmail || undefined,
    user_metadata: {
      role: nextRole,
      ...(nextName !== null ? { name: nextName } : { name: null }),
    },
  });

  if (updateResult.error) {
    res.status(400).json({ status: "error", message: updateResult.error.message });
    return;
  }

  const managerPersistence = await persistUserManagerAssignment(client, id, managerValidation.data.managerId);
  if ("error" in managerPersistence) {
    res.status(500).json({
      status: "error",
      message: `Auth user updated but failed to persist manager assignment: ${managerPersistence.error}`,
    });
    return;
  }

  const { data, error } = await fetchSingleRecord("users", id);
  if (error || !data || !managerPersistence.data.synced) {
    res.status(200).json({
      status: "ok",
      message:
        "Auth user updated. Public users row may still be syncing from auth metadata and manager assignment updates.",
      data: {
        id,
        email: nextEmail || existingUser.email,
        role: nextRole || existingUser.role,
        name: nextName,
        manager_id: managerValidation.data.managerId,
      },
    });
    return;
  }

  res.json({ status: "ok", data });
});

router.delete("/users/:id", async (req, res) => {
  const client = ensureSupabase(res);
  if (!client) return;

  const id = req.params.id;
  if (!isUuid(id)) {
    res.status(400).json({ status: "error", message: "id must be a valid UUID." });
    return;
  }

  if (req.user?.sub === id) {
    res.status(400).json({
      status: "error",
      message: "Admin users cannot delete their own account.",
    });
    return;
  }

  const { data: existingUser, error: existingUserError } = await client
    .from("users")
    .select("id,role")
    .eq("id", id)
    .maybeSingle();

  if (existingUserError) {
    res.status(500).json({ status: "error", message: existingUserError.message });
    return;
  }

  if (existingUser?.role === "Admin") {
    const adminCountResult = await countAdminUsers(client);
    if ("error" in adminCountResult) {
      res.status(500).json({ status: "error", message: adminCountResult.error });
      return;
    }

    if (adminCountResult.data <= 1) {
      res.status(400).json({
        status: "error",
        message: "Cannot delete the last remaining Admin account.",
      });
      return;
    }
  }

  const adminDeleteResult = await client.auth.admin.deleteUser(id);
  if (adminDeleteResult.error) {
    res.status(400).json({
      status: "error",
      message: adminDeleteResult.error.message,
    });
    return;
  }

  const { data, error } = await client.from("users").delete().eq("id", id).select("*").maybeSingle();
  if (error) {
    res.status(500).json({ status: "error", message: error.message });
    return;
  }

  res.json({
    status: "ok",
    data: data ?? { id },
    authUserDeleted: true,
    ...(data ? {} : { message: "Auth user deleted. Public users row was already removed by trigger." }),
  });
});

for (const resource of resources) {
  router.get(`/${resource.path}`, async (_req, res) => {
    const client = ensureSupabase(res);
    if (!client) return;

    const { data, error } = await client
      .from(resource.table)
      .select("*")
      .order(resource.orderColumn, { ascending: resource.orderColumn === "name" });

    if (error) {
      res.status(500).json({ status: "error", message: error.message });
      return;
    }

    res.json({ status: "ok", data });
  });

  router.post(`/${resource.path}`, async (req, res) => {
    const client = ensureSupabase(res);
    if (!client) return;

    const body = requireBody(req);
    if ("error" in body) {
      res.status(400).json({ status: "error", message: body.error });
      return;
    }

    const parsed = resource.parseCreate(body.data);
    if ("error" in parsed) {
      res.status(400).json({ status: "error", message: parsed.error });
      return;
    }

    const { data, error } = await client.from(resource.table).insert(parsed.data).select("*").single();
    if (error) {
      res.status(400).json({ status: "error", message: error.message });
      return;
    }

    res.status(201).json({ status: "ok", data });
  });

  router.get(`/${resource.path}/:id`, async (req, res) => {
    const client = ensureSupabase(res);
    if (!client) return;

    const id = req.params.id;
    if (!isUuid(id)) {
      res.status(400).json({ status: "error", message: "id must be a valid UUID." });
      return;
    }

    const { data, error } = await client.from(resource.table).select("*").eq("id", id).maybeSingle();
    if (error) {
      res.status(500).json({ status: "error", message: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ status: "error", message: "Record not found." });
      return;
    }

    res.json({ status: "ok", data });
  });

  router.patch(`/${resource.path}/:id`, async (req, res) => {
    const client = ensureSupabase(res);
    if (!client) return;

    const id = req.params.id;
    if (!isUuid(id)) {
      res.status(400).json({ status: "error", message: "id must be a valid UUID." });
      return;
    }

    const body = requireBody(req);
    if ("error" in body) {
      res.status(400).json({ status: "error", message: body.error });
      return;
    }

    const parsed = resource.parseUpdate(body.data);
    if ("error" in parsed) {
      res.status(400).json({ status: "error", message: parsed.error });
      return;
    }

    const { data, error } = await client
      .from(resource.table)
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      res.status(400).json({ status: "error", message: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ status: "error", message: "Record not found." });
      return;
    }

    res.json({ status: "ok", data });
  });

  router.delete(`/${resource.path}/:id`, async (req, res) => {
    const client = ensureSupabase(res);
    if (!client) return;

    const id = req.params.id;
    if (!isUuid(id)) {
      res.status(400).json({ status: "error", message: "id must be a valid UUID." });
      return;
    }

    const { data, error } = await client.from(resource.table).delete().eq("id", id).select("*").maybeSingle();
    if (error) {
      res.status(400).json({ status: "error", message: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ status: "error", message: "Record not found." });
      return;
    }

    res.json({ status: "ok", data });
  });
}

export const coreDataRouter = router;

