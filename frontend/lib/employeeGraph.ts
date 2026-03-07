import type {
  CasePriority,
  CaseStatus,
  EmployeeTreeCase,
  EmployeeTreeCustomer,
  EmployeeTreeEmployee,
  EmployeeTreeScope,
  PerformanceMetrics,
} from "./employeeTree";
import type { Role } from "./roles";

export const PRIORITY_OUTLINE_COLORS: Record<CasePriority, string> = {
  High: "#DC2626",
  Medium: "#EAB308",
  Low: "#9CA3AF",
};

export const STATUS_FILL_COLORS: Record<CaseStatus, string> = {
  Open: "#DBEAFE",
  "In Progress": "#FEF3C7",
  Resolved: "#DCFCE7",
  Dropped: "#E5E7EB",
};

export const ENDORSEMENT_HALO_COLOR = "#FACC15";

export type HierarchyGraphNode = {
  employee: EmployeeTreeEmployee;
  id: string;
  label: string;
  subtitle: string;
  level: 0 | 1 | 2;
  parentId: string | null;
  customerCount: number;
  caseCount: number;
};

export type HierarchyGraphEdge = {
  id: string;
  fromId: string;
  toId: string;
};

export type HierarchyGraphModel = {
  nodes: HierarchyGraphNode[];
  edges: HierarchyGraphEdge[];
};

export type SkillTreeGraphModel = {
  employee: EmployeeTreeEmployee;
  customers: EmployeeTreeCustomer[];
  activeCustomer: EmployeeTreeCustomer | null;
  casesByPriority: Record<CasePriority, EmployeeTreeCase[]>;
};

export function getEmployeeDisplayName(employee: {
  name: string | null;
  email: string;
}): string {
  return employee.name?.trim() || employee.email;
}

export function getEmployeeGraphAccent(role: Role): string {
  switch (role) {
    case "Executive":
      return "#1D4ED8";
    case "Manager":
      return "#0F766E";
    case "CSR":
      return "#166534";
    case "Admin":
      return "#9A3412";
    default:
      return "#475569";
  }
}

export function truncateGraphLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }

  if (maxLength <= 3) {
    return label.slice(0, maxLength);
  }

  return `${label.slice(0, maxLength - 3)}...`;
}

function getHierarchyLevel(role: Role): 0 | 1 | 2 {
  switch (role) {
    case "Executive":
    case "Admin":
      return 0;
    case "Manager":
      return 1;
    case "CSR":
      return 2;
    default:
      return 2;
  }
}

function getGraphNodeSortLabel(employee: EmployeeTreeEmployee): string {
  return getEmployeeDisplayName(employee).toLowerCase();
}

export function buildHierarchyGraph(
  scope: EmployeeTreeScope,
  employees: EmployeeTreeEmployee[],
): HierarchyGraphModel {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const executives = employees
    .filter((employee) => employee.role === "Executive" || employee.role === "Admin")
    .sort((left, right) => getGraphNodeSortLabel(left).localeCompare(getGraphNodeSortLabel(right)));

  const rootExecutive = executives.find((employee) => employee.id === scope.viewerId) ?? executives[0] ?? null;

  const nodes = employees
    .map<HierarchyGraphNode>((employee) => {
      const level = getHierarchyLevel(employee.role);
      const explicitParent =
        employee.managerId && employeesById.has(employee.managerId) ? employeesById.get(employee.managerId) ?? null : null;

      let parentId: string | null = null;
      if (employee.role === "CSR") {
        parentId = explicitParent?.role === "Manager" ? explicitParent.id : null;
      } else if (employee.role === "Manager") {
        if (explicitParent && (explicitParent.role === "Executive" || explicitParent.role === "Admin")) {
          parentId = explicitParent.id;
        } else if (rootExecutive && rootExecutive.id !== employee.id) {
          parentId = rootExecutive.id;
        }
      }

      const caseCount = employee.customers.reduce((total, customer) => total + customer.cases.length, 0);

      return {
        employee,
        id: employee.id,
        label: getEmployeeDisplayName(employee),
        subtitle: employee.role,
        level,
        parentId,
        customerCount: employee.customers.length,
        caseCount,
      };
    })
    .sort((left, right) => {
      if (left.level !== right.level) {
        return left.level - right.level;
      }

      return left.label.localeCompare(right.label);
    });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = nodes
    .filter((node) => node.parentId && nodeIds.has(node.parentId))
    .map<HierarchyGraphEdge>((node) => ({
      id: `${node.parentId}:${node.id}`,
      fromId: node.parentId as string,
      toId: node.id,
    }));

  return {
    nodes,
    edges,
  };
}

