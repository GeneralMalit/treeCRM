import express from "express";
import { isRole, type Role } from "../constants/roles";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { hasSupabaseAdmin, supabaseAdmin } from "../services/supabaseClient";

type CaseStatus = "Open" | "In Progress" | "Resolved" | "Dropped";
type CasePriority = "High" | "Medium" | "Low";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
};

type CustomerRow = {
  id: string;
  user_id: string;
  company: string;
  contact_info: Record<string, unknown>;
  created_at: string;
};

type CaseRow = {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  created_at: string;
  updated_at: string;
};

type TagRow = {
  id: string;
  name: string;
  color: string;
  affects_node_color: boolean;
};

type CaseTagRow = {
  tag_id: string;
};

type InternalNoteRow = {
  id: string;
  sender_id: string | null;
  sender_role: Role;
  message_text: string;
  created_at: string;
};

const STATUS_VALUES = ["Open", "In Progress", "Resolved", "Dropped"] as const;
const PRIORITY_VALUES = ["High", "Medium", "Low"] as const;

const VISIBLE_EMPLOYEE_ROLES: Record<"CSR" | "Manager" | "Executive" | "Admin", Role[]> = {
  CSR: ["CSR"],
  Manager: ["CSR", "Manager"],
  Executive: ["CSR", "Manager", "Executive"],
  Admin: ["CSR", "Manager", "Executive", "Admin"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isCaseStatus(value: unknown): value is CaseStatus {
  return typeof value === "string" && STATUS_VALUES.includes(value as (typeof STATUS_VALUES)[number]);
}

function isCasePriority(value: unknown): value is CasePriority {
  return typeof value === "string" && PRIORITY_VALUES.includes(value as (typeof PRIORITY_VALUES)[number]);
}

function toUserRows(rows: unknown[]): UserRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.email === "string" &&
        isRole(row.role) &&
        typeof row.created_at === "string" &&
        (typeof row.name === "string" || row.name === null)
      );
    })
    .map((row) => ({
      id: String(row.id),
      email: String(row.email),
      name: row.name === null ? null : String(row.name),
      role: row.role as Role,
      created_at: String(row.created_at),
    }));
}

function toCustomerRows(rows: unknown[]): CustomerRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.user_id === "string" &&
        typeof row.company === "string" &&
        typeof row.created_at === "string" &&
        isRecord(row.contact_info)
      );
    })
    .map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      company: String(row.company),
      contact_info: row.contact_info as Record<string, unknown>,
      created_at: String(row.created_at),
    }));
}

function toCaseRows(rows: unknown[]): CaseRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.customer_id === "string" &&
        (typeof row.assigned_to === "string" || row.assigned_to === null) &&
        typeof row.title === "string" &&
        typeof row.description === "string" &&
        typeof row.created_at === "string" &&
        typeof row.updated_at === "string" &&
        isCaseStatus(row.status) &&
        isCasePriority(row.priority)
      );
    })
    .map((row) => ({
      id: String(row.id),
      customer_id: String(row.customer_id),
      assigned_to: row.assigned_to === null ? null : String(row.assigned_to),
      title: String(row.title),
      description: String(row.description),
      status: row.status as CaseStatus,
      priority: row.priority as CasePriority,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
}

function toTagRows(rows: unknown[]): TagRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.name === "string" &&
        typeof row.color === "string" &&
        typeof row.affects_node_color === "boolean"
      );
    })
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      color: String(row.color),
      affects_node_color: Boolean(row.affects_node_color),
    }));
}

function toCaseTagRows(rows: unknown[]): CaseTagRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => typeof row.tag_id === "string")
    .map((row) => ({
      tag_id: String(row.tag_id),
    }));
}

function toInternalNoteRows(rows: unknown[]): InternalNoteRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        (typeof row.sender_id === "string" || row.sender_id === null) &&
        isRole(row.sender_role) &&
        typeof row.message_text === "string" &&
        typeof row.created_at === "string"
      );
    })
    .map((row) => ({
      id: String(row.id),
      sender_id: row.sender_id === null ? null : String(row.sender_id),
      sender_role: row.sender_role as Role,
      message_text: String(row.message_text),
      created_at: String(row.created_at),
    }));
}

function getRoleSortWeight(role: Role): number {
  switch (role) {
    case "Executive":
      return 1;
    case "Manager":
      return 2;
    case "CSR":
      return 3;
    case "Admin":
      return 4;
    case "Customer":
      return 5;
    default:
      return 99;
  }
}

