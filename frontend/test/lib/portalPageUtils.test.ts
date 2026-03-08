import { describe, expect, it } from "vitest";
import { safeFormatDate, sortTicketsByLatest } from "@/lib/portalPageUtils";

describe("portalPageUtils", () => {
  it("formats valid dates and preserves invalid ones", () => {
    expect(safeFormatDate("bad-date")).toBe("bad-date");
    expect(safeFormatDate("2026-03-08T00:00:00.000Z")).toContain("2026");
  });

  it("sorts tickets by latest update first", () => {
    expect(
      sortTicketsByLatest([
        {
          id: "older",
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
          id: "newer",
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
      ]).map((ticket) => ticket.id),
    ).toEqual(["newer", "older"]);
  });
});
