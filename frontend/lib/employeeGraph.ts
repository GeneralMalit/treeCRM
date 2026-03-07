import type {
  CasePriority,
  CaseStatus,
  EmployeeTreeCase,
  EmployeeTreeCustomer,
  EmployeeTreeEmployee,
  EmployeeTreeScope,
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