function getPrioritySortWeight(priority: CasePriority): number {
  switch (priority) {
    case "High":
      return 1;
    case "Medium":
      return 2;
    case "Low":
      return 3;
    default:
      return 99;
  }
}

function ensureSupabase() {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return null;
  }

  return supabaseAdmin;
}

type ValidationResult<T> = { data: T } | { error: string };

function readEnum<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T,
): ValidationResult<T[number]> {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    return { error: `${fieldName} must be one of: ${allowedValues.join(", ")}.` };
  }

  return { data: value as T[number] };
}

function parseCasePatchBody(body: unknown): ValidationResult<{ status?: CaseStatus; priority?: CasePriority }> {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const hasStatus = Object.hasOwn(body, "status");
  const hasPriority = Object.hasOwn(body, "priority");
  if (!hasStatus && !hasPriority) {
    return { error: "Provide at least one of: status, priority." };
  }

  const parsed: { status?: CaseStatus; priority?: CasePriority } = {};

  if (hasStatus) {
    const status = readEnum(body.status, "status", STATUS_VALUES);
    if ("error" in status) {
      return status;
    }
    parsed.status = status.data;
  }

  if (hasPriority) {
    const priority = readEnum(body.priority, "priority", PRIORITY_VALUES);
    if ("error" in priority) {
      return priority;
    }
    parsed.priority = priority.data;
  }

  return { data: parsed };
}

function parseTagUpdateBody(body: unknown): ValidationResult<{ tagIds: string[] }> {
  if (!isRecord(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const tagIds = body.tagIds;
  if (!Array.isArray(tagIds)) {
    return { error: "tagIds must be an array of UUID strings." };
  }

  const deduped = Array.from(new Set(tagIds));
  if (!deduped.every((value) => typeof value === "string" && isUuid(value))) {
    return { error: "All tagIds must be valid UUID strings." };
  }

  return { data: { tagIds: deduped as string[] } };
}

function parseInternalNoteCreateBody(body: unknown): ValidationResult<{ messageText: string }> {
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

  return { data: { messageText } };
}

function parseCaseIdParam(rawValue: string | string[] | undefined): ValidationResult<string> {
  if (typeof rawValue !== "string") {
    return { error: "caseId must be a valid UUID." };
  }

  if (!isUuid(rawValue)) {
    return { error: "caseId must be a valid UUID." };
  }

  return { data: rawValue };
}

async function fetchCase(caseId: string): Promise<ValidationResult<CaseRow | null>> {
  const client = ensureSupabase();
  if (!client) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
    };
  }

  const result = await client
    .from("cases")
    .select("id,customer_id,assigned_to,title,description,status,priority,created_at,updated_at")
    .eq("id", caseId)
    .maybeSingle();

  if (result.error) {
    return { error: result.error.message };
  }

  if (!result.data) {
    return { data: null };
  }

  const parsed = toCaseRows([result.data as unknown])[0];
  if (!parsed) {
    return { error: "Failed to parse case payload." };
  }

  return { data: parsed };
}

function mapCase(caseItem: CaseRow) {
  return {
    id: caseItem.id,
    customerId: caseItem.customer_id,
    assignedTo: caseItem.assigned_to,
    title: caseItem.title,
    description: caseItem.description,
    status: caseItem.status,
    priority: caseItem.priority,
    createdAt: caseItem.created_at,
    updatedAt: caseItem.updated_at,
  };
}

const router = express.Router();

