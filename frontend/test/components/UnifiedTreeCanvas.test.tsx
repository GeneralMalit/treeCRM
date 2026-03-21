import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnifiedTreeCanvas } from "@/components/graph/UnifiedTreeCanvas";
import { employeeTreeEmployees, employeeTreeScope } from "../fixtures/tree";

vi.mock("@/components/graph/forceSimulation", () => ({
  createSimulation: vi.fn((initialNodes: Array<{ id: string; x: number; y: number; radius: number }>) => ({
    updateGraph: vi.fn(),
    reheat: vi.fn(),
    stop: vi.fn(),
    onTick(callback: (nodes: ReadonlyArray<Readonly<{ id: string; x: number; y: number; radius: number }>>) => void) {
      callback(initialNodes.map((node) => ({ ...node })));
    },
  })),
}));

describe("UnifiedTreeCanvas", () => {
  it("renders controls and toggles the legend", () => {
    render(
      <UnifiedTreeCanvas
        employees={employeeTreeEmployees}
        scope={employeeTreeScope}
        focusEmployeeId={null}
        selectedNodeId={null}
        canGoBack
        onDrillDown={vi.fn()}
        onGoBack={vi.fn()}
        onSelectEmployee={vi.fn()}
        onSelectCase={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset View" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Legend" }));
    expect(screen.getByText("Customer/Case")).toBeInTheDocument();
  });

  it("shows the empty state when no employee nodes are available", () => {
    render(
      <UnifiedTreeCanvas
        employees={[]}
        scope={employeeTreeScope}
        focusEmployeeId={null}
        selectedNodeId={null}
        canGoBack={false}
        onDrillDown={vi.fn()}
        onGoBack={vi.fn()}
        onSelectEmployee={vi.fn()}
        onSelectCase={vi.fn()}
      />,
    );

    expect(screen.getByText("No employee nodes are currently available in this scope.")).toBeInTheDocument();
  });

  it("drills down and selects employee and case nodes", async () => {
    const onDrillDown = vi.fn();
    const onGoBack = vi.fn();
    const onSelectEmployee = vi.fn();
    const onSelectCase = vi.fn();

    render(
      <UnifiedTreeCanvas
        employees={employeeTreeEmployees}
        scope={employeeTreeScope}
        focusEmployeeId={null}
        selectedNodeId="case:case-1"
        canGoBack
        onDrillDown={onDrillDown}
        onGoBack={onGoBack}
        onSelectEmployee={onSelectEmployee}
        onSelectCase={onSelectCase}
      />,
    );

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll("g[style*='cursor: pointer']")).some((node) =>
          node.textContent?.includes("CSR One"),
        ),
      ).toBe(true);
    });

    const clickableNodes = Array.from(document.querySelectorAll("g[style*='cursor: pointer']"));
    const rootNode = clickableNodes.find((node) => node.textContent?.includes("CSR One"));
    const caseNode = clickableNodes.find((node) => node.textContent?.includes("Acme Corp"));

    expect(rootNode).toBeTruthy();
    expect(caseNode).toBeTruthy();

    fireEvent.click(rootNode as Element);
    fireEvent.click(caseNode as Element);
  });
});
