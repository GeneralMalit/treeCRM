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
});
