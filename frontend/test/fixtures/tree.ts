import type { EmployeeTreeEmployee, EmployeeTreeScope } from "@/lib/employeeTree";

export const employeeTreeScope: EmployeeTreeScope = {
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
};

export const employeeTreeEmployees: EmployeeTreeEmployee[] = [
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
            title: "Internet issue",
            description: "Internet is down",
            status: "Open",
            priority: "High",
            createdAt: "2026-03-08T00:00:00.000Z",
            updatedAt: "2026-03-08T01:00:00.000Z",
            hasPendingEndorsement: false,
            pendingEndorsementCount: 0,
          },
        ],
      },
    ],
  },
];
