import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFooter } from "@/components/AppFooter";
import { APP_FOOTER_TEXT } from "@/lib/appMeta";

describe("AppFooter", () => {
  it("renders the exact legal footer text", () => {
    render(<AppFooter />);
    expect(screen.getByText(APP_FOOTER_TEXT)).toBeInTheDocument();
  });
});
