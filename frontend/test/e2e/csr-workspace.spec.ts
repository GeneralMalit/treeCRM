import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:4000";

test("csr workspace loads tree data and case details", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("treecrm_access_token", "csr-token");
  });

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/auth/me") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          user: {
            sub: "csr-1",
            email: "csr@example.com",
            role: "CSR",
            name: "CSR One",
          },
        }),
      });
      return;
    }

    if (url.endsWith("/employee/tree") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
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
              customers: [
                {
                  id: "customer-1",
                  userId: "customer-user",
                  company: "Acme Corp",
                  contactInfo: {
                    email: "customer@example.com",
                  },
                  createdAt: "2026-03-08T00:00:00.000Z",
                  cases: [
                    {
                      id: "case-1",
                      title: "Internet issue",
                      description: "Need help",
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
          ],
        }),
      });
      return;
    }

    if (url.endsWith("/employee/cases/case-1/manage") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            case: {
              id: "case-1",
              customerId: "customer-1",
              assignedTo: "csr-1",
              title: "Internet issue",
              description: "Need help",
              status: "Open",
              priority: "High",
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T01:00:00.000Z",
            },
            tags: [
              {
                id: "tag-1",
                name: "VIP",
                color: "#10b981",
                affectsNodeColor: true,
                selected: false,
              },
            ],
            internalNotes: [
              {
                id: "note-1",
                senderId: "csr-1",
                senderRole: "CSR",
                messageText: "Case opened for follow-up.",
                createdAt: "2026-03-08T01:15:00.000Z",
              },
            ],
          },
        }),
      });
      return;
    }

    if (url.endsWith("/employee/cases/case-1/workflow") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            case: {
              id: "case-1",
              customerId: "customer-1",
              assignedTo: "csr-1",
              title: "Internet issue",
              description: "Need help",
              status: "Open",
              priority: "High",
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T01:00:00.000Z",
              hasPendingEndorsement: true,
              pendingEndorsementCount: 1,
              assignedToUser: {
                id: "csr-1",
                name: "CSR One",
                email: "csr@example.com",
                role: "CSR",
              },
            },
            endorsements: [
              {
                id: "endorsement-1",
                caseId: "case-1",
                status: "Pending",
                createdAt: "2026-03-08T01:10:00.000Z",
                endorsedBy: {
                  id: "csr-1",
                  name: "CSR One",
                  email: "csr@example.com",
                  role: "CSR",
                },
                endorsedTo: {
                  id: "manager-1",
                  name: "Manager One",
                  email: "manager@example.com",
                  role: "Manager",
                },
                isPendingForViewer: true,
              },
            ],
            endorsementTargets: [
              {
                id: "manager-1",
                name: "Manager One",
                email: "manager@example.com",
                role: "Manager",
              },
            ],
            reassignmentCandidates: [
              {
                id: "csr-1",
                name: "CSR One",
                email: "csr@example.com",
                role: "CSR",
              },
            ],
          },
        }),
      });
      return;
    }

    if (url.endsWith("/employee/cases/case-1/messages") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            messages: [],
          },
        }),
      });
      return;
    }

    if (url.endsWith("/employee/internal-chat/contacts") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            contacts: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ status: "error", message: `Unhandled route: ${method} ${url}` }),
    });
  });

  await page.goto("/employee/csr");
  await expect(page.getByText("CSR Workspace")).toBeVisible();
  await expect(page.getByText("Customer Name: Acme Corp")).toBeVisible();
  await expect(page.getByText("Case Reference: Internet issue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect(page.getByText("/employee/csr")).toHaveCount(0);
});
