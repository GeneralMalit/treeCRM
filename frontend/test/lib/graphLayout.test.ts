import { describe, expect, it } from "vitest";
import { buildHierarchyGraph, buildSkillTreeGraph, buildUnifiedTree } from "@/lib/employeeGraph";
import {
  describeArc,
  layoutHierarchyGraph,
  layoutSkillTreeGraph,
  layoutUnifiedTree,
} from "@/components/graph/graphLayout";
import { employeeTreeEmployees, employeeTreeScope } from "../fixtures/tree";

describe("unified tree layout", () => {
  it("describes arcs and handles empty unified trees", () => {
    expect(describeArc(0, 0, 10, 0, 90)).toContain("A 10 10");
    expect(describeArc(0, 0, 10, 0, 270)).toContain("A 10 10 0 1 0");
    expect(layoutUnifiedTree({ nodes: [], edges: [], rootId: "missing" })).toEqual({
      nodes: [],
      edges: [],
      minX: -400,
      minY: -400,
      maxX: 400,
      maxY: 400,
    });
  });

  it("returns bounded coordinates and keeps the root near origin", () => {
    const model = buildUnifiedTree(employeeTreeScope, employeeTreeEmployees, null);
    const layout = layoutUnifiedTree(model);
    const root = layout.nodes.find((node) => node.node.id === "csr-1");

    expect(root).toBeDefined();
    expect(root?.x).toBe(0);
    expect(root?.y).toBe(0);
    expect(layout.maxX).toBeGreaterThan(layout.minX);
    expect(layout.maxY).toBeGreaterThan(layout.minY);
  });

  it("lays out hierarchy and skill tree graphs with stable spacing", () => {
    const hierarchy = buildHierarchyGraph(employeeTreeScope, employeeTreeEmployees);
    const hierarchyLayout = layoutHierarchyGraph(hierarchy);
    expect(hierarchyLayout.nodes[0].y).toBeLessThanOrEqual(hierarchyLayout.nodes.at(-1)?.y ?? 0);
    expect(hierarchyLayout.edges.length).toBeGreaterThanOrEqual(0);

    const skillTree = buildSkillTreeGraph(employeeTreeEmployees[0], "customer-1");
    const skillLayout = layoutSkillTreeGraph(skillTree);
    expect(skillLayout.root.x).toBe(430);
    expect(skillLayout.customers[0].customer.id).toBe("customer-1");
    expect(skillLayout.caseNodes[0].caseItem.id).toBe("case-1");
  });

  it("spreads multiple customers and case rings across the skill tree", () => {
    const skillTree = buildSkillTreeGraph(
      {
        ...employeeTreeEmployees[0],
        customers: [
          ...employeeTreeEmployees[0].customers,
          {
            id: "customer-2",
            userId: "customer-user-2",
            company: "Beta Corp",
            contactInfo: { email: "beta@example.com" },
            createdAt: "2026-03-08T00:00:00.000Z",
            cases: [
              {
                id: "case-2",
                title: "Billing",
                description: "Billing issue",
                status: "Resolved",
                priority: "Medium",
                createdAt: "2026-03-08T00:00:00.000Z",
                updatedAt: "2026-03-08T02:00:00.000Z",
                hasPendingEndorsement: false,
                pendingEndorsementCount: 0,
              },
            ],
          },
        ],
      },
      "customer-2",
    );

    const skillLayout = layoutSkillTreeGraph(skillTree);
    expect(skillLayout.customers).toHaveLength(2);
    expect(skillLayout.caseNodes.map((node) => node.caseItem.id)).toEqual(["case-2"]);
    expect(skillLayout.rings.map((ring) => ring.priority)).toEqual(["High", "Medium", "Low"]);
  });

  it("sorts hierarchy siblings and skips unreachable hierarchy nodes", () => {
    const model: Parameters<typeof layoutHierarchyGraph>[0] = {
      nodes: [
        {
          id: "root",
          employee: employeeTreeEmployees[0],
          label: "Root",
          subtitle: "Executive",
          level: 0,
          parentId: null,
          customerCount: 0,
          caseCount: 0,
        },
        {
          id: "zulu",
          employee: employeeTreeEmployees[0],
          label: "Zulu Manager",
          subtitle: "Manager",
          level: 1,
          parentId: "root",
          customerCount: 0,
          caseCount: 0,
        },
        {
          id: "alpha",
          employee: employeeTreeEmployees[0],
          label: "Alpha Manager",
          subtitle: "Manager",
          level: 1,
          parentId: "root",
          customerCount: 0,
          caseCount: 0,
        },
        {
          id: "orphan",
          employee: employeeTreeEmployees[0],
          label: "Orphan CSR",
          subtitle: "CSR",
          level: 2,
          parentId: "missing",
          customerCount: 0,
          caseCount: 0,
        },
      ],
      edges: [
        { id: "root:zulu", fromId: "root", toId: "zulu" },
        { id: "root:alpha", fromId: "root", toId: "alpha" },
        { id: "orphan:ghost", fromId: "orphan", toId: "ghost" },
      ],
    };

    const layout = layoutHierarchyGraph(model);

    expect(layout.nodes.map((node) => node.node.id)).toEqual(["root", "alpha", "zulu", "orphan"]);
    expect(layout.nodes.find((node) => node.node.id === "orphan")?.x).toBe(96);
    expect(layout.edges.map((edge) => edge.id)).toEqual(["root:zulu", "root:alpha"]);
  });

  it("skips edges with missing positions when laying out a unified tree", () => {
    const layout = layoutUnifiedTree({
      rootId: "root",
      nodes: [
        {
          id: "root",
          kind: "employee",
          label: "Root",
          subtitle: "CSR - 0 cases",
          parentId: null,
          expandable: false,
          expanded: true,
          accentColor: "#000",
          fillColor: "#FFF",
          haloColor: null,
          employee: employeeTreeEmployees[0],
          customer: null,
          caseItem: null,
          priority: null,
          edgeStyle: { stroke: "#000", strokeWidth: 2, dashArray: "0", opacity: 1 },
          metricsSummary: [],
        },
      ],
      edges: [
        {
          id: "edge-1",
          fromId: "root",
          toId: "missing",
          style: { stroke: "#000", strokeWidth: 2, dashArray: "0", opacity: 1 },
        },
      ],
    });

    expect(layout.edges).toHaveLength(0);
    expect(layout.nodes).toHaveLength(1);
  });

  it("adjusts overlapping unified nodes when the root is the left node", () => {
    const layout = layoutUnifiedTree({
      rootId: "root",
      nodes: [
        {
          id: "root",
          kind: "employee",
          label: "Root Employee With A Very Long Label",
          subtitle: "CSR - 0 cases",
          parentId: null,
          expandable: true,
          expanded: true,
          accentColor: "#000",
          fillColor: "#FFF",
          haloColor: null,
          employee: employeeTreeEmployees[0],
          customer: null,
          caseItem: null,
          priority: null,
          edgeStyle: { stroke: "#000", strokeWidth: 2, dashArray: "0", opacity: 1 },
          metricsSummary: [],
        },
        {
          id: "child",
          kind: "employee",
          label: "Child Employee With A Very Long Label",
          subtitle: "Manager - 0 cases",
          parentId: "root",
          expandable: false,
          expanded: false,
          accentColor: "#000",
          fillColor: "#FFF",
          haloColor: null,
          employee: employeeTreeEmployees[0],
          customer: null,
          caseItem: null,
          priority: null,
          edgeStyle: { stroke: "#000", strokeWidth: 2, dashArray: "0", opacity: 1 },
          metricsSummary: [],
        },
      ],
      edges: [],
    });

    expect(layout.nodes).toHaveLength(2);
    expect(layout.nodes.find((node) => node.node.id === "root")?.x).toBe(0);
    expect(layout.nodes.find((node) => node.node.id === "child")?.x).not.toBe(0);
  });

  it("adjusts overlapping unified nodes when the root is the right node", () => {
    const layout = layoutUnifiedTree({
      rootId: "root",
      nodes: [
        {
          id: "child",
          kind: "employee",
          label: "Child Employee With A Very Long Label",
          subtitle: "Manager - 0 cases",
          parentId: "root",
          expandable: false,
          expanded: false,
          accentColor: "#000",
          fillColor: "#FFF",
          haloColor: null,
          employee: employeeTreeEmployees[0],
          customer: null,
          caseItem: null,
          priority: null,
          edgeStyle: { stroke: "#000", strokeWidth: 2, dashArray: "0", opacity: 1 },
          metricsSummary: [],
        },
        {
          id: "root",
          kind: "employee",
          label: "Root Employee With A Very Long Label",
          subtitle: "CSR - 0 cases",
          parentId: null,
          expandable: true,
          expanded: true,
          accentColor: "#000",
          fillColor: "#FFF",
          haloColor: null,
          employee: employeeTreeEmployees[0],
          customer: null,
          caseItem: null,
          priority: null,
          edgeStyle: { stroke: "#000", strokeWidth: 2, dashArray: "0", opacity: 1 },
          metricsSummary: [],
        },
      ],
      edges: [],
    });

    expect(layout.nodes).toHaveLength(2);
    expect(layout.nodes.find((node) => node.node.id === "root")?.x).toBe(0);
    expect(layout.nodes.find((node) => node.node.id === "child")?.x).not.toBe(0);
  });
});
