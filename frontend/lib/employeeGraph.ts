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
        employee.managerId && employeesById.has(employee.managerId)
          ? employeesById.get(employee.managerId) ?? null
          : null;

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

export type UnifiedNodeKind = "employee" | "case";

export type UnifiedTreeNode = {
  id: string;
  kind: UnifiedNodeKind;
  label: string;
  subtitle: string;
  parentId: string | null;
  expandable: boolean;
  expanded: boolean;
  accentColor: string;
  fillColor: string;
  haloColor: string | null;
  employee: EmployeeTreeEmployee | null;
  customer: EmployeeTreeCustomer | null;
  caseItem: EmployeeTreeCase | null;
  priority: CasePriority | null;
  edgeStyle: "dashed" | "solid";
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
  return `${metrics.ongoingCases} ongoing, ${metrics.resolvedToday} resolved today`;
}

function getEmployeeSortLabel(employee: EmployeeTreeEmployee): string {
  return (employee.name?.trim() || employee.email).toLowerCase();
}

function buildManagerCsrAssignments(
  managers: EmployeeTreeEmployee[],
  csrs: EmployeeTreeEmployee[],
): Map<string, string[]> {
  const managerIds = new Set(managers.map((manager) => manager.id));
  const csrIdsByManagerId = new Map<string, string[]>(
    managers.map((manager) => [manager.id, [] as string[]]),
  );
  const unassignedCsrIds: string[] = [];

  for (const csr of csrs) {
    if (csr.managerId && managerIds.has(csr.managerId)) {
      const current = csrIdsByManagerId.get(csr.managerId) ?? [];
      current.push(csr.id);
      csrIdsByManagerId.set(csr.managerId, current);
      continue;
    }
    unassignedCsrIds.push(csr.id);
  }

  const hasExplicitAssignments = Array.from(csrIdsByManagerId.values()).some((ids) => ids.length > 0);
  if (hasExplicitAssignments || managers.length === 0 || unassignedCsrIds.length === 0) {
    return csrIdsByManagerId;
  }

  const managerWorkloads = managers
    .slice()
    .sort((left, right) => getEmployeeSortLabel(left).localeCompare(getEmployeeSortLabel(right)))
    .map((manager) => ({
      managerId: manager.id,
      caseLoad: 0,
    }));

  const csrById = new Map(csrs.map((csr) => [csr.id, csr]));
  const fallbackCsrIds = unassignedCsrIds
    .slice()
    .sort((leftId, rightId) => {
      const leftLoad = csrById.get(leftId)?.metrics.totalCases ?? 0;
      const rightLoad = csrById.get(rightId)?.metrics.totalCases ?? 0;
      return rightLoad - leftLoad;
    });

  for (const csrId of fallbackCsrIds) {
    managerWorkloads.sort((left, right) => {
      if (left.caseLoad !== right.caseLoad) {
        return left.caseLoad - right.caseLoad;
      }
      return left.managerId.localeCompare(right.managerId);
    });

    const [targetManager] = managerWorkloads;
    if (!targetManager) {
      break;
    }

    const current = csrIdsByManagerId.get(targetManager.managerId) ?? [];
    current.push(csrId);
    csrIdsByManagerId.set(targetManager.managerId, current);
    targetManager.caseLoad += csrById.get(csrId)?.metrics.totalCases ?? 0;
  }

  return csrIdsByManagerId;
}