router.get("/employee/tree", requireAuth, requireRole("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const visibleRoles = VISIBLE_EMPLOYEE_ROLES[viewer.role as keyof typeof VISIBLE_EMPLOYEE_ROLES];
  if (!visibleRoles) {
    res.status(403).json({
      status: "error",
      message: `Access denied for role '${viewer.role}'.`,
    });
    return;
  }

  const [usersResult, customersResult, casesResult] = await Promise.all([
    client.from("users").select("id,email,name,role,created_at").in("role", visibleRoles),
    client.from("customers").select("id,user_id,company,contact_info,created_at"),
    client
      .from("cases")
      .select("id,customer_id,assigned_to,title,description,status,priority,created_at,updated_at")
      .not("assigned_to", "is", null),
  ]);

  if (usersResult.error || customersResult.error || casesResult.error) {
    res.status(500).json({
      status: "error",
      message:
        usersResult.error?.message ??
        customersResult.error?.message ??
        casesResult.error?.message ??
        "Failed to load employee tree.",
    });
    return;
  }

  const users = toUserRows((usersResult.data ?? []) as unknown[]);
  const customers = toCustomerRows((customersResult.data ?? []) as unknown[]);
  const cases = toCaseRows((casesResult.data ?? []) as unknown[]);

  const userMap = new Map<string, UserRow>(users.map((user) => [user.id, user]));
  if (viewer.role === "CSR" && !userMap.has(viewer.sub)) {
    userMap.set(viewer.sub, {
      id: viewer.sub,
      email: viewer.email,
      name: viewer.name ?? null,
      role: "CSR",
      created_at: new Date().toISOString(),
    });
  }

  const filteredCases = cases.filter((caseItem) => {
    if (viewer.role === "CSR") {
      return caseItem.assigned_to === viewer.sub;
    }

    return typeof caseItem.assigned_to === "string" && userMap.has(caseItem.assigned_to);
  });

  const customersById = new Map<string, CustomerRow>(customers.map((customer) => [customer.id, customer]));

  const casesByEmployeeId = new Map<string, CaseRow[]>();
  for (const caseItem of filteredCases) {
    if (!caseItem.assigned_to) {
      continue;
    }

    const current = casesByEmployeeId.get(caseItem.assigned_to) ?? [];
    current.push(caseItem);
    casesByEmployeeId.set(caseItem.assigned_to, current);
  }

  const employeeIds =
    viewer.role === "CSR"
      ? [viewer.sub]
      : Array.from(userMap.values()).map((employee) => employee.id);

  const employees = employeeIds
    .map((employeeId) => userMap.get(employeeId))
    .filter((employee): employee is UserRow => Boolean(employee))
    .sort((a, b) => {
      const roleCompare = getRoleSortWeight(a.role) - getRoleSortWeight(b.role);
      if (roleCompare !== 0) {
        return roleCompare;
      }

      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });

  const tree = employees.map((employee) => {
    const employeeCases = (casesByEmployeeId.get(employee.id) ?? []).sort((a, b) => {
      const priorityCompare = getPrioritySortWeight(a.priority) - getPrioritySortWeight(b.priority);
      if (priorityCompare !== 0) {
        return priorityCompare;
      }

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    const customersForEmployee = new Map<
      string,
      {
        id: string;
        userId: string;
        company: string;
        contactInfo: Record<string, unknown>;
        createdAt: string;
        cases: CaseRow[];
      }
    >();

    for (const caseItem of employeeCases) {
      const customer = customersById.get(caseItem.customer_id);
      if (!customer) {
        continue;
      }

      const existing = customersForEmployee.get(customer.id);
      if (existing) {
        existing.cases.push(caseItem);
        continue;
      }

      customersForEmployee.set(customer.id, {
        id: customer.id,
        userId: customer.user_id,
        company: customer.company,
        contactInfo: customer.contact_info,
        createdAt: customer.created_at,
        cases: [caseItem],
      });
    }

    const customersSorted = Array.from(customersForEmployee.values())
      .sort((a, b) => a.company.localeCompare(b.company))
      .map((customer) => ({
        ...customer,
        cases: customer.cases.map((caseItem) => ({
          id: caseItem.id,
          title: caseItem.title,
          description: caseItem.description,
          status: caseItem.status,
          priority: caseItem.priority,
          createdAt: caseItem.created_at,
          updatedAt: caseItem.updated_at,
        })),
      }));

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      createdAt: employee.created_at,
      customers: customersSorted,
    };
  });

  const visibleCustomerIds = new Set<string>();
  for (const employeeNode of tree) {
    for (const customerNode of employeeNode.customers) {
      visibleCustomerIds.add(customerNode.id);
    }
  }

  res.json({
    status: "ok",
    scope: {
      viewerId: viewer.sub,
      viewerRole: viewer.role,
      employeeCount: tree.length,
      customerCount: visibleCustomerIds.size,
      caseCount: filteredCases.length,
    },
    data: tree,
  });
});

router.get("/employee/cases/:caseId/manage", requireAuth, requireRole("CSR"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const caseId = parseCaseIdParam(req.params.caseId);
  if ("error" in caseId) {
    res.status(400).json({
      status: "error",
      message: caseId.error,
    });
    return;
  }

  const caseResult = await fetchCase(caseId.data);
  if ("error" in caseResult) {
    res.status(500).json({
      status: "error",
      message: caseResult.error,
    });
    return;
  }

  if (!caseResult.data) {
    res.status(404).json({
      status: "error",
      message: "Case not found.",
    });
    return;
  }

  if (caseResult.data.assigned_to !== viewer.sub) {
    res.status(403).json({
      status: "error",
      message: "You can only manage cases assigned to your account.",
    });
    return;
  }

  const [tagsResult, caseTagsResult, notesResult] = await Promise.all([
    client.from("tags").select("id,name,color,affects_node_color").order("name", { ascending: true }),
    client.from("case_tags").select("tag_id").eq("case_id", caseId.data),
    client
      .from("messages")
      .select("id,sender_id,sender_role,message_text,created_at")
      .eq("case_id", caseId.data)
      .eq("message_type", "internal_note")
      .order("created_at", { ascending: false }),
  ]);

  if (tagsResult.error || caseTagsResult.error || notesResult.error) {
    res.status(500).json({
      status: "error",
      message:
        tagsResult.error?.message ??
        caseTagsResult.error?.message ??
        notesResult.error?.message ??
        "Failed to load case management details.",
    });
    return;
  }

  const tags = toTagRows((tagsResult.data ?? []) as unknown[]);
  const caseTags = toCaseTagRows((caseTagsResult.data ?? []) as unknown[]);
  const selectedTagIds = new Set(caseTags.map((row) => row.tag_id));
  const internalNotes = toInternalNoteRows((notesResult.data ?? []) as unknown[]);

  res.json({
    status: "ok",
    data: {
      case: mapCase(caseResult.data),
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        affectsNodeColor: tag.affects_node_color,
        selected: selectedTagIds.has(tag.id),
      })),
      internalNotes: internalNotes.map((note) => ({
        id: note.id,
        senderId: note.sender_id,
        senderRole: note.sender_role,
        messageText: note.message_text,
        createdAt: note.created_at,
      })),
    },
  });
});

