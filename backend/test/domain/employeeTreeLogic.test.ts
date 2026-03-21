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

  it("covers dropped cases and empty rating aggregation", () => {
    const threshold = getStartOfUtcDayEpoch(new Date("2026-03-08T12:00:00.000Z"));
    const metrics = buildPerformanceMetrics(
      [
        {
          id: "case-3",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "Dropped",
          description: "Dropped",
          status: "Dropped",
          priority: "Low",
          customer_satisfaction_rating: 3,
          created_at: "2026-03-07T00:00:00.000Z",
          updated_at: "2026-03-07T01:00:00.000Z",
        },
      ],
      threshold,
    );

    expect(metrics).toMatchObject({
      ongoingCases: 0,
      resolvedToday: 0,
      resolvedCases: 0,
      droppedCases: 1,
      totalCases: 1,
      customerSatisfaction: 60,
    });
    expect(aggregatePerformanceMetrics([])).toMatchObject({
      customerSatisfaction: null,
      totalCases: 0,
    });
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

  it("covers explicit manager assignments and validation errors", () => {
    expect(parseCasePatchBody(null)).toEqual({
      error: "Request body must be a JSON object.",
    });
    expect(parseCasePatchBody({})).toEqual({
      error: "Provide at least one of: status, priority.",
    });
    expect(parseCasePatchBody({ priority: "Urgent" })).toEqual({
      error: "priority must be one of: High, Medium, Low.",
    });
    expect(
      parseCaseReassignBody({
        assigneeId: "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47",
        reason: null,
      }),
    ).toEqual({
      data: {
        assigneeId: "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47",
      },
    });
    expect(
      parseCaseReassignBody({
        assigneeId: "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47",
        reason: "x".repeat(401),
      }),
    ).toEqual({
      error: "reason must be at most 400 characters.",
    });
    expect(parseTagUpdateBody({ tagIds: ["bad"] })).toEqual({
      error: "All tagIds must be valid UUID strings.",
    });
    expect(
      parseTagUpdateBody({
        tagIds: ["0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47"],
        customTagNames: Array.from({ length: 11 }, (_, index) => `Tag ${index}`),
      }),
    ).toEqual({
      error: "customTagNames cannot contain more than 10 entries.",
    });
    expect(
      buildManagerCsrAssignments(
        [
          {
            id: "manager-a",
            email: "a@example.com",
            name: "Manager A",
            role: "Manager",
            manager_id: null,
            created_at: "2026-03-08T00:00:00.000Z",
          },
        ],
        [
          {
            id: "csr-explicit",
            email: "explicit@example.com",
            name: "CSR Explicit",
            role: "CSR",
            manager_id: "manager-a",
            created_at: "2026-03-08T00:00:00.000Z",
          },
          {
            id: "csr-unassigned",
            email: "unassigned@example.com",
            name: "CSR Unassigned",
            role: "CSR",
            manager_id: null,
            created_at: "2026-03-08T00:00:00.000Z",
          },
        ],
        new Map(),
      ),
    ).toMatchObject({
      mode: "manager_assignment",
      unassignedCsrIds: ["csr-unassigned"],
    });
    expect(
      buildManagerCsrAssignments(
        [],
        [
          {
            id: "csr-alone",
            email: "alone@example.com",
            name: "CSR Alone",
            role: "CSR",
            manager_id: null,
            created_at: "2026-03-08T00:00:00.000Z",
          },
        ],
        new Map(),
      ),
    ).toMatchObject({
      mode: "none",
      unassignedCsrIds: ["csr-alone"],
    });
    expect(
      canAccessCase(
        { role: "Manager", sub: "manager-1" },
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
  });

  it("validates case, endorsement, and tag update bodies", () => {
    expect(parseCasePatchBody({ status: "In Progress" })).toEqual({
      data: { status: "In Progress" },
    });
    expect(parseCasePatchBody({ priority: "Low" })).toEqual({
      data: { priority: "Low" },
    });
    expect(parseCasePatchBody({ status: "Open", priority: "High" })).toEqual({
      data: { status: "Open", priority: "High" },
    });
    expect(parseEndorseCaseBody({ endorsedToId: "bad" })).toEqual({
      error: "endorsedToId must be a valid UUID.",
    });
    expect(parseEndorsementDecisionBody({ status: "Accepted" })).toEqual({
      data: { status: "Accepted" },
    });
    expect(parseEndorsementDecisionBody("nope")).toEqual({
      error: "Request body must be a JSON object.",
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
    expect(parseTagUpdateBody({ tagIds: "nope" })).toEqual({
      error: "tagIds must be an array of UUID strings.",
    });
    expect(
      parseTagUpdateBody({
        tagIds: ["0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47"],
        customTagNames: "nope",
      }),
    ).toEqual({
      error: "customTagNames must be an array of tag names when provided.",
    });
    expect(
      parseTagUpdateBody({
        tagIds: ["0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47"],
        customTagNames: [" x "],
      }),
    ).toEqual({
      error: "Each custom tag name must be 2-40 characters after trimming.",
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
