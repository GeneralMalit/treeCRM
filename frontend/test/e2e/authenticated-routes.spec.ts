import { expect, test } from "@playwright/test";

const ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/tags",
  "/admin/settings",
  "/employee/csr",
  "/employee/csr/workspace",
  "/employee/csr/messages",
  "/employee/manager",
  "/employee/manager/overview",
  "/employee/manager/workspace",
  "/employee/manager/messages",
  "/employee/executive",
  "/employee/executive/overview",
  "/employee/executive/workspace",
  "/employee/executive/messages",
  "/portal",
  "/portal/sample-ticket",
];

test("authenticated routes resolve without 404s", async ({ page }) => {
  for (const route of ROUTES) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} should resolve to a real page`).toBe(200);
  }
});
