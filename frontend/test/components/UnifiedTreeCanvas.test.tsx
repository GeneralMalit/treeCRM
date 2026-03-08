import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnifiedTreeCanvas } from "@/components/graph/UnifiedTreeCanvas";
import { employeeTreeEmployees, employeeTreeScope } from "../fixtures/tree";

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
});
