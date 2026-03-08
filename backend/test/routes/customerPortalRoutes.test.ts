import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

async function loadCustomerPortalRouter() {
  const createNotification = vi.fn().mockResolvedValue(null);
  const emitCaseChatMessage = vi.fn();

  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: { jwtSecret: "test-secret" },
    hasJwtSecret: true,
  }));
  vi.doMock("../../src/services/supabaseClient", () => ({
    hasSupabaseAdmin: true,
    supabaseAdmin: createSupabaseAdminMock({
      customers: {
        maybeSingle: ok({
          id: "customer-1",
          user_id: "customer-user",
          company: "Acme",
          contact_info: { email: "customer@example.com" },
          created_at: "2026-03-08T00:00:00.000Z",
        }),
      },
      cases: {
        maybeSingle: ok({
          id: "case-1",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "Internet issue",
          description: "Body",
          status: "Open",
          priority: "High",
          category: "Technical",
          attachments: [],
          customer_satisfaction_rating: null,
          customer_satisfaction_submitted_at: null,
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T00:00:00.000Z",
        }),
        update: ok([]),
      },
      messages: {
        single: ok({
          id: "msg-1",
          case_id: "case-1",
          sender_id: "customer-user",
          sender_role: "Customer",
          message_type: "text",
          message_text: "Need help",
          created_at: "2026-03-08T01:00:00.000Z",
        }),
      },
    }),
  }));
  vi.doMock("../../src/services/notificationService", () => ({
    createNotification,
  }));
  vi.doMock("../../src/services/realtime", () => ({
    emitCaseChatMessage,
  }));
  vi.doMock("../../src/services/systemSettings", () => ({
    getSystemSettings: vi.fn(),
  }));

  const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
  return {
    app: createRouterApp(customerPortalRouter),
    createNotification,
    emitCaseChatMessage,
  };
}

describe("customerPortalRoutes", () => {
  it("validates customer message requests and triggers collaborators on success", async () => {
    const { app, createNotification, emitCaseChatMessage } = await loadCustomerPortalRouter();
    const token = signTestJwt({
      sub: "customer-user",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer User",
    });

    const invalidResponse = await request(app)
      .post("/portal/tickets/not-a-uuid/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Hello" });
    expect(invalidResponse.status).toBe(400);

    const response = await request(app)
      .post("/portal/tickets/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Need help" });

    expect(response.status).toBe(201);
    expect(emitCaseChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "case-1",
        messageText: "Need help",
        isCustomer: true,
      }),
    );
    expect(createNotification).toHaveBeenCalledWith({
      userId: "csr-1",
      type: "case_message",
      message: 'New customer message on "Internet issue".',
    });
  });
});
