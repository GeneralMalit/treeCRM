import { describe, expect, it } from "vitest";
import { buildUnifiedTree } from "@/lib/employeeGraph";
import { getRouteForRole } from "@/lib/roles";
import { employeeTreeEmployees, employeeTreeScope } from "../fixtures/tree";

describe("employee graph builders", () => {
  it("builds a unified tree with the viewer as root and case nodes as children", () => {
    const model = buildUnifiedTree(employeeTreeScope, employeeTreeEmployees, null);
    expect(model.rootId).toBe("csr-1");
    expect(model.nodes.some((node) => node.id === "case:case-1" && node.kind === "case")).toBe(true);
    expect(model.edges.some((edge) => edge.toId === "case:case-1")).toBe(true);
  });

  it("maps roles to stable routes", () => {
    expect(getRouteForRole("Manager")).toBe("/employee/manager");
  });
});
