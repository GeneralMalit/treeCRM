import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/lib/auth", () => ({
  clearStoredAccessToken: vi.fn(),
  getLandingRoute: vi.fn(() => "/portal"),
  getStoredAccessToken: vi.fn(),
  me: vi.fn(),
}));

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
  });

  it("shows a production landing page for unauthenticated users", async () => {
    const { getStoredAccessToken } = await import("@/lib/auth");
    vi.mocked(getStoredAccessToken).mockReturnValue(null);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "TreeCRM", level: 1 })).toBeInTheDocument();
    });
    
    const signInLinks = screen.getAllByRole("link", { name: "Sign In" });
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to their role landing route", async () => {
    const { getStoredAccessToken, me, getLandingRoute } = await import("@/lib/auth");
    vi.mocked(getStoredAccessToken).mockReturnValue("token-1");
    vi.mocked(me).mockResolvedValue({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer One",
    });
    vi.mocked(getLandingRoute).mockReturnValue("/portal");

    render(<HomePage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/portal");
    });
  });
});
