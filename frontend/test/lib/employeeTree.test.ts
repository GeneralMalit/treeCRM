import { describe, expect, it, vi } from "vitest";
import { fetchEmployeeTree } from "@/lib/employeeTree";

describe("employeeTree client", () => {
  it("rejects malformed payloads and parses valid ones", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: "Forbidden" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: "ok", scope: {}, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "ok",
            scope: {
              viewerId: "csr-1",
              viewerRole: "CSR",
              employeeCount: 1,
              customerCount: 1,
              caseCount: 1,
              metrics: {
                ongoingCases: 1,
                resolvedToday: 0,
                customerSatisfaction: null,
                totalCases: 1,
                resolvedCases: 0,
                droppedCases: 0,
                completedCases: 0,
              },
            },
            data: [
              {
                id: "csr-1",
                name: "CSR One",
                email: "csr@example.com",
                role: "CSR",
                managerId: null,
                createdAt: "2026-03-08T00:00:00.000Z",
                metrics: {
                  ongoingCases: 1,
                  resolvedToday: 0,
                  customerSatisfaction: null,
                  totalCases: 1,
                  resolvedCases: 0,
                  droppedCases: 0,
                  completedCases: 0,
                },
                customers: [],
              },
            ],
          }),
        }),
    );

    await expect(fetchEmployeeTree("token")).rejects.toThrow("Forbidden");
    await expect(fetchEmployeeTree("token")).rejects.toThrow("Unexpected tree scope payload.");
    await expect(fetchEmployeeTree("token")).resolves.toMatchObject({
      scope: { viewerId: "csr-1" },
      data: [{ id: "csr-1" }],
    });
  });

  it("parses team metrics, manager aggregates, and nested customer payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ok",
          scope: {
            viewerId: "mgr-1",
            viewerRole: "Manager",
            employeeCount: 2,
            customerCount: 1,
            caseCount: 2,
            metrics: {
              ongoingCases: 2,
              resolvedToday: 1,
              customerSatisfaction: 4.5,
              totalCases: 2,
              resolvedCases: 1,
              droppedCases: 0,
              completedCases: 1,
            },
            teamMetrics: {
              managerId: "mgr-1",
              csrCount: 1,
              allocationMode: "manager_assignment",
              metrics: {
                ongoingCases: 2,
                resolvedToday: 1,
                customerSatisfaction: 4.5,
                totalCases: 2,
                resolvedCases: 1,
                droppedCases: 0,
                completedCases: 1,
              },
            },
            managerAggregates: {
              allocationMode: "none",
              managerCount: 1,
              csrCount: 1,
              unassignedCsrCount: 0,
              metrics: {
                ongoingCases: 2,
                resolvedToday: 1,
                customerSatisfaction: 4.5,
                totalCases: 2,
                resolvedCases: 1,
                droppedCases: 0,
                completedCases: 1,
              },
              unassignedMetrics: {
                ongoingCases: 0,
                resolvedToday: 0,
                customerSatisfaction: null,
                totalCases: 0,
                resolvedCases: 0,
                droppedCases: 0,
                completedCases: 0,
              },
              managers: [
                {
                  managerId: "mgr-1",
                  managerName: "Manager One",
                  managerEmail: "mgr@example.com",
                  csrCount: 1,
                  metrics: {
                    ongoingCases: 2,
                    resolvedToday: 1,
                    customerSatisfaction: 4.5,
                    totalCases: 2,
                    resolvedCases: 1,
                    droppedCases: 0,
                    completedCases: 1,
                  },
                },
              ],
            },
          },
          data: [
            {
              id: "mgr-1",
              name: "Manager One",
              email: "mgr@example.com",
              role: "Manager",
              managerId: null,
              createdAt: "2026-03-08T00:00:00.000Z",
              metrics: {
                ongoingCases: 2,
                resolvedToday: 1,
                customerSatisfaction: 4.5,
                totalCases: 2,
                resolvedCases: 1,
                droppedCases: 0,
                completedCases: 1,
              },
              customers: [
                {
                  id: "customer-1",
                  userId: "customer-user",
                  company: "Acme Corp",
                  contactInfo: { email: "customer@example.com" },
                  createdAt: "2026-03-08T00:00:00.000Z",
                  cases: [
                    {
                      id: "case-1",
                      title: "Example",
                      description: "Example case",
                      status: "Resolved",
                      priority: "Low",
                      createdAt: "2026-03-08T00:00:00.000Z",
                      updatedAt: "2026-03-08T01:00:00.000Z",
                      hasPendingEndorsement: true,
                      pendingEndorsementCount: 1,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    );

    const result = await fetchEmployeeTree("token");
    expect(result.scope.teamMetrics?.managerId).toBe("mgr-1");
    expect(result.scope.managerAggregates?.managers[0].managerEmail).toBe("mgr@example.com");
    expect(result.data[0].customers[0].cases[0].status).toBe("Resolved");
  });

  it("rejects unexpected employee tree response shapes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: "error", data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: "ok", scope: {}, data: null }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => {
            throw new Error("broken json");
          },
        }),
    );

    await expect(fetchEmployeeTree("token")).rejects.toThrow("Unexpected employee tree response.");
    await expect(fetchEmployeeTree("token")).rejects.toThrow("Employee tree payload is missing.");
    await expect(fetchEmployeeTree("token")).rejects.toThrow("Failed to load employee tree.");
  });

  it("rejects malformed employee tree scope and employee payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "ok",
            scope: null,
            data: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "ok",
            scope: {
              viewerId: "csr-1",
              viewerRole: "CSR",
              employeeCount: 1,
              customerCount: 1,
              caseCount: 1,
              metrics: {
                ongoingCases: 1,
                resolvedToday: 0,
                customerSatisfaction: null,
                totalCases: 1,
                resolvedCases: 0,
                droppedCases: 0,
                completedCases: 0,
              },
            },
            data: [null],
          }),
        }),
    );

    await expect(fetchEmployeeTree("token")).rejects.toThrow("Unexpected tree scope format.");
    await expect(fetchEmployeeTree("token")).rejects.toThrow("Unexpected employee payload.");
  });
});
