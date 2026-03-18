import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminWorkspace } from "@/components/AdminWorkspace";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/lib/realtime", () => ({
  disconnectRealtimeSocket: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  clearStoredAccessToken: vi.fn(),
  getLandingRoute: vi.fn(() => "/admin"),
  getStoredAccessToken: vi.fn(() => "token-1"),
  logout: vi.fn().mockResolvedValue(undefined),
  me: vi.fn(),
}));

vi.mock("@/lib/adminPanel", () => ({
  createAdminTag: vi.fn(),
  createAdminUser: vi.fn(),
  deleteAdminTag: vi.fn(),
  deleteAdminUser: vi.fn(),
  fetchAdminSettings: vi.fn(),
  fetchAdminTags: vi.fn(),
  fetchAdminUsers: vi.fn(),
  updateAdminSettings: vi.fn(),
  updateAdminTag: vi.fn(),
  updateAdminUser: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("AdminWorkspace", () => {
  it("renders employee provisioning and admin management sections", async () => {
    const { me } = await import("@/lib/auth");
    const { fetchAdminUsers, fetchAdminTags, fetchAdminSettings } = await import("@/lib/adminPanel");

    vi.mocked(me).mockResolvedValue({
      sub: "admin-1",
      email: "admin@example.com",
      role: "Admin",
      name: "Admin One",
    });
    vi.mocked(fetchAdminUsers).mockResolvedValue([
      {
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin One",
        role: "Admin",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "manager-1",
        email: "manager@example.com",
        name: "Manager One",
        role: "Manager",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "csr-1",
        email: "csr@example.com",
        name: "CSR One",
        role: "CSR",
        managerId: "manager-1",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(fetchAdminTags).mockResolvedValue([]);
    vi.mocked(fetchAdminSettings).mockResolvedValue({
      availabilityRefreshMinutes: 15,
      defaultCasePriority: "Medium",
      priorityStyleMap: {
        High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
        Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
        Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
      },
    });

    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Employee Workspace Accounts")).toBeInTheDocument();
      expect(screen.getByText("Admin Management")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Assigned Manager").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Promote to Admin" }).length).toBeGreaterThan(0);
  });

  it("shows only employee roles in the create employee form", async () => {
    const { me } = await import("@/lib/auth");
    const { fetchAdminUsers, fetchAdminTags, fetchAdminSettings } = await import("@/lib/adminPanel");

    vi.mocked(me).mockResolvedValue({
      sub: "admin-1",
      email: "admin@example.com",
      role: "Admin",
      name: "Admin One",
    });
    vi.mocked(fetchAdminUsers).mockResolvedValue([
      {
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin One",
        role: "Admin",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "manager-1",
        email: "manager@example.com",
        name: "Manager One",
        role: "Manager",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(fetchAdminTags).mockResolvedValue([]);
    vi.mocked(fetchAdminSettings).mockResolvedValue({
      availabilityRefreshMinutes: 15,
      defaultCasePriority: "Medium",
      priorityStyleMap: {
        High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
        Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
        Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
      },
    });

    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Employee Workspace Accounts")).toBeInTheDocument();
    });

    const createEmployeeButton = screen.getByRole("button", { name: "Create Employee" });
    const createEmployeeForm = createEmployeeButton.closest("form");
    if (!createEmployeeForm) {
      throw new Error("Create employee form not found.");
    }
    const createEmployeeScope = within(createEmployeeForm);

    fireEvent.mouseDown(createEmployeeScope.getByLabelText("Role"));
    const roleListbox = await screen.findByRole("listbox");
    const roleOptions = within(roleListbox).getAllByRole("option").map((option) => option.textContent?.trim());
    expect(roleOptions).toEqual(["CSR", "Manager", "Executive"]);
    expect(roleOptions).not.toContain("Admin");
    expect(roleOptions).not.toContain("Customer");
  });

  it("hides create-manager selector when create employee role is not CSR", async () => {
    const { me } = await import("@/lib/auth");
    const { fetchAdminUsers, fetchAdminTags, fetchAdminSettings } = await import("@/lib/adminPanel");

    vi.mocked(me).mockResolvedValue({
      sub: "admin-1",
      email: "admin@example.com",
      role: "Admin",
      name: "Admin One",
    });
    vi.mocked(fetchAdminUsers).mockResolvedValue([
      {
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin One",
        role: "Admin",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "manager-1",
        email: "manager@example.com",
        name: "Manager One",
        role: "Manager",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "csr-1",
        email: "csr@example.com",
        name: "CSR One",
        role: "CSR",
        managerId: "manager-1",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(fetchAdminTags).mockResolvedValue([]);
    vi.mocked(fetchAdminSettings).mockResolvedValue({
      availabilityRefreshMinutes: 15,
      defaultCasePriority: "Medium",
      priorityStyleMap: {
        High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
        Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
        Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
      },
    });

    render(<AdminWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create Employee" })).toBeInTheDocument();
    });

    const createEmployeeButton = screen.getByRole("button", { name: "Create Employee" });
    const createEmployeeForm = createEmployeeButton.closest("form");
    if (!createEmployeeForm) {
      throw new Error("Create employee form not found.");
    }
    const createEmployeeScope = within(createEmployeeForm);
    expect(createEmployeeScope.getByText("Assigned Manager")).toBeInTheDocument();

    fireEvent.mouseDown(createEmployeeScope.getByLabelText("Role"));
    const roleListbox = await screen.findByRole("listbox");
    fireEvent.click(within(roleListbox).getByRole("option", { name: "Manager" }));

    expect(createEmployeeScope.queryByText("Assigned Manager")).not.toBeInTheDocument();
  });
});
