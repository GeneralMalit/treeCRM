import { describe, expect, it } from "vitest";
import {
  buildHierarchyGraph,
  buildSkillTreeGraph,
  buildUnifiedTree,
  getEmployeeDisplayName,
  getEmployeeGraphAccent,
  truncateGraphLabel,
} from "@/lib/employeeGraph";
import { getRouteForRole } from "@/lib/roles";
import { employeeTreeEmployees, employeeTreeScope } from "../fixtures/tree";

describe("employee graph builders", () => {
  it("formats employee labels, accents, and truncation rules", () => {
    expect(getEmployeeDisplayName({ name: "  Jane Doe  ", email: "jane@example.com" })).toBe("Jane Doe");
    expect(getEmployeeDisplayName({ name: " ", email: "jane@example.com" })).toBe("jane@example.com");
    expect(getEmployeeGraphAccent("Executive")).toBe("#1D4ED8");
    expect(getEmployeeGraphAccent("Customer")).toBe("#475569");
    expect(truncateGraphLabel("Customer", 8)).toBe("Customer");
    expect(truncateGraphLabel("Customer", 5)).toBe("Cu...");
    expect(truncateGraphLabel("Customer", 3)).toBe("Cus");
  });

  it("builds a unified tree with the viewer as root and case nodes as children", () => {
    const model = buildUnifiedTree(employeeTreeScope, employeeTreeEmployees, null);
    expect(model.rootId).toBe("csr-1");
    expect(model.nodes.some((node) => node.id === "case:case-1" && node.kind === "case")).toBe(true);
    expect(model.edges.some((edge) => edge.toId === "case:case-1")).toBe(true);
  });

  it("builds hierarchy and skill trees from the same employee data", () => {
    const managerEmployees = [
      {
        ...employeeTreeEmployees[0],
        id: "manager-1",
        name: "Manager One",
        role: "Manager" as const,
        managerId: "exec-1",
        customers: [],
      },
      {
        id: "exec-1",
        name: "Executive One",
        email: "exec@example.com",
        role: "Executive" as const,
        managerId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: employeeTreeEmployees[0].metrics,
        customers: [],
      },
    ];

    const hierarchy = buildHierarchyGraph({ ...employeeTreeScope, viewerId: "exec-1", viewerRole: "Executive" }, managerEmployees);
    expect(hierarchy.nodes[0].level).toBe(0);
    expect(hierarchy.edges.length).toBeGreaterThanOrEqual(1);

    const skillTree = buildSkillTreeGraph(employeeTreeEmployees[0], "customer-1");
    expect(skillTree.activeCustomer?.id).toBe("customer-1");
    expect(skillTree.casesByPriority.High.map((caseItem) => caseItem.id)).toEqual(["case-1"]);
  });

  it("sorts executives alphabetically and falls back to the first executive when the viewer is missing", () => {
    const hierarchy = buildHierarchyGraph(
      { ...employeeTreeScope, viewerId: "missing-viewer", viewerRole: "Executive" },
      [
        {
          id: "exec-z",
          name: "Zulu Executive",
          email: "zulu@example.com",
          role: "Executive" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "exec-a",
          name: "Alpha Executive",
          email: "alpha@example.com",
          role: "Executive" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "manager-1",
          name: "Manager One",
          email: "manager@example.com",
          role: "Manager" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
      ],
    );

    expect(hierarchy.nodes[0].id).toBe("exec-a");
    expect(hierarchy.nodes.find((node) => node.id === "manager-1")?.parentId).toBe("exec-a");
  });

  it("handles empty skill trees and fallback customer selection", () => {
    const emptySkillTree = buildSkillTreeGraph(
      {
        ...employeeTreeEmployees[0],
        customers: [],
      },
      "missing-customer",
    );

    expect(emptySkillTree.activeCustomer).toBeNull();
    expect(emptySkillTree.casesByPriority.High).toEqual([]);
    expect(emptySkillTree.casesByPriority.Medium).toEqual([]);
    expect(emptySkillTree.casesByPriority.Low).toEqual([]);
  });

  it("maps unknown hierarchy roles to the leaf level", () => {
    const hierarchy = buildHierarchyGraph(
      { ...employeeTreeScope, viewerId: "exec-1", viewerRole: "Executive" },
      [
        {
          id: "exec-1",
          name: "Executive One",
          email: "exec@example.com",
          role: "Executive" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "custom-1",
          name: "Custom Role",
          email: "custom@example.com",
          role: "Customer" as never,
          managerId: "exec-1",
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
      ],
    );

    expect(hierarchy.nodes.find((node) => node.id === "custom-1")?.level).toBe(2);
  });

  it("falls back to workload-based manager assignment for unassigned CSRs", () => {
    const employees = [
      {
        id: "exec-1",
        name: "Executive One",
        email: "exec@example.com",
        role: "Executive" as const,
        managerId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: employeeTreeEmployees[0].metrics,
        customers: [],
      },
      {
        id: "manager-a",
        name: "Alpha Manager",
        email: "alpha@example.com",
        role: "Manager" as const,
        managerId: "exec-1",
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: employeeTreeEmployees[0].metrics,
        customers: [],
      },
      {
        id: "manager-b",
        name: "Beta Manager",
        email: "beta@example.com",
        role: "Manager" as const,
        managerId: "exec-1",
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: employeeTreeEmployees[0].metrics,
        customers: [],
      },
      {
        id: "csr-high",
        name: "CSR High",
        email: "high@example.com",
        role: "CSR" as const,
        managerId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: { ...employeeTreeEmployees[0].metrics, totalCases: 5 },
        customers: [],
      },
      {
        id: "csr-low",
        name: "CSR Low",
        email: "low@example.com",
        role: "CSR" as const,
        managerId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: { ...employeeTreeEmployees[0].metrics, totalCases: 1 },
        customers: [],
      },
    ];

    const hierarchy = buildHierarchyGraph(
      { ...employeeTreeScope, viewerId: "exec-1", viewerRole: "Executive" },
      employees,
    );

    expect(hierarchy.nodes.some((node) => node.id === "manager-a" && node.parentId === "exec-1")).toBe(true);
    expect(hierarchy.nodes.some((node) => node.id === "manager-b" && node.parentId === "exec-1")).toBe(true);
  });

  it("keeps explicit manager CSR assignments and falls back to the viewer root", () => {
    const tree = buildUnifiedTree(
      { ...employeeTreeScope, viewerId: "manager-1", viewerRole: "Manager" },
      [
        {
          id: "manager-1",
          name: "Manager One",
          email: "manager@example.com",
          role: "Manager" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "csr-assigned",
          name: "Assigned CSR",
          email: "assigned@example.com",
          role: "CSR" as const,
          managerId: "manager-1",
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "csr-unassigned",
          name: "Unassigned CSR",
          email: "unassigned@example.com",
          role: "CSR" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: { ...employeeTreeEmployees[0].metrics, totalCases: 8 },
          customers: [],
        },
      ],
      "missing-root",
    );

    expect(tree.rootId).toBe("manager-1");
    expect(tree.nodes.some((node) => node.id === "csr-assigned" && node.parentId === "manager-1")).toBe(true);
    expect(tree.nodes.some((node) => node.id === "csr-unassigned")).toBe(false);
  });

  it("includes admin-managed children and orphan managers when the focus root is missing", () => {
    const tree = buildUnifiedTree(
      { ...employeeTreeScope, viewerId: "admin-1", viewerRole: "Admin" },
      [
        {
          id: "admin-1",
          name: "Admin One",
          email: "admin@example.com",
          role: "Admin" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "manager-direct",
          name: "Direct Manager",
          email: "direct@example.com",
          role: "Manager" as const,
          managerId: "admin-1",
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
        {
          id: "manager-orphan",
          name: "Orphan Manager",
          email: "orphan@example.com",
          role: "Manager" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
      ],
      "missing-focus",
    );

    expect(tree.rootId).toBe("admin-1");
    expect(tree.nodes.some((node) => node.id === "manager-direct" && node.parentId === "admin-1")).toBe(true);
    expect(tree.nodes.some((node) => node.id === "manager-orphan" && node.parentId === "admin-1")).toBe(true);
  });

  it("sorts root case nodes by company then recency", () => {
    const rootEmployee = {
      id: "csr-root",
      name: "Root CSR",
      email: "root@example.com",
      role: "CSR" as const,
      managerId: null,
      createdAt: "2026-03-08T00:00:00.000Z",
      metrics: employeeTreeEmployees[0].metrics,
      customers: [
        {
          id: "customer-1",
          userId: "customer-user-1",
          company: "Acme Corp",
          contactInfo: { email: "acme@example.com" },
          createdAt: "2026-03-08T00:00:00.000Z",
          cases: [
            {
              id: "case-old",
              title: "Old issue",
              description: "Older",
              status: "Open" as const,
              priority: "Low" as const,
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T01:00:00.000Z",
              hasPendingEndorsement: false,
              pendingEndorsementCount: 0,
            },
          ],
        },
        {
          id: "customer-2",
          userId: "customer-user-2",
          company: "Acme Corp",
          contactInfo: { email: "acme2@example.com" },
          createdAt: "2026-03-08T00:00:00.000Z",
          cases: [
            {
              id: "case-new",
              title: "New issue",
              description: "Newer",
              status: "Open" as const,
              priority: "Low" as const,
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T02:00:00.000Z",
              hasPendingEndorsement: false,
              pendingEndorsementCount: 0,
            },
          ],
        },
      ],
    };

    const tree = buildUnifiedTree(
      { ...employeeTreeScope, viewerId: "csr-root", viewerRole: "CSR" },
      [rootEmployee],
      null,
    );

    expect(tree.nodes.filter((node) => node.kind === "case").map((node) => node.id)).toEqual([
      "case:case-new",
      "case:case-old",
    ]);
  });

  it("builds executive-root trees with direct customers", () => {
    const tree = buildUnifiedTree(
      { ...employeeTreeScope, viewerId: "exec-1", viewerRole: "Executive" },
      [
        {
          id: "exec-1",
          name: "Executive One",
          email: "exec@example.com",
          role: "Executive" as const,
          managerId: null,
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [
            {
              id: "customer-1",
              userId: "customer-user-1",
              company: "Acme Corp",
              contactInfo: { email: "acme@example.com" },
              createdAt: "2026-03-08T00:00:00.000Z",
              cases: [
                {
                  id: "case-1",
                  title: "One",
                  description: "One",
                  status: "Open",
                  priority: "High",
                  createdAt: "2026-03-08T00:00:00.000Z",
                  updatedAt: "2026-03-08T01:00:00.000Z",
                  hasPendingEndorsement: false,
                  pendingEndorsementCount: 0,
                },
              ],
            },
          ],
        },
      ],
      null,
    );

    expect(tree.nodes.some((node) => node.id === "case:case-1")).toBe(true);
  });

  it("covers orphan managers, missing roots, and fallback employee children", () => {
    expect(buildUnifiedTree(employeeTreeScope, [], null)).toEqual({
      nodes: [],
      edges: [],
      rootId: "csr-1",
    });

    const executiveEmployees = [
      {
        id: "exec-1",
        name: "Executive One",
        email: "exec@example.com",
        role: "Executive" as const,
        managerId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: employeeTreeEmployees[0].metrics,
        customers: [],
      },
      {
        id: "manager-1",
        name: "Manager One",
        email: "manager@example.com",
        role: "Manager" as const,
        managerId: null,
        createdAt: "2026-03-08T00:00:00.000Z",
        metrics: employeeTreeEmployees[0].metrics,
        customers: [],
      },
    ];
    const executiveTree = buildUnifiedTree(
      { ...employeeTreeScope, viewerId: "exec-1", viewerRole: "Executive" },
      executiveEmployees,
      null,
    );

    expect(executiveTree.rootId).toBe("exec-1");
    expect(executiveTree.nodes.some((node) => node.id === "manager-1" && node.parentId === "exec-1")).toBe(true);

    const hierarchy = buildHierarchyGraph(
      { ...employeeTreeScope, viewerId: "exec-1", viewerRole: "Executive" },
      [
        ...executiveEmployees,
        {
          id: "csr-2",
          name: "CSR Two",
          email: "csr2@example.com",
          role: "CSR" as const,
          managerId: "manager-1",
          createdAt: "2026-03-08T00:00:00.000Z",
          metrics: employeeTreeEmployees[0].metrics,
          customers: [],
        },
      ],
    );

    expect(hierarchy.nodes.find((node) => node.id === "manager-1")?.parentId).toBe("exec-1");
    expect(hierarchy.nodes.find((node) => node.id === "csr-2")?.parentId).toBe("manager-1");
  });

  it("maps roles to stable routes", () => {
    expect(getRouteForRole("Manager")).toBe("/employee/manager");
  });
});
