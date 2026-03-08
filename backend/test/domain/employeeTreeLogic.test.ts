import { describe, expect, it } from "vitest";
import {
  aggregatePerformanceMetrics,
  buildManagerCsrAssignments,
  buildPerformanceMetrics,
  canAccessCase,
  getStartOfUtcDayEpoch,
  normalizeTagName,
  parseCasePatchBody,
  parseCaseReassignBody,
  parseEndorseCaseBody,
  parseEndorsementDecisionBody,
  parseTagUpdateBody,
} from "../../src/domain/employeeTreeLogic";

describe("employeeTreeLogic", () => {
  it("builds and aggregates performance metrics", () => {
    const threshold = getStartOfUtcDayEpoch(new Date("2026-03-08T12:00:00.000Z"));
    const metrics = buildPerformanceMetrics(
      [
        {
          id: "case-1",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "A",
          description: "A",
          status: "Resolved",
          priority: "High",
          customer_satisfaction_rating: 5,
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T01:00:00.000Z",
        },
        {
          id: "case-2",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "B",
          description: "B",
          status: "Open",
          priority: "Medium",
          customer_satisfaction_rating: null,
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T02:00:00.000Z",
        },
      ],
      threshold,
    );

    expect(metrics).toMatchObject({
      ongoingCases: 1,
      resolvedToday: 1,
      resolvedCases: 1,
      totalCases: 2,
      customerSatisfaction: 100,
    });

    expect(aggregatePerformanceMetrics([metrics, metrics]).totalCases).toBe(4);
  });

  it("builds fallback manager assignments based on case load", () => {
    const result = buildManagerCsrAssignments(
      [
        {
          id: "manager-a",
          email: "a@example.com",
          name: "Manager A",
          role: "Manager",
          manager_id: null,
          created_at: "2026-03-08T00:00:00.000Z",
        },
        {
          id: "manager-b",
          email: "b@example.com",
          name: "Manager B",
          role: "Manager",
          manager_id: null,
          created_at: "2026-03-08T00:00:00.000Z",
        },
      ],
      [
        {
          id: "csr-high",
          email: "high@example.com",
          name: "CSR High",
          role: "CSR",
          manager_id: null,
          created_at: "2026-03-08T00:00:00.000Z",
        },
        {
          id: "csr-low",
          email: "low@example.com",
          name: "CSR Low",
          role: "CSR",
          manager_id: null,
          created_at: "2026-03-08T00:00:00.000Z",
        },
      ],
      new Map([
        ["csr-high", { ongoingCases: 0, resolvedToday: 0, customerSatisfaction: null, totalCases: 10, resolvedCases: 0, droppedCases: 0, completedCases: 0, ratedCaseCount: 0, ratingTotal: 0 }],
        ["csr-low", { ongoingCases: 0, resolvedToday: 0, customerSatisfaction: null, totalCases: 1, resolvedCases: 0, droppedCases: 0, completedCases: 0, ratedCaseCount: 0, ratingTotal: 0 }],
      ]),
    );

    expect(result.mode).toBe("derived_balanced_fallback");
    expect([...result.csrIdsByManagerId.values()].flat().sort()).toEqual(["csr-high", "csr-low"]);
    expect(result.unassignedCsrIds).toEqual([]);
  });

  it("validates case, endorsement, and tag update bodies", () => {
    expect(parseCasePatchBody({ status: "In Progress" })).toEqual({
      data: { status: "In Progress" },
    });
    expect(parseEndorseCaseBody({ endorsedToId: "bad" })).toEqual({
      error: "endorsedToId must be a valid UUID.",
    });
    expect(parseEndorsementDecisionBody({ status: "Accepted" })).toEqual({
      data: { status: "Accepted" },
    });
    expect(
      parseCaseReassignBody({
        assigneeId: "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47",
        reason: "  load balance ",
      }),
    ).toEqual({
      data: {
        assigneeId: "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47",
        reason: "load balance",
      },
    });
    expect(normalizeTagName("  VIP   Customer ")).toBe("VIP Customer");
    expect(
      parseTagUpdateBody({
        tagIds: ["0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47", "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47"],
        customTagNames: [" VIP ", "vip", " Escalated "],
      }),
    ).toEqual({
      data: {
        tagIds: ["0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47"],
        customTagNames: ["VIP", "Escalated"],
      },
    });
  });

  it("enforces csr-only case access on assigned cases", () => {
    expect(
      canAccessCase(
        { role: "CSR", sub: "csr-1" },
        {
          id: "case-1",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "A",
          description: "A",
          status: "Open",
          priority: "High",
          customer_satisfaction_rating: null,
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T00:00:00.000Z",
        },
      ),
    ).toBe(true);

    expect(
      canAccessCase(
        { role: "CSR", sub: "csr-2" },
        {
          id: "case-1",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "A",
          description: "A",
          status: "Open",
          priority: "High",
          customer_satisfaction_rating: null,
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T00:00:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
