import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPortalTicket,
  fetchPortalTicketDetail,
  fetchPortalTickets,
  postPortalTicketMessage,
  submitPortalTicketCustomerSatisfaction,
} from "@/lib/customerPortal";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("customerPortal client", () => {
  it("parses dashboard, ticket detail, message, and satisfaction payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          data: {
            customer: { id: "customer-1", company: "Acme" },
            tickets: [
              {
                id: "ticket-1",
                subject: "Need help",
                status: "Open",
                priority: "High",
                category: "General",
                attachmentCount: 1,
                customerSatisfactionRating: null,
                customerSatisfactionSubmittedAt: null,
                canSubmitCustomerSatisfaction: false,
                createdAt: "2026-03-08T00:00:00.000Z",
                updatedAt: "2026-03-08T01:00:00.000Z",
                assignedEmployee: {
                  id: "csr-1",
                  name: "CSR One",
                  email: "csr@example.com",
                  role: "CSR",
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          data: {
            ticket: {
              id: "ticket-1",
              subject: "Need help",
              status: "Resolved",
              priority: "Medium",
              category: "General",
              attachmentCount: 1,
              customerSatisfactionRating: 5,
              customerSatisfactionSubmittedAt: "2026-03-08T02:00:00.000Z",
              canSubmitCustomerSatisfaction: false,
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T02:00:00.000Z",
              assignedEmployee: null,
              description: "Need help",
              attachments: ["a.pdf", " ", 1],
            },
            timeline: [
              { id: "created:1", type: "created", label: "Ticket created", createdAt: "2026-03-08T00:00:00.000Z" },
              { id: "status:1", type: "status", label: "Assigned", createdAt: "2026-03-08T01:00:00.000Z" },
              { id: "system:1", type: "system", label: "System note", createdAt: "2026-03-08T02:00:00.000Z" },
            ],
            messages: [
              {
                id: "message-1",
                senderId: "customer-1",
                senderRole: "Customer",
                senderName: "Customer One",
                messageText: "Thanks",
                createdAt: "2026-03-08T01:00:00.000Z",
                isCustomer: true,
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          data: {
            ticket: {
              id: "ticket-2",
              subject: "Created ticket",
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
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          data: {
            message: {
              id: "message-2",
              senderId: null,
              senderRole: "Customer",
              senderName: "Customer One",
              messageText: "Hello",
              createdAt: "2026-03-08T03:00:00.000Z",
              isCustomer: true,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          data: {
            ticketId: "ticket-1",
            rating: 5,
            submittedAt: "2026-03-08T04:00:00.000Z",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPortalTickets("token-1")).resolves.toMatchObject({
      customer: { id: "customer-1", company: "Acme" },
      tickets: [{ assignedEmployee: { id: "csr-1", role: "CSR" } }],
    });

    await expect(fetchPortalTicketDetail("token-1", "ticket-1")).resolves.toMatchObject({
      ticket: {
        id: "ticket-1",
        description: "Need help",
        attachments: ["a.pdf"],
      },
      timeline: [
        { id: "created:1" },
        { id: "status:1" },
        { id: "system:1" },
      ],
      messages: [{ id: "message-1", isCustomer: true }],
    });

    await expect(createPortalTicket("token-1", {
      subject: "Created ticket",
      description: "Body",
      category: "General",
      attachments: [],
    })).resolves.toMatchObject({ id: "ticket-2", priority: "Low" });

    await expect(postPortalTicketMessage("token-1", "ticket-1", "Hello")).resolves.toMatchObject({
      id: "message-2",
      isCustomer: true,
    });

    await expect(submitPortalTicketCustomerSatisfaction("token-1", "ticket-1", 4.2)).resolves.toMatchObject({
      ticketId: "ticket-1",
      rating: 5,
    });
  });

  it("surfaces malformed portal payloads and request failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Forbidden" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ok", data: { customer: { id: "customer-1", company: "Acme" }, tickets: [{ id: "ticket-1" }] } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Create failed" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Message failed" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Satisfaction failed" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Unused" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPortalTickets("token-1")).rejects.toThrow("Forbidden");
    await expect(fetchPortalTicketDetail("token-1", "ticket-1")).rejects.toThrow(
      "Unexpected ticket detail response format.",
    );
    await expect(createPortalTicket("token-1", {
      subject: "Created ticket",
      description: "Body",
      category: "General",
      attachments: [],
    })).rejects.toThrow("Create failed");
    await expect(postPortalTicketMessage("token-1", "ticket-1", "Hello")).rejects.toThrow("Message failed");
    await expect(submitPortalTicketCustomerSatisfaction("token-1", "ticket-1", 4)).rejects.toThrow("Satisfaction failed");
  });
});
