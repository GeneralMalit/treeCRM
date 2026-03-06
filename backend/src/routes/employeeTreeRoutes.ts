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
  assigned_to: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  created_at: string;
  updated_at: string;
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
        typeof row.assigned_to === "string" &&
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
      assigned_to: String(row.assigned_to),
      title: String(row.title),
      description: String(row.description),
      status: row.status as CaseStatus,
      priority: row.priority as CasePriority,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
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

const router = express.Router();

router.get("/employee/tree", requireAuth, requireRole("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
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
    supabaseAdmin.from("users").select("id,email,name,role,created_at").in("role", visibleRoles),
    supabaseAdmin.from("customers").select("id,user_id,company,contact_info,created_at"),
    supabaseAdmin
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

    return userMap.has(caseItem.assigned_to);
  });

  const customersById = new Map<string, CustomerRow>(customers.map((customer) => [customer.id, customer]));

  const casesByEmployeeId = new Map<string, CaseRow[]>();
  for (const caseItem of filteredCases) {
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

export const employeeTreeRouter = router;
