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

const defaultSettings = {
  availabilityRefreshMinutes: 15,
  defaultCasePriority: "Medium" as const,
  priorityStyleMap: {
    High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
    Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
    Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
  },
};

async function renderWorkspaceWithUsers(
  users: Array<{
    id: string;
    email: string;
    name?: string;
    role: "Admin" | "Manager" | "Executive" | "CSR" | "Customer";
    managerId: string | null;
    createdAt: string;
  }>,
) {
  const { me } = await import("@/lib/auth");
  const { fetchAdminUsers, fetchAdminTags, fetchAdminSettings } = await import("@/lib/adminPanel");

  vi.mocked(me).mockResolvedValue({
    sub: "admin-1",
    email: "admin@example.com",
    role: "Admin",
    name: "Admin One",
  });
  vi.mocked(fetchAdminUsers).mockResolvedValue(users);
  vi.mocked(fetchAdminTags).mockResolvedValue([]);
  vi.mocked(fetchAdminSettings).mockResolvedValue(defaultSettings);

  render(<AdminWorkspace />);
  await waitFor(() => {
    expect(screen.getByText("Employee Workspace Accounts")).toBeInTheDocument();
  });
}

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

  it("requires manager assignment when creating CSR accounts", async () => {
    await renderWorkspaceWithUsers([
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
    const { createAdminUser } = await import("@/lib/adminPanel");

    const createEmployeeButton = screen.getByRole("button", { name: "Create Employee" });
    const createEmployeeForm = createEmployeeButton.closest("form");
    if (!createEmployeeForm) {
      throw new Error("Create employee form not found.");
    }
    const createEmployeeScope = within(createEmployeeForm);
    const employeeInputs = createEmployeeForm.querySelectorAll("input");
    if (employeeInputs.length < 2) {
      throw new Error("Expected employee create form inputs were not found.");
    }
    fireEvent.change(employeeInputs[0], { target: { value: "csr2@example.com" } });
    fireEvent.change(employeeInputs[1], { target: { value: "TreeCRM123!" } });
    fireEvent.click(createEmployeeButton);

    await waitFor(() => {
      expect(createAdminUser).not.toHaveBeenCalled();
    });
  });

  it("creates admin accounts and supports promote-to-admin flow", async () => {
    await renderWorkspaceWithUsers([
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
    const { createAdminUser, updateAdminUser } = await import("@/lib/adminPanel");
    vi.mocked(createAdminUser).mockResolvedValue(undefined);
    vi.mocked(updateAdminUser).mockResolvedValue(undefined);

    const createAdminButton = screen.getByRole("button", { name: "Create Admin" });
    const createAdminForm = createAdminButton.closest("form");
    if (!createAdminForm) {
      throw new Error("Create admin form not found.");
    }
    const adminInputs = createAdminForm.querySelectorAll("input");
    if (adminInputs.length < 3) {
      throw new Error("Expected admin create form inputs were not found.");
    }
    fireEvent.change(adminInputs[0], { target: { value: "admin2@example.com" } });
    fireEvent.change(adminInputs[1], { target: { value: "TreeCRM123!" } });
    fireEvent.change(adminInputs[2], { target: { value: "Admin Two" } });
    fireEvent.click(createAdminButton);

    await waitFor(() => {
      expect(createAdminUser).toHaveBeenCalledWith(
        "token-1",
        expect.objectContaining({
          email: "admin2@example.com",
          password: "TreeCRM123!",
          role: "Admin",
          name: "Admin Two",
          managerId: null,
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Promote to Admin" }));
    await waitFor(() => {
      expect(updateAdminUser).toHaveBeenCalledWith("token-1", "manager-1", {
        role: "Admin",
        managerId: null,
      });
    });
  });

  it("shows self-lockout controls and surfaces backend guardrail errors", async () => {
    await renderWorkspaceWithUsers([
      {
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin One",
        role: "Admin",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "admin-2",
        email: "admin2@example.com",
        name: "Admin Two",
        role: "Admin",
        managerId: null,
        createdAt: "2026-03-02T00:00:00.000Z",
      },
    ]);
    const { deleteAdminUser } = await import("@/lib/adminPanel");
    vi.mocked(deleteAdminUser).mockRejectedValue(new Error("Cannot delete the last remaining Admin account."));

    const roleComboboxes = screen.getAllByRole("combobox", { name: "Role" });
    fireEvent.mouseDown(roleComboboxes[1]);
    const roleListbox = await screen.findByRole("listbox");
    fireEvent.click(within(roleListbox).getByRole("option", { name: "Manager" }));

    expect(screen.getByText("You cannot demote your own admin account.")).toBeInTheDocument();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[0]).toBeDisabled();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons[0]).toBeDisabled();
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(screen.getByText("Cannot delete the last remaining Admin account.")).toBeInTheDocument();
    });
  });
});
