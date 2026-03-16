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

  it("rolls back ticket creation if bootstrap message creation fails", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const emitCaseChatMessage = vi.fn();
    const deleteSpy = vi.fn();
    const baseSupabaseAdmin = createSupabaseAdminMock({
      customers: {
        maybeSingle: ok({
          id: "customer-1",
          user_id: "customer-user",
          company: "Acme",
          contact_info: { email: "customer@example.com" },
          created_at: "2026-03-08T00:00:00.000Z",
        }),
      },
      users: {
        list: ok([
          {
            id: "csr-1",
            email: "csr@example.com",
            name: "CSR One",
            role: "CSR",
            created_at: "2026-03-08T00:00:00.000Z",
          },
        ]),
      },
      cases: {
        list: ok([]),
        single: ok({
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
        delete: ok([]),
      },
      messages: {
        list: {
          data: null,
          error: { message: "message insert failed" },
        },
      },
    });
    const supabaseAdmin = {
      from(table: string) {
        const builder = baseSupabaseAdmin.from(table);
        if (table !== "cases") {
          return builder;
        }

        const originalDelete = builder.delete;
        builder.delete = (() => {
          const deleteBuilder = originalDelete.call(builder);
          const originalEq = deleteBuilder.eq;
          deleteBuilder.eq = ((...args: unknown[]) => {
            deleteSpy(...args);
            return originalEq(...args);
          }) as typeof deleteBuilder.eq;
          return deleteBuilder;
        }) as typeof builder.delete;

        return builder;
      },
    };

    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin,
    }));
    vi.doMock("../../src/services/notificationService", () => ({
      createNotification,
    }));
    vi.doMock("../../src/services/realtime", () => ({
      emitCaseChatMessage,
    }));
    vi.doMock("../../src/services/systemSettings", () => ({
      getSystemSettings: vi.fn().mockResolvedValue({ defaultCasePriority: "High" }),
    }));

    const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
    const app = createRouterApp(customerPortalRouter);
    const token = signTestJwt({
      sub: "customer-user",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer User",
    });

    const response = await request(app)
      .post("/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "Internet issue",
        description: "Body",
        category: "Technical",
        attachments: [],
      });

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("message insert failed");
    expect(deleteSpy).toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(emitCaseChatMessage).not.toHaveBeenCalled();
  });

  it("uses the atomic RPC ticket creation path when available", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const emitCaseChatMessage = vi.fn();
    const rpcSpy = vi.fn().mockResolvedValue({
      data: {
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
      },
      error: null,
    });
    const fallbackInsertSpy = vi.fn();

    const baseSupabaseAdmin = createSupabaseAdminMock({
      customers: {
        maybeSingle: ok({
          id: "customer-1",
          user_id: "customer-user",
          company: "Acme",
          contact_info: { email: "customer@example.com" },
          created_at: "2026-03-08T00:00:00.000Z",
        }),
      },
      users: {
        list: ok([
          {
            id: "csr-1",
            email: "csr@example.com",
            name: "CSR One",
            role: "CSR",
            created_at: "2026-03-08T00:00:00.000Z",
          },
        ]),
      },
      cases: {
        list: ok([]),
      },
    });

    const supabaseAdmin = {
      rpc: rpcSpy,
      from(table: string) {
        if (table === "cases") {
          const baseBuilder = baseSupabaseAdmin.from(table) as { insert: unknown };
          return {
            ...baseBuilder,
            insert: fallbackInsertSpy,
          };
        }

        if (table === "messages") {
          return { insert: fallbackInsertSpy };
        }
        return baseSupabaseAdmin.from(table);
      },
    };

    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin,
    }));
    vi.doMock("../../src/services/notificationService", () => ({
      createNotification,
    }));
    vi.doMock("../../src/services/realtime", () => ({
      emitCaseChatMessage,
    }));
    vi.doMock("../../src/services/systemSettings", () => ({
      getSystemSettings: vi.fn().mockResolvedValue({ defaultCasePriority: "High" }),
    }));

    const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
    const app = createRouterApp(customerPortalRouter);
    const token = signTestJwt({
      sub: "customer-user",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer User",
    });

    const response = await request(app)
      .post("/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "Internet issue",
        description: "Body",
        category: "Technical",
        attachments: [],
      });

    expect(response.status).toBe(201);
    expect(rpcSpy).toHaveBeenCalledWith(
      "create_ticket_with_bootstrap_messages",
      expect.objectContaining({
        p_customer_id: "customer-1",
        p_assigned_to: "csr-1",
      }),
    );
    expect(fallbackInsertSpy).not.toHaveBeenCalled();
  });

  it("rolls back a failed customer message write so retry does not duplicate persisted chat data", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const emitCaseChatMessage = vi.fn();
    const deleteMessageByIdSpy = vi.fn();
    let messageInsertCount = 0;
    let caseTouchCount = 0;

    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: {
        from(table: string) {
          if (table === "customers") {
            return createSupabaseAdminMock({
              customers: {
                maybeSingle: ok({
                  id: "customer-1",
                  user_id: "customer-user",
                  company: "Acme",
                  contact_info: { email: "customer@example.com" },
                  created_at: "2026-03-08T00:00:00.000Z",
                }),
              },
            }).from(table);
          }

          if (table === "cases") {
            let action: "select" | "update" = "select";
            return {
              select() {
                if (action !== "update") {
                  action = "select";
                }
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => {
                if (action === "select") {
                  return {
                    data: {
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
                    },
                    error: null,
                  };
                }

                return caseTouchCount++ === 0
                  ? { data: null, error: { message: "touch failed" } }
                  : { data: { id: "case-1" }, error: null };
              },
              update() {
                action = "update";
                return this;
              },
            };
          }

          if (table === "messages") {
            return {
              insert() {
                return {
                  select() {
                    return {
                      single: async () => {
                        messageInsertCount += 1;
                        return {
                          data: {
                            id: `msg-${messageInsertCount}`,
                            case_id: "case-1",
                            sender_id: "customer-user",
                            sender_role: "Customer",
                            message_type: "text",
                            message_text: "Need help",
                            created_at: "2026-03-08T01:00:00.000Z",
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
              delete() {
                return this;
              },
              eq(field: string, value: string) {
                if (field === "id") {
                  deleteMessageByIdSpy(value);
                }
                return this;
              },
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
    }));
    vi.doMock("../../src/services/systemSettings", () => ({
      getSystemSettings: vi.fn(),
    }));

    const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
    const app = createRouterApp(customerPortalRouter);
    const token = signTestJwt({
      sub: "customer-user",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer User",
    });

    const firstAttempt = await request(app)
      .post("/portal/tickets/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Need help" });

    const secondAttempt = await request(app)
      .post("/portal/tickets/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Need help" });

    expect(firstAttempt.status).toBe(500);
    expect(secondAttempt.status).toBe(201);
    expect(deleteMessageByIdSpy).toHaveBeenCalledWith("msg-1");
    expect(deleteMessageByIdSpy).toHaveBeenCalledTimes(1);
    expect(emitCaseChatMessage).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("surfaces cleanup failure details when customer message rollback cannot delete the inserted row", async () => {
    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: {
        from(table: string) {
          if (table === "customers") {
            return createSupabaseAdminMock({
              customers: {
                maybeSingle: ok({
                  id: "customer-1",
                  user_id: "customer-user",
                  company: "Acme",
                  contact_info: { email: "customer@example.com" },
                  created_at: "2026-03-08T00:00:00.000Z",
                }),
              },
            }).from(table);
          }

          if (table === "cases") {
            let action: "select" | "update" = "select";
            return {
              select() {
                if (action !== "update") {
                  action = "select";
                }
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () =>
                action === "select"
                  ? {
                      data: {
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
                      },
                      error: null,
                    }
                  : { data: null, error: { message: "touch failed" } },
              update() {
                action = "update";
                return this;
              },
            };
          }

          if (table === "messages") {
            return {
              insert() {
                return {
                  select() {
                    return {
                      single: async () => ({
                        data: {
                          id: "msg-1",
                          case_id: "case-1",
                          sender_id: "customer-user",
                          sender_role: "Customer",
                          message_type: "text",
                          message_text: "Need help",
                          created_at: "2026-03-08T01:00:00.000Z",
                        },
                        error: null,
                      }),
                    };
                  },
                };
              },
              delete() {
                return this;
              },
              eq() {
                return Promise.resolve({
                  data: null,
                  error: { message: "cleanup failed" },
                });
              },
            };
          }

          return createSupabaseAdminMock({}).from(table);
        },
      },
    }));
    vi.doMock("../../src/services/notificationService", () => ({
      createNotification: vi.fn(),
    }));
    vi.doMock("../../src/services/realtime", () => ({
      emitCaseChatMessage: vi.fn(),
    }));
    vi.doMock("../../src/services/systemSettings", () => ({
      getSystemSettings: vi.fn(),
    }));

    const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
    const app = createRouterApp(customerPortalRouter);
    const token = signTestJwt({
      sub: "customer-user",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer User",
    });

    const response = await request(app)
      .post("/portal/tickets/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Need help" });

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("cleanup also failed");
  });

  it("uses the atomic RPC customer message path when available", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const emitCaseChatMessage = vi.fn();
    const rpcSpy = vi.fn().mockResolvedValue({
      data: {
        id: "msg-1",
        case_id: "case-1",
        sender_id: "customer-user",
        sender_role: "Customer",
        message_type: "text",
        message_text: "Need help",
        created_at: "2026-03-08T01:00:00.000Z",
      },
      error: null,
    });
    const fallbackInsertSpy = vi.fn();

    vi.resetModules();
    vi.doMock("../../src/config/env", () => ({
      env: { jwtSecret: "test-secret" },
      hasJwtSecret: true,
    }));
    vi.doMock("../../src/services/supabaseClient", () => ({
      hasSupabaseAdmin: true,
      supabaseAdmin: {
        rpc: rpcSpy,
        from(table: string) {
          if (table === "customers") {
            return createSupabaseAdminMock({
              customers: {
                maybeSingle: ok({
                  id: "customer-1",
                  user_id: "customer-user",
                  company: "Acme",
                  contact_info: { email: "customer@example.com" },
                  created_at: "2026-03-08T00:00:00.000Z",
                }),
              },
            }).from(table);
          }

          if (table === "cases") {
            return createSupabaseAdminMock({
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
              },
            }).from(table);
          }

          if (table === "messages") {
            return {
              insert: fallbackInsertSpy,
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
    }));
    vi.doMock("../../src/services/systemSettings", () => ({
      getSystemSettings: vi.fn(),
    }));

    const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
    const app = createRouterApp(customerPortalRouter);
    const token = signTestJwt({
      sub: "customer-user",
      email: "customer@example.com",
      role: "Customer",
      name: "Customer User",
    });

    const response = await request(app)
      .post("/portal/tickets/0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ messageText: "Need help" });

    expect(response.status).toBe(201);
    expect(rpcSpy).toHaveBeenCalledWith(
      "append_customer_case_message_atomic",
      expect.objectContaining({
        p_case_id: "0f7f0a4f-9b13-4fa6-8d9f-6a3127c6fb47",
      }),
    );
    expect(fallbackInsertSpy).not.toHaveBeenCalled();
  });
});
