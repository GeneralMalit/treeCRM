import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellTopbar } from "@/components/shell/ShellTopbar";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/lib/auth", () => ({
  clearStoredAccessToken: vi.fn(),
  getStoredAccessToken: vi.fn(),
  logout: vi.fn(),
}));

describe("ShellTopbar", () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
  });

  it("clears the stored token before redirecting to login", async () => {
    const { clearStoredAccessToken, getStoredAccessToken, logout } = await import("@/lib/auth");
    vi.mocked(getStoredAccessToken).mockReturnValue("token-1");
    vi.mocked(logout).mockResolvedValue(undefined);

    render(<ShellTopbar title="Admin" />);

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith("token-1");
      expect(clearStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });
});
