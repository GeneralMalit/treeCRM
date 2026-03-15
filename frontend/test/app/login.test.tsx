import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";

const push = vi.fn();
const searchParamsGet = vi.fn(() => null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => ({
    get: searchParamsGet,
  }),
}));

vi.mock("@/lib/auth", () => ({
  getLandingRoute: vi.fn((role: string) => (role === "CSR" ? "/employee/csr" : "/portal")),
  login: vi.fn(),
  register: vi.fn(),
  setStoredAccessToken: vi.fn(),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  searchParamsGet.mockReset();
  searchParamsGet.mockReturnValue(null);
});

describe("LoginPage", () => {
  it("logs in and redirects by role", async () => {
    const { login } = await import("@/lib/auth");
    vi.mocked(login).mockResolvedValue({
      status: "ok",
      message: "ok",
      token: "token-1",
      user: { id: "csr-1", email: "csr@example.com", role: "CSR" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getAllByRole("textbox", { name: /email/i })[0] as HTMLElement, {
      target: { value: "csr@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Login" })[1] as HTMLElement);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/employee/csr");
    });
  });

  it("shows auth errors and supports register mode", async () => {
    const { register } = await import("@/lib/auth");
    vi.mocked(register).mockRejectedValue(new Error("Registration failed"));

    render(<LoginPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Register" })[0] as HTMLElement);
    expect(screen.queryByLabelText("Role")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name (optional)")).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("textbox", { name: /email/i })[0] as HTMLElement, {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Register" })[1] as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("Registration failed")).toBeInTheDocument();
    });
  });
});
