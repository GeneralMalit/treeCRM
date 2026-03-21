import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  mapTicketSummary,
  normalizeAttachmentList,
  parseAttachments,
  parseCustomerSatisfactionBody,
  parseCreateMessageBody,
  parseStringField,
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

  it("covers additional ticket and timeline validation branches", () => {
    expect(parseAttachments(null)).toEqual({ data: [] });
    expect(parseAttachments(["a", "b"])).toEqual({ data: ["a", "b"] });
    expect(parseTicketCreateBody("nope")).toEqual({
      error: "Request body must be a JSON object.",
    });
    expect(parseCustomerSatisfactionBody({ rating: "bad" })).toEqual({
      error: "rating must be a number between 1 and 5.",
    });

    const openTicket = {
      id: "case-2",
      customer_id: "customer-1",
      assigned_to: null,
      title: "Billing question",
      description: "Body",
      status: "Open" as const,
      priority: "Medium" as const,
      category: "Billing",
      attachments: [],
      customer_satisfaction_rating: null,
      customer_satisfaction_submitted_at: null,
      created_at: "2026-03-08T00:00:00.000Z",
      updated_at: "2026-03-08T01:00:00.000Z",
    };

    expect(buildTimeline(openTicket, [])).toEqual([
      {
        id: "created:case-2",
        type: "created",
        label: "Ticket created",
        createdAt: "2026-03-08T00:00:00.000Z",
      },
      {
        id: "status:case-2",
        type: "status",
        label: "Status updated to Open",
        createdAt: "2026-03-08T01:00:00.000Z",
      },
    ]);
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

  it("covers direct string, attachment, and message parsing edge cases", () => {
    expect(parseStringField(undefined, "subject")).toEqual({
      error: "subject is required.",
    });
    expect(parseStringField(undefined, "subject", { required: false })).toEqual({
      data: undefined,
    });
    expect(parseStringField(123, "subject")).toEqual({
      error: "subject must be a string.",
    });
    expect(parseStringField("   ", "subject")).toEqual({
      error: "subject cannot be empty.",
    });
    expect(parseStringField("12345", "subject", { maxLength: 4 })).toEqual({
      error: "subject must be at most 4 characters.",
    });
    expect(parseAttachments("nope")).toEqual({
      error: "attachments must be an array of non-empty strings.",
    });
    expect(parseAttachments(Array.from({ length: 11 }, () => "file.txt"))).toEqual({
      error: "attachments may contain at most 10 items.",
    });
    expect(parseCreateMessageBody({ messageText: "x".repeat(4001) })).toEqual({
      error: "messageText must be at most 4000 characters.",
    });
    expect(parseCustomerSatisfactionBody(null)).toEqual({
      error: "Request body must be a JSON object.",
    });
    expect(parseCustomerSatisfactionBody({ rating: Number.NaN })).toEqual({
      error: "rating must be a number between 1 and 5.",
    });
    expect(normalizeAttachmentList("nope")).toEqual([]);
    expect(normalizeAttachmentList([" a ", 1, "b", " "])).toEqual(["a", "b"]);
  });
});
