import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:4000";

test("customer login redirect, portal flow, and footer visibility", async ({ page }) => {
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/health") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          service: "treecrm-backend",
          timestamp: "2026-03-08T00:00:00.000Z",
        }),
      });
      return;
    }

    if (url.endsWith("/auth/login") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          message: "Login succeeded.",
          token: "customer-token",
          user: {
            id: "customer-1",
            email: "customer@example.com",
            role: "Customer",
          },
        }),
      });
      return;
    }

    if (url.endsWith("/auth/me") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          user: {
            sub: "customer-1",
            email: "customer@example.com",
            role: "Customer",
            name: "Customer One",
          },
        }),
      });
      return;
    }

    if (url.endsWith("/portal/tickets") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            customer: {
              id: "customer-1",
              company: "Acme Corp",
            },
            tickets: [
              {
                id: "ticket-1",
                subject: "Internet issue",
                status: "Open",
                priority: "High",
                category: "Technical Issue",
                attachmentCount: 0,
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
      });
      return;
    }

    if (url.endsWith("/portal/tickets") && method === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            ticket: {
              id: "ticket-created",
              subject: "Created ticket",
              status: "Open",
              priority: "Medium",
              category: "General Inquiry",
              attachmentCount: 2,
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
          },
        }),
      });
      return;
    }

    if (url.endsWith("/portal/tickets/ticket-created") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            ticket: {
              id: "ticket-created",
              subject: "Created ticket",
              status: "Open",
              priority: "Medium",
              category: "General Inquiry",
              attachmentCount: 2,
              description: "Need help",
              attachments: ["first.txt", "second.txt"],
              createdAt: "2026-03-08T00:00:00.000Z",
              updatedAt: "2026-03-08T01:00:00.000Z",
              customerSatisfactionRating: null,
              customerSatisfactionSubmittedAt: null,
              canSubmitCustomerSatisfaction: false,
              assignedEmployee: {
                id: "csr-1",
                name: "CSR One",
                email: "csr@example.com",
                role: "CSR",
              },
            },
            timeline: [
              {
                id: "created:ticket-created",
                type: "created",
                label: "Ticket created",
                createdAt: "2026-03-08T00:00:00.000Z",
              },
            ],
            messages: [],
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

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Why teams switch to TreeCRM" })).toBeVisible();

  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill("customer@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: "Login" }).nth(1).click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Create ticket", exact: true }).click();
  await page.getByRole("textbox", { name: /subject/i }).fill("Created ticket");
  await page.getByRole("textbox", { name: /description/i }).fill("Need help");
  await page.getByRole("textbox", { name: /attachments \(one per line\)/i }).fill("first.txt\nsecond.txt");
  await page.getByRole("button", { name: "Create ticket" }).last().click();

  await expect(page).toHaveURL(/\/portal\/ticket-created$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Conversation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ticket details" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to tickets" })).toBeVisible();
});