router.patch("/employee/cases/:caseId", requireAuth, requireRole("CSR"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const caseId = parseCaseIdParam(req.params.caseId);
  if ("error" in caseId) {
    res.status(400).json({
      status: "error",
      message: caseId.error,
    });
    return;
  }

  const parsedBody = parseCasePatchBody(req.body);
  if ("error" in parsedBody) {
    res.status(400).json({
      status: "error",
      message: parsedBody.error,
    });
    return;
  }

  const caseResult = await fetchCase(caseId.data);
  if ("error" in caseResult) {
    res.status(500).json({
      status: "error",
      message: caseResult.error,
    });
    return;
  }

  if (!caseResult.data) {
    res.status(404).json({
      status: "error",
      message: "Case not found.",
    });
    return;
  }

  if (caseResult.data.assigned_to !== viewer.sub) {
    res.status(403).json({
      status: "error",
      message: "You can only update cases assigned to your account.",
    });
    return;
  }

  const { data, error } = await client
    .from("cases")
    .update(parsedBody.data)
    .eq("id", caseId.data)
    .eq("assigned_to", viewer.sub)
    .select("id,customer_id,assigned_to,title,description,status,priority,created_at,updated_at")
    .maybeSingle();

  if (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (!data) {
    res.status(403).json({
      status: "error",
      message: "Case is no longer assigned to your account.",
    });
    return;
  }

  const parsedCase = toCaseRows([data as unknown])[0];
  if (!parsedCase) {
    res.status(500).json({
      status: "error",
      message: "Failed to parse updated case payload.",
    });
    return;
  }

  res.json({
    status: "ok",
    data: mapCase(parsedCase),
  });
});

router.put("/employee/cases/:caseId/tags", requireAuth, requireRole("CSR"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const caseId = parseCaseIdParam(req.params.caseId);
  if ("error" in caseId) {
    res.status(400).json({
      status: "error",
      message: caseId.error,
    });
    return;
  }

  const parsedBody = parseTagUpdateBody(req.body);
  if ("error" in parsedBody) {
    res.status(400).json({
      status: "error",
      message: parsedBody.error,
    });
    return;
  }

  const caseResult = await fetchCase(caseId.data);
  if ("error" in caseResult) {
    res.status(500).json({
      status: "error",
      message: caseResult.error,
    });
    return;
  }

  if (!caseResult.data) {
    res.status(404).json({
      status: "error",
      message: "Case not found.",
    });
    return;
  }

  if (caseResult.data.assigned_to !== viewer.sub) {
    res.status(403).json({
      status: "error",
      message: "You can only update tags for cases assigned to your account.",
    });
    return;
  }

  if (parsedBody.data.tagIds.length > 0) {
    const validTagResult = await client
      .from("tags")
      .select("id,name,color,affects_node_color")
      .in("id", parsedBody.data.tagIds as string[])
      .order("name", { ascending: true });

    if (validTagResult.error) {
      res.status(400).json({
        status: "error",
        message: validTagResult.error.message,
      });
      return;
    }

    const matchedTagIds = new Set((validTagResult.data ?? []).map((tag) => String(tag.id)));
    const missingTagIds = parsedBody.data.tagIds.filter((tagId) => !matchedTagIds.has(tagId));
    if (missingTagIds.length > 0) {
      res.status(400).json({
        status: "error",
        message: `Unknown tag IDs: ${missingTagIds.join(", ")}`,
      });
      return;
    }
  }

  const deleteResult = await client.from("case_tags").delete().eq("case_id", caseId.data);
  if (deleteResult.error) {
    res.status(400).json({
      status: "error",
      message: deleteResult.error.message,
    });
    return;
  }

  if (parsedBody.data.tagIds.length > 0) {
    const insertResult = await client.from("case_tags").insert(
      parsedBody.data.tagIds.map((tagId) => ({
        case_id: caseId.data,
        tag_id: tagId,
      })),
    );

    if (insertResult.error) {
      res.status(400).json({
        status: "error",
        message: insertResult.error.message,
      });
      return;
    }
  }

  const [tagsResult, caseTagsResult] = await Promise.all([
    client.from("tags").select("id,name,color,affects_node_color").order("name", { ascending: true }),
    client.from("case_tags").select("tag_id").eq("case_id", caseId.data),
  ]);

  if (tagsResult.error || caseTagsResult.error) {
    res.status(500).json({
      status: "error",
      message:
        tagsResult.error?.message ??
        caseTagsResult.error?.message ??
        "Failed to load updated tags.",
    });
    return;
  }

  const tags = toTagRows((tagsResult.data ?? []) as unknown[]);
  const caseTags = toCaseTagRows((caseTagsResult.data ?? []) as unknown[]);
  const selectedTagIds = new Set(caseTags.map((row) => row.tag_id));

  res.json({
    status: "ok",
    data: {
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        affectsNodeColor: tag.affects_node_color,
        selected: selectedTagIds.has(tag.id),
      })),
    },
  });
});

