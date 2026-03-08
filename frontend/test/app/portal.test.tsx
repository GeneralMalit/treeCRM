import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
      target: { value: "Created ticket" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /description/i }), {
      target: { value: "Need help" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /attachments \(one per line\)/i }), {
      target: { value: "first.txt\nsecond.txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    await waitFor(() => {
      expect(createPortalTicket).toHaveBeenCalledWith("token-1", expect.objectContaining({
        attachments: ["first.txt", "second.txt"],
      }));
      expect(push).toHaveBeenCalledWith("/portal/ticket-created");
    });
  });
});
