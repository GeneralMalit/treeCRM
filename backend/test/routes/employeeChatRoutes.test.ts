import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

async function loadEmployeeChatRouter() {
  const createNotification = vi.fn().mockResolvedValue(null);
  const emitCaseChatMessage = vi.fn();
  const emitInternalChatMessage = vi.fn();

  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: { jwtSecret: "test-secret" },
    hasJwtSecret: true,
  }));
  vi.doMock("../../src/services/supabaseClient", () => ({
    hasSupabaseAdmin: true,
    supabaseAdmin: createSupabaseAdminMock({
      cases: {
        maybeSingle: ok({
          id: "case-1",
          customer_id: "customer-1",
          assigned_to: "csr-1",
          title: "Internet issue",
        }),
        update: ok([]),
      },
      customers: {
        maybeSingle: ok({
          id: "customer-1",
          user_id: "customer-user",
        }),
      },
      messages: {
        single: ok({
          id: "msg-1",
          case_id: "case-1",
          sender_id: "csr-1",
          sender_role: "CSR",
          message_type: "text",
          message_text: "We are on it",
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
    emitInternalChatMessage,
  }));

  const { employeeChatRouter } = await import("../../src/routes/employeeChatRoutes");
  return {
    app: createRouterApp(employeeChatRouter),
    createNotification,
    emitCaseChatMessage,
    emitInternalChatMessage,
  };
}

describe("employeeChatRoutes", () => {
  it("validates csr case messaging and triggers realtime/notification collaborators", async () => {
    const { app, createNotification, emitCaseChatMessage, emitInternalChatMessage } =
      await loadEmployeeChatRouter();
    const token = signTestJwt({
      sub: "csr-1",
      email: "csr@example.com",
      role: "CSR",
      name: "CSR One",
    });

    const invalidResponse = await request(app)
      .post("/employee/cases/not-a-uuid/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Hello" });
    expect(invalidResponse.status).toBe(400);

    const response = await request(app)
      .post("/employee/cases/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "We are on it" });

    expect(response.status).toBe(201);
    expect(emitCaseChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "case-1",
        messageText: "We are on it",
        isCustomer: false,
      }),
    );
    expect(createNotification).toHaveBeenCalledWith({
      userId: "customer-user",
      type: "case_message",
      message: 'New support reply on "Internet issue".',
    });
    expect(emitInternalChatMessage).not.toHaveBeenCalled();
  });

  it("does not insert a case message when the customer profile lookup fails", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const emitCaseChatMessage = vi.fn();
    const emitInternalChatMessage = vi.fn();
    const insertSpy = vi.fn().mockResolvedValue({
      data: {
        id: "msg-1",
        case_id: "case-1",
        sender_id: "csr-1",
        sender_role: "CSR",
        message_type: "text",
        message_text: "We are on it",
        created_at: "2026-03-08T01:00:00.000Z",
      },
      error: null,
    });

    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: {
        from(table: string) {
          if (table === "cases") {
            return createSupabaseAdminMock({
              cases: {
                maybeSingle: ok({
                  id: "case-1",
                  customer_id: "customer-1",
                  assigned_to: "csr-1",
                  title: "Internet issue",
                }),
              },
            }).from(table);
          }

          if (table === "customers") {
            return createSupabaseAdminMock({
              customers: {
                maybeSingle: {
                  data: null,
                  error: { message: "customer lookup failed" },
                },
              },
            }).from(table);
          }

          if (table === "messages") {
            return {
              insert: insertSpy,
            };
          }

          return createSupabaseAdminMock({}).from(table);
        },
      },
    }));
    vi.doMock("../../src/services/notificationService", () => ({
      createNotification,
    }));
    vi.doMock("../../src/services/realtime", () => ({
      emitCaseChatMessage,
      emitInternalChatMessage,
    }));

    const { employeeChatRouter } = await import("../../src/routes/employeeChatRoutes");
    const app = createRouterApp(employeeChatRouter);
    const token = signTestJwt({
      sub: "csr-1",
      email: "csr@example.com",
      role: "CSR",
      name: "CSR One",
    });

    const response = await request(app)
      .post("/employee/cases/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "We are on it" });

    expect(response.status).toBe(500);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(emitCaseChatMessage).not.toHaveBeenCalled();
    expect(emitInternalChatMessage).not.toHaveBeenCalled();
  });
});
