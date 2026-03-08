import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  mapTicketSummary,
  parseAttachments,
  parseCustomerSatisfactionBody,
  parseTicketCreateBody,
} from "../../src/domain/customerPortalLogic";

describe("customerPortalLogic", () => {
  it("validates ticket creation and attachments", () => {
    expect(parseAttachments(["a", " ", 1])).toEqual({
      error: "attachments must only contain non-empty string values.",
    });
    expect(parseTicketCreateBody({ subject: "Test", description: "Body", category: "General", attachments: ["a"] }))
      .toEqual({
        data: {
          subject: "Test",
          description: "Body",
          category: "General",
          attachments: ["a"],
        },
      });
  });

  it("validates csat ratings", () => {
    expect(parseCustomerSatisfactionBody({ rating: 6 })).toEqual({
      error: "rating must be between 1 and 5.",
    });
    expect(parseCustomerSatisfactionBody({ rating: 4.4 })).toEqual({
      data: { rating: 4 },
    });
  });

  it("maps ticket summaries and timeline events", () => {
    const ticket = {
      id: "case-1",
      customer_id: "customer-1",
      assigned_to: "csr-1",
      title: "Internet issue",
      description: "Body",
      status: "Resolved" as const,
      priority: "High" as const,
      category: "Technical",
      attachments: ["a.txt"],
      customer_satisfaction_rating: null,
      customer_satisfaction_submitted_at: null,
      created_at: "2026-03-08T00:00:00.000Z",
      updated_at: "2026-03-08T01:00:00.000Z",
    };

    expect(
      mapTicketSummary(ticket, {
        id: "csr-1",
        email: "csr@example.com",
        name: "CSR One",
        role: "CSR",
        created_at: "2026-03-08T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "case-1",
      subject: "Internet issue",
      attachmentCount: 1,
      canSubmitCustomerSatisfaction: true,
    });

    expect(
      buildTimeline(ticket, [
        {
          id: "msg-1",
          case_id: "case-1",
          sender_id: null,
          sender_role: "CSR",
          message_type: "system",
          message_text: "Status updated to Resolved",
          created_at: "2026-03-08T00:30:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "assigned:case-1",
        type: "status",
        label: "Assigned to a support agent",
        createdAt: "2026-03-08T00:00:00.000Z",
      },
      {
        id: "created:case-1",
        type: "created",
        label: "Ticket created",
        createdAt: "2026-03-08T00:00:00.000Z",
      },
      {
        id: "system:msg-1",
        type: "system",
        label: "Status updated to Resolved",
        createdAt: "2026-03-08T00:30:00.000Z",
      },
    ]);
  });
});
