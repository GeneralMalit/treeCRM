import { describe, expect, it } from "vitest";
import { buildUnifiedTree } from "@/lib/employeeGraph";
import { layoutUnifiedTree } from "@/components/graph/graphLayout";
import { employeeTreeEmployees, employeeTreeScope } from "../fixtures/tree";

describe("unified tree layout", () => {
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
});