export function buildUnifiedTree(
  scope: EmployeeTreeScope,
  employees: EmployeeTreeEmployee[],
  focusEmployeeId: string | null,
): UnifiedTreeModel {
  const nodes: UnifiedTreeNode[] = [];
  const edges: UnifiedTreeEdge[] = [];
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const managers = employees.filter((employee) => employee.role === "Manager");
  const csrs = employees.filter((employee) => employee.role === "CSR");
  const csrIdsByManagerId = buildManagerCsrAssignments(managers, csrs);

  const rootId = focusEmployeeId ?? scope.viewerId;
  const rootEmployee = employees.find((employee) => employee.id === rootId)
    ?? employees.find((employee) => employee.id === scope.viewerId);

  if (!rootEmployee) {
    return { nodes: [], edges: [], rootId: scope.viewerId };
  }

  function getEmployeeChildren(parentId: string): EmployeeTreeEmployee[] {
    const parent = employeesById.get(parentId);
    if (!parent) {
      return [];
    }

    if (parent.role === "Manager") {
      const assignedCsrIds = csrIdsByManagerId.get(parent.id) ?? [];
      return assignedCsrIds
        .map((csrId) => employeesById.get(csrId))
        .filter((employee): employee is EmployeeTreeEmployee => Boolean(employee))
        .sort((left, right) => getEmployeeSortLabel(left).localeCompare(getEmployeeSortLabel(right)));
    }

    if (parent.role === "Executive" || parent.role === "Admin") {
      return employees
        .filter((employee) => employee.role === "Manager" && employee.managerId === parentId && employee.id !== parentId)
        .sort((left, right) => getEmployeeSortLabel(left).localeCompare(getEmployeeSortLabel(right)));
    }

    return employees
      .filter((employee) => employee.managerId === parentId && employee.id !== parentId)
      .sort((left, right) => getEmployeeSortLabel(left).localeCompare(getEmployeeSortLabel(right)));
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
      label: parentCustomer.company,
      subtitle: caseItem.status,
      parentId: parentNodeId,
      expandable: false,
      expanded: false,
      accentColor: "#64748B",
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
      id: `${parentNodeId}->${caseNodeId}`,
      fromId: parentNodeId,
      toId: caseNodeId,
      style: "solid",
    });
  }

  function addChildEmployeeNode(employee: EmployeeTreeEmployee, parentNodeId: string): void {
    const caseCount = employee.customers.reduce((total, customer) => total + customer.cases.length, 0);
    const employeeChildren = getEmployeeChildren(employee.id);
    const customerCasePairs = employee.customers.flatMap((customer) =>
      customer.cases
        .map((caseItem) => ({ customer, caseItem })),
    );
    const hasChildren = employeeChildren.length > 0 || customerCasePairs.length > 0;

    nodes.push({
      id: employee.id,
      kind: "employee",
      label: getEmployeeDisplayName(employee),
      subtitle: `${employee.role} - ${caseCount} cases`,
      parentId: parentNodeId,
      expandable: hasChildren,
      expanded: false,
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

    edges.push({
      id: `${parentNodeId}->${employee.id}`,
      fromId: parentNodeId,
      toId: employee.id,
      style: "dashed",
    });
  }

  // Root node (always expanded).
  const rootCaseCount = rootEmployee.customers.reduce((total, customer) => total + customer.cases.length, 0);
  const rootEmployeeChildren = getEmployeeChildren(rootEmployee.id);
  const rootCustomerCasePairs = rootEmployee.customers.flatMap((customer) =>
    customer.cases
      .map((caseItem) => ({ customer, caseItem })),
  );
  const rootHasChildren = rootEmployeeChildren.length > 0 || rootCustomerCasePairs.length > 0;

  nodes.push({
    id: rootEmployee.id,
    kind: "employee",
    label: getEmployeeDisplayName(rootEmployee),
    subtitle: `${rootEmployee.role} - ${rootCaseCount} cases`,
    parentId: null,
    expandable: rootHasChildren,
    expanded: true,
    accentColor: getEmployeeGraphAccent(rootEmployee.role),
    fillColor: "#FFFFFF",
    haloColor: null,
    employee: rootEmployee,
    customer: null,
    caseItem: null,
    priority: null,
    edgeStyle: makeEmployeeEdgeStyle(rootEmployee.role),
    metricsSummary: buildMetricsSummary(rootEmployee.metrics),
  });

  // Direct employee children (one level only).
  for (const child of rootEmployeeChildren) {
    addChildEmployeeNode(child, rootEmployee.id);
  }

  // Orphan managers for Executive/Admin.
  if (rootEmployee.role === "Executive" || rootEmployee.role === "Admin") {
    const addedIds = new Set(nodes.map((node) => node.id));
    const orphanManagers = employees.filter((e) => e.role === "Manager" && !addedIds.has(e.id));
    for (const manager of orphanManagers) {
      addChildEmployeeNode(manager, rootEmployee.id);
    }
  }

  // Case nodes for root (CSR or leaf with customers).
  if (rootEmployee.role === "CSR" || (rootEmployeeChildren.length === 0 && rootEmployee.customers.length > 0)) {
    rootCustomerCasePairs
      .sort((left, right) => {
        const byCustomer = left.customer.company.localeCompare(right.customer.company);
        if (byCustomer !== 0) return byCustomer;
        return new Date(right.caseItem.updatedAt).getTime() - new Date(left.caseItem.updatedAt).getTime();
      })
      .forEach(({ customer, caseItem }) => {
        addCaseNode(caseItem, rootEmployee, customer, rootEmployee.id);
      });
  }

  return { nodes, edges, rootId: rootEmployee.id };
}