router.post("/employee/cases/:caseId/notes", requireAuth, requireRole("CSR"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const caseId = parseCaseIdParam(req.params.caseId);
  if ("error" in caseId) {
    res.status(400).json({
      status: "error",
      message: caseId.error,
    });
    return;
  }

  const parsedBody = parseInternalNoteCreateBody(req.body);
  if ("error" in parsedBody) {
    res.status(400).json({
      status: "error",
      message: parsedBody.error,
    });
    return;
  }

  const caseResult = await fetchCase(caseId.data);
  if ("error" in caseResult) {
    res.status(500).json({
      status: "error",
      message: caseResult.error,
    });
    return;
  }

  if (!caseResult.data) {
    res.status(404).json({
      status: "error",
      message: "Case not found.",
    });
    return;
  }

  if (caseResult.data.assigned_to !== viewer.sub) {
    res.status(403).json({
      status: "error",
      message: "You can only add notes to cases assigned to your account.",
    });
    return;
  }

  const insertResult = await client
    .from("messages")
    .insert({
      case_id: caseId.data,
      sender_id: viewer.sub,
      sender_role: "CSR",
      message_type: "internal_note",
      message_text: parsedBody.data.messageText,
    })
    .select("id,sender_id,sender_role,message_text,created_at")
    .single();

  if (insertResult.error) {
    res.status(400).json({
      status: "error",
      message: insertResult.error.message,
    });
    return;
  }

  const note = toInternalNoteRows([insertResult.data as unknown])[0];
  if (!note) {
    res.status(500).json({
      status: "error",
      message: "Failed to parse created internal note payload.",
    });
    return;
  }

  res.status(201).json({
    status: "ok",
    data: {
      id: note.id,
      senderId: note.sender_id,
      senderRole: note.sender_role,
      messageText: note.message_text,
      createdAt: note.created_at,
    },
  });
});

export const employeeTreeRouter = router;