export function buildSkillTreeGraph(
  employee: EmployeeTreeEmployee,
  activeCustomerId: string | null,
): SkillTreeGraphModel {
  const activeCustomer =
    employee.customers.find((customer) => customer.id === activeCustomerId) ?? employee.customers[0] ?? null;

  return {
    employee,
    customers: employee.customers,
    activeCustomer,
    casesByPriority: {
      High: activeCustomer?.cases.filter((caseItem) => caseItem.priority === "High") ?? [],
      Medium: activeCustomer?.cases.filter((caseItem) => caseItem.priority === "Medium") ?? [],
      Low: activeCustomer?.cases.filter((caseItem) => caseItem.priority === "Low") ?? [],
    },
  };
}

/* ---------- Unified Tree Types ---------- */

export type UnifiedNodeKind = "employee" | "customer" | "case";

export type UnifiedTreeNode = {
  id: string;
  kind: UnifiedNodeKind;
  label: string;
  subtitle: string;
  parentId: string | null;
  /** Whether this node can be toggled to show children (has children data). */
  expandable: boolean;
  /** Whether this node is currently expanded (children visible). */
  expanded: boolean;
  /** Role accent color for employees, priority outline for cases, neutral for customers. */
  accentColor: string;
  /** Fill color — white for employees/customers, status fill for cases. */
  fillColor: string;
  /** Optional halo color for pending endorsements. */
  haloColor: string | null;
  /** Data references for detail panel sync. */
  employee: EmployeeTreeEmployee | null;
  customer: EmployeeTreeCustomer | null;
  caseItem: EmployeeTreeCase | null;
  /** Priority ring info for case nodes. */
  priority: CasePriority | null;
  /** Edge style to parent. */
  edgeStyle: "dashed" | "solid";
  /** Metrics summary for employee nodes. */
  metricsSummary: string;
};

export type UnifiedTreeEdge = {
  id: string;
  fromId: string;
  toId: string;
  style: "dashed" | "solid";
};

export type UnifiedTreeModel = {
  nodes: UnifiedTreeNode[];
  edges: UnifiedTreeEdge[];
  rootId: string;
};

function makeEmployeeEdgeStyle(childRole: Role): "dashed" | "solid" {
  if (childRole === "CSR" || childRole === "Manager" || childRole === "Executive" || childRole === "Admin") {
    return "dashed";
  }
  return "solid";
}

function buildMetricsSummary(metrics: PerformanceMetrics): string {
  const parts: string[] = [];
  parts.push(`${metrics.ongoingCases} ongoing`);
  parts.push(`${metrics.resolvedToday} resolved today`);
  return parts.join(" · ");
}

/**
 * Build a unified tree model rooted at the viewer.
 *
 * Only immediate children of the root are shown by default.
 * Deeper branches appear only when their parent is in `expandedNodeIds`.
 */
