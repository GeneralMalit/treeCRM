import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoleDashboard } from "@/components/RoleDashboard";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/lib/auth", () => ({
  clearStoredAccessToken: vi.fn(),
  getLandingRoute: vi.fn(() => "/portal"),
  getStoredAccessToken: vi.fn(() => "token-1"),
  logout: vi.fn().mockResolvedValue(undefined),
  me: vi.fn(),
}));

describe("RoleDashboard", () => {
  it("renders the authenticated user and logs out", async () => {
    const { me } = await import("@/lib/auth");
    vi.mocked(me).mockResolvedValue({
      sub: "manager-1",
      email: "manager@example.com",
      role: "Manager",
      name: "Manager One",
    });

    render(<RoleDashboard allowedRoles={["Manager"]} title="Manager" description="Desc" />);

    await waitFor(() => {
      expect(screen.getByText(/Manager One/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });
});
