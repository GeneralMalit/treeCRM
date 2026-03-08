import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFooter } from "@/components/AppFooter";

describe("AppFooter", () => {
  it("renders the exact legal footer text", () => {
    render(<AppFooter />);
    expect(screen.getByText("(c) 2026 treeCRM by General Malit - v1.0.0")).toBeInTheDocument();
  });
});
