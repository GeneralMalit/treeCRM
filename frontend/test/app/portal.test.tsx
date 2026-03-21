import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortalPage from "@/app/portal/page";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    push,
  }),
}));

vi.mock("@/lib/auth", () => ({
  clearStoredAccessToken: vi.fn(),
  getLandingRoute: vi.fn(() => "/employee/csr"),
  getStoredAccessToken: vi.fn(() => "token-1"),
  logout: vi.fn().mockResolvedValue(undefined),
  me: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  disconnectRealtimeSocket: vi.fn(),
}));

vi.mock("@/lib/customerPortal", () => ({
  createPortalTicket: vi.fn(),
  fetchPortalTickets: vi.fn(),
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  push.mockReset();
});

describe("PortalPage", () => {
  it("loads, sorts, refreshes, and creates tickets", async () => {
    const { me } = await import("@/lib/auth");
    const { createPortalTicket, fetchPortalTickets } = await import("@/lib/customerPortal");

    vi.mocked(me).mockResolvedValue({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer One",
    });
    const dashboard = {
      customer: { id: "customer-1", company: "Acme" },
      tickets: [
        {
          id: "ticket-older",
          subject: "Older",
          status: "Open",
          priority: "Low",
          category: "General",
          attachmentCount: 0,
          customerSatisfactionRating: null,
          customerSatisfactionSubmittedAt: null,
          canSubmitCustomerSatisfaction: false,
          createdAt: "2026-03-08T00:00:00.000Z",
          updatedAt: "2026-03-08T00:00:00.000Z",
          assignedEmployee: null,
        },
        {
          id: "ticket-newer",
          subject: "Newer",
          status: "Open",
          priority: "High",
          category: "General",
          attachmentCount: 0,
          customerSatisfactionRating: null,
          customerSatisfactionSubmittedAt: null,
          canSubmitCustomerSatisfaction: false,
          createdAt: "2026-03-08T00:00:00.000Z",
          updatedAt: "2026-03-08T01:00:00.000Z",
          assignedEmployee: null,
        },
      ],
    };
    vi.mocked(fetchPortalTickets).mockResolvedValue(dashboard);
    vi.mocked(createPortalTicket).mockResolvedValue({ id: "ticket-created" });

    render(<PortalPage />);

    await waitFor(() => {
      expect(screen.getByText("Newer")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Newer|Older/).map((node) => node.textContent)).toEqual(["Newer", "Older"]);

    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    const dialog = await screen.findByRole("dialog");
    const dialogScope = within(dialog);

    fireEvent.change(dialogScope.getByRole("textbox", { name: /subject/i }), {
      target: { value: "Created ticket" },
    });
    fireEvent.change(dialogScope.getByRole("textbox", { name: /description/i }), {
      target: { value: "Need help" },
    });
    fireEvent.change(dialogScope.getByRole("textbox", { name: /attachments \(one per line\)/i }), {
      target: { value: "first.txt\nsecond.txt" },
    });
    fireEvent.click(dialogScope.getByRole("button", { name: "Create ticket" }));

    await waitFor(() => {
      expect(createPortalTicket).toHaveBeenCalledWith("token-1", expect.objectContaining({
        attachments: ["first.txt", "second.txt"],
      }));
      expect(push).toHaveBeenCalledWith("/portal/ticket-created");
    });
  }, 10_000);

  it("redirects guests to login and non-customers to their landing route", async () => {
    const { getStoredAccessToken, me } = await import("@/lib/auth");

    vi.mocked(getStoredAccessToken).mockReturnValueOnce(null).mockReturnValueOnce("token-1");
    vi.mocked(me).mockResolvedValueOnce({
      sub: "manager-1",
      email: "manager@example.com",
      role: "Manager",
      name: "Manager One",
    });

    render(<PortalPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login");
    });

    render(<PortalPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/employee/csr");
    });
  });

  it("shows an error state when ticket loading fails", async () => {
    const { me } = await import("@/lib/auth");
    const { fetchPortalTickets } = await import("@/lib/customerPortal");

    vi.mocked(me).mockResolvedValue({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer One",
    });
    vi.mocked(fetchPortalTickets).mockRejectedValue(new Error("Could not load tickets."));

    render(<PortalPage />);

    await waitFor(() => {
      expect(screen.getByText("Could not load tickets.")).toBeInTheDocument();
    });
  });

  it("redirects to login when there is no stored token", async () => {
    const { getStoredAccessToken } = await import("@/lib/auth");

    vi.mocked(getStoredAccessToken).mockReturnValueOnce(null);

    render(<PortalPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });

  it("surfaces refresh failures", async () => {
    const { me } = await import("@/lib/auth");
    const { fetchPortalTickets } = await import("@/lib/customerPortal");

    vi.mocked(me).mockResolvedValue({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer One",
    });
    let fetchCount = 0;
    vi.mocked(fetchPortalTickets).mockImplementation(async () => {
      fetchCount += 1;
      if (fetchCount <= 2) {
        return {
          customer: { id: "customer-1", company: "Acme" },
          tickets: [],
        };
      }

      throw new Error("Refresh failed");
    });

    render(<PortalPage />);

    await waitFor(() => {
      expect(screen.getByText("No tickets yet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getAllByText("Refresh failed").length).toBeGreaterThan(0);
    });
  });

  it("surfaces create failures", async () => {
    const { me } = await import("@/lib/auth");
    const { createPortalTicket, fetchPortalTickets } = await import("@/lib/customerPortal");

    vi.mocked(me).mockResolvedValue({
      sub: "customer-1",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer One",
    });
    vi.mocked(fetchPortalTickets).mockResolvedValue({
      customer: { id: "customer-1", company: "Acme" },
      tickets: [],
    });
    vi.mocked(createPortalTicket).mockRejectedValueOnce(new Error("Create failed"));

    render(<PortalPage />);

    await waitFor(() => {
      expect(screen.getByText("No tickets yet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Create ticket" })[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    const dialogScope = within(dialog);
    fireEvent.change(dialogScope.getByRole("textbox", { name: /subject/i }), {
      target: { value: "Created ticket" },
    });
    fireEvent.change(dialogScope.getByRole("textbox", { name: /description/i }), {
      target: { value: "Need help" },
    });
    fireEvent.click(dialogScope.getByRole("button", { name: "Create ticket" }));

    await waitFor(() => {
      expect(screen.getByText("Create failed")).toBeInTheDocument();
    });
  });
});