export function buildUnifiedTree(
  scope: EmployeeTreeScope,
  employees: EmployeeTreeEmployee[],
  expandedNodeIds: ReadonlySet<string>,
): UnifiedTreeModel {
  const nodes: UnifiedTreeNode[] = [];
  const edges: UnifiedTreeEdge[] = [];
  const viewerEmployee = employees.find((e) => e.id === scope.viewerId);

  if (!viewerEmployee) {
    return { nodes: [], edges: [], rootId: scope.viewerId };
  }



  // Determine children relationships based on viewer role.
  // Executive/Admin root → child managers (and unparented CSRs).
  // Manager root → child CSRs.
  // CSR root → child customers → child cases.

  function getEmployeeChildren(parentId: string): EmployeeTreeEmployee[] {
    return employees.filter((e) => e.managerId === parentId && e.id !== parentId);
  }

  function addEmployeeNode(employee: EmployeeTreeEmployee, parentNodeId: string | null, depth: number): void {
    const customerCount = employee.customers.length;
    const caseCount = employee.customers.reduce((t, c) => t + c.cases.length, 0);
    const empChildren = getEmployeeChildren(employee.id);
    const hasChildren = empChildren.length > 0 || customerCount > 0;
    const isRoot = parentNodeId === null;
    const isExpanded = isRoot || expandedNodeIds.has(employee.id);

    nodes.push({
      id: employee.id,
      kind: "employee",
      label: getEmployeeDisplayName(employee),
      subtitle: `${employee.role} · ${caseCount} cases`,
      parentId: parentNodeId,
      expandable: hasChildren,
      expanded: isExpanded,
      accentColor: getEmployeeGraphAccent(employee.role),
      fillColor: "#FFFFFF",
      haloColor: null,
      employee,
      customer: null,
      caseItem: null,
      priority: null,
      edgeStyle: makeEmployeeEdgeStyle(employee.role),
      metricsSummary: buildMetricsSummary(employee.metrics),
    });

    if (parentNodeId !== null) {
      edges.push({
        id: `${parentNodeId}→${employee.id}`,
        fromId: parentNodeId,
        toId: employee.id,
        style: "dashed",
      });
    }

    if (!isExpanded) {
      return;
    }

    // Add child employees (deeper managers/CSRs).
    for (const child of empChildren) {
      addEmployeeNode(child, employee.id, depth + 1);
    }

    // If this employee is a CSR (or has no child employees but has customers), show customers.
    if (employee.role === "CSR" || (empChildren.length === 0 && customerCount > 0)) {
      for (const customer of employee.customers) {
        addCustomerNode(customer, employee, employee.id);
      }
    }
  }

  function addCustomerNode(customer: EmployeeTreeCustomer, parentEmployee: EmployeeTreeEmployee, parentNodeId: string): void {
    const custNodeId = `cust:${customer.id}`;
    const hasCases = customer.cases.length > 0;
    const isExpanded = expandedNodeIds.has(custNodeId);

    nodes.push({
      id: custNodeId,
      kind: "customer",
      label: customer.company,
      subtitle: hasCases ? `${customer.cases.length} case(s)` : "No cases",
      parentId: parentNodeId,
      expandable: hasCases,
      expanded: isExpanded,
      accentColor: "#64748B",
      fillColor: "#F8FAFC",
      haloColor: null,
      employee: parentEmployee,
      customer,
      caseItem: null,
      priority: null,
      edgeStyle: "solid",
      metricsSummary: "",
    });

    edges.push({
      id: `${parentNodeId}→${custNodeId}`,
      fromId: parentNodeId,
      toId: custNodeId,
      style: "solid",
    });

    if (!isExpanded) {
      return;
    }

    // Cases fan out from customer node.
    for (const caseItem of customer.cases) {
      addCaseNode(caseItem, parentEmployee, customer, custNodeId);
    }
  }

  function addCaseNode(
    caseItem: EmployeeTreeCase,
    parentEmployee: EmployeeTreeEmployee,
    parentCustomer: EmployeeTreeCustomer,
    parentNodeId: string,
  ): void {
    const caseNodeId = `case:${caseItem.id}`;

    nodes.push({
      id: caseNodeId,
      kind: "case",
      label: caseItem.title,
      subtitle: caseItem.status,
      parentId: parentNodeId,
      expandable: false,
      expanded: false,
      accentColor: PRIORITY_OUTLINE_COLORS[caseItem.priority],
      fillColor: STATUS_FILL_COLORS[caseItem.status],
      haloColor: caseItem.hasPendingEndorsement ? ENDORSEMENT_HALO_COLOR : null,
      employee: parentEmployee,
      customer: parentCustomer,
      caseItem,
      priority: caseItem.priority,
      edgeStyle: "solid",
      metricsSummary: "",
    });

    edges.push({
      id: `${parentNodeId}→${caseNodeId}`,
      fromId: parentNodeId,
      toId: caseNodeId,
      style: "solid",
    });
  }

  // Build from root.
  addEmployeeNode(viewerEmployee, null, 0);

  // For Executive/Admin — also add Managers/CSRs that have no explicit managerId pointing to viewer
  // but are in the scope (they may be unparented or have fallback assignments).
  if (scope.viewerRole === "Executive" || scope.viewerRole === "Admin") {
    const addedIds = new Set(nodes.map((n) => n.id));

    // Find managers not yet added
    const orphanManagers = employees.filter(
      (e) => e.role === "Manager" && !addedIds.has(e.id),
    );
    for (const mgr of orphanManagers) {
      addEmployeeNode(mgr, viewerEmployee.id, 1);
    }

    // Find CSRs not yet added (no manager or manager not in scope)
    const addedIdsAfterManagers = new Set(nodes.map((n) => n.id));
    const orphanCsrs = employees.filter(
      (e) => e.role === "CSR" && !addedIdsAfterManagers.has(e.id),
    );
    for (const csr of orphanCsrs) {
      addEmployeeNode(csr, viewerEmployee.id, 1);
    }
  }

  // For Manager — also add CSRs not yet added
  if (scope.viewerRole === "Manager") {
    const addedIds = new Set(nodes.map((n) => n.id));
    const orphanCsrs = employees.filter(
      (e) => e.role === "CSR" && !addedIds.has(e.id),
    );
    for (const csr of orphanCsrs) {
      addEmployeeNode(csr, viewerEmployee.id, 1);
    }
  }

  return { nodes, edges, rootId: viewerEmployee.id };
}
