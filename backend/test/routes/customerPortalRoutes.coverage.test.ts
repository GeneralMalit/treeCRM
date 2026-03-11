import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

const CUSTOMER_USER_ID = "550e8400-e29b-41d4-a716-446655440100";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440101";
const CASE_ID = "550e8400-e29b-41d4-a716-446655440102";
const CSR_ID = "550e8400-e29b-41d4-a716-446655440103";
const MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440104";
const MESSAGE_ID_2 = "550e8400-e29b-41d4-a716-446655440105";
const CREATED_AT = "2026-03-11T00:00:00.000Z";
const UPDATED_AT = "2026-03-11T01:00:00.000Z";

const customerToken = signTestJwt({
  sub: CUSTOMER_USER_ID,
  email: "customer@example.com",
  role: "Customer",
  name: "Customer User",
});

type PortalLoaderOptions = {
  plan?: Record<string, Record<string, unknown>>;
  supabaseAdminOverride?: {
    from: (table: string) => unknown;
  };
  createNotification?: ReturnType<typeof vi.fn>;
  emitCaseChatMessage?: ReturnType<typeof vi.fn>;
  getSystemSettings?: ReturnType<typeof vi.fn>;
};

async function loadCustomerPortalRouter(options: PortalLoaderOptions = {}) {
  const createNotification = options.createNotification ?? vi.fn().mockResolvedValue(null);
  const emitCaseChatMessage = options.emitCaseChatMessage ?? vi.fn();
  const getSystemSettings =
    options.getSystemSettings ?? vi.fn().mockResolvedValue({ defaultCasePriority: "High" });

  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: { jwtSecret: "test-secret" },
    hasJwtSecret: true,
  }));
  vi.doMock("../../src/services/supabaseClient", () => ({
    hasSupabaseAdmin: true,
    supabaseAdmin: options.supabaseAdminOverride ?? createSupabaseAdminMock((options.plan ?? {}) as never),
  }));
  vi.doMock("../../src/services/notificationService", () => ({
    createNotification,
  }));
  vi.doMock("../../src/services/realtime", () => ({
    emitCaseChatMessage,
  }));
  vi.doMock("../../src/services/systemSettings", () => ({
    getSystemSettings,
  }));

  const { customerPortalRouter } = await import("../../src/routes/customerPortalRoutes");
  return {
    app: createRouterApp(customerPortalRouter),
    createNotification,
    emitCaseChatMessage,
    getSystemSettings,
  };
}

const customerRow = {
  id: CUSTOMER_ID,
  user_id: CUSTOMER_USER_ID,
  company: "Acme",
  contact_info: { email: "customer@example.com" },
  created_at: CREATED_AT,
};

const assignedUserRow = {
  id: CSR_ID,
  email: "csr@example.com",
  name: "CSR One",
  role: "CSR",
  created_at: CREATED_AT,
};

const openCaseRow = {
  id: CASE_ID,
  customer_id: CUSTOMER_ID,
  assigned_to: CSR_ID,
  title: "Internet issue",
  description: "Body",
  status: "Open",
  priority: "High",
  category: "Technical",
  attachments: ["invoice.pdf"],
  customer_satisfaction_rating: null,
  customer_satisfaction_submitted_at: null,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};

const resolvedCaseRow = {
  ...openCaseRow,
  status: "Resolved",
};

describe("customerPortalRoutes coverage", () => {
  it("lists tickets and resolves assigned employee metadata", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          list: ok([openCaseRow]),
        },
        users: {
          list: ok([assignedUserRow]),
        },
      },
    });

    const response = await request(app)
      .get("/portal/tickets")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.customer).toMatchObject({
      id: CUSTOMER_ID,
      company: "Acme",
    });
    expect(response.body.data.tickets).toEqual([
      expect.objectContaining({
        id: CASE_ID,
        subject: "Internet issue",
        assignedEmployee: {
          id: CSR_ID,
          name: "CSR One",
          email: "csr@example.com",
          role: "CSR",
        },
      }),
    ]);
  });

  it("creates a ticket successfully and inserts both the system and initial customer messages", async () => {
    const messagesInsert = vi.fn().mockReturnValue({
      then(onFulfilled: (value: unknown) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      },
    });

    const baseSupabaseAdmin = createSupabaseAdminMock({
      customers: {
        maybeSingle: ok(customerRow),
      },
      users: {
        list: ok([assignedUserRow]),
      },
      cases: {
        list: ok([]),
      },
    });

    const supabaseAdmin = {
      from(table: string) {
        if (table === "cases") {
          const builder = baseSupabaseAdmin.from(table) as {
            insert: () => {
              select: () => {
                single: () => Promise<unknown>;
              };
            };
          };
          return {
            ...builder,
            insert() {
              return {
                select() {
                  return {
                    single: () => Promise.resolve({ data: openCaseRow, error: null }),
                  };
                },
              };
            },
          };
        }

        if (table === "messages") {
          return {
            insert: messagesInsert,
          };
        }

        return baseSupabaseAdmin.from(table);
      },
    };

    const { app, getSystemSettings } = await loadCustomerPortalRouter({
      supabaseAdminOverride: supabaseAdmin,
    });

    const response = await request(app)
      .post("/portal/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        subject: "Internet issue",
        description: "Body",
        category: "Technical",
        attachments: [],
      });

    expect(response.status).toBe(201);
    expect(getSystemSettings).toHaveBeenCalled();
    expect(messagesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          case_id: CASE_ID,
          sender_id: null,
          sender_role: "Customer",
          message_type: "system",
        }),
        expect.objectContaining({
          case_id: CASE_ID,
          sender_id: CUSTOMER_USER_ID,
          sender_role: "Customer",
          message_type: "text",
          message_text: "Body",
        }),
      ]),
    );
    expect(response.body.data.ticket).toMatchObject({
      id: CASE_ID,
      subject: "Internet issue",
      priority: "High",
    });
  });

  it("returns 503 when no CSR assignee is available", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        users: {
          list: ok([]),
        },
        cases: {
          list: ok([]),
        },
      },
    });

    const response = await request(app)
      .post("/portal/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        subject: "Internet issue",
        description: "Body",
        category: "Technical",
        attachments: [],
      });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain("No CSR");
  });

  it("returns 500 when created ticket payload cannot be parsed", async () => {
    const messagesInsert = vi.fn();
    const baseSupabaseAdmin = createSupabaseAdminMock({
      customers: {
        maybeSingle: ok(customerRow),
      },
      users: {
        list: ok([assignedUserRow]),
      },
      cases: {
        list: ok([]),
      },
    });

    const supabaseAdmin = {
      from(table: string) {
        if (table === "cases") {
          const builder = baseSupabaseAdmin.from(table);
          return {
            ...builder,
            insert() {
              return {
                select() {
                  return {
                    single: () =>
                      Promise.resolve({
                        data: {
                          id: CASE_ID,
                          customer_id: CUSTOMER_ID,
                        },
                        error: null,
                      }),
                  };
                },
              };
            },
          };
        }

        if (table === "messages") {
          return {
            insert: messagesInsert,
          };
        }

        return baseSupabaseAdmin.from(table);
      },
    };

    const { app } = await loadCustomerPortalRouter({
      supabaseAdminOverride: supabaseAdmin,
    });

    const response = await request(app)
      .post("/portal/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        subject: "Internet issue",
        description: "Body",
        category: "Technical",
        attachments: [],
      });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Failed to parse created ticket payload.");
    expect(messagesInsert).not.toHaveBeenCalled();
  });

  it("returns ticket detail with timeline and mapped message names", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          maybeSingle: ok(resolvedCaseRow),
        },
        messages: {
          list: ok([
            {
              id: MESSAGE_ID,
              case_id: CASE_ID,
              sender_id: CUSTOMER_USER_ID,
              sender_role: "Customer",
              message_type: "text",
              message_text: "Need help",
              created_at: CREATED_AT,
            },
            {
              id: MESSAGE_ID_2,
              case_id: CASE_ID,
              sender_id: null,
              sender_role: "Customer",
              message_type: "system",
              message_text: "Ticket created in category \"Technical\" and assigned to support.",
              created_at: UPDATED_AT,
            },
          ]),
        },
        users: {
          list: ok([assignedUserRow]),
        },
      },
    });

    const response = await request(app)
      .get(`/portal/tickets/${CASE_ID}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.ticket).toMatchObject({
      id: CASE_ID,
      subject: "Internet issue",
      assignedEmployee: {
        id: CSR_ID,
        name: "CSR One",
      },
    });
    expect(response.body.data.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Ticket created" }),
        expect.objectContaining({ label: "Assigned to a support agent" }),
        expect.objectContaining({
          label: 'Ticket created in category "Technical" and assigned to support.',
        }),
      ]),
    );
    expect(response.body.data.messages).toEqual([
      expect.objectContaining({
        id: MESSAGE_ID,
        senderName: "You",
        isCustomer: true,
      }),
    ]);
  });

  it("returns 404 when the requested ticket is not owned by the customer", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          maybeSingle: ok(null),
        },
      },
    });

    const response = await request(app)
      .get(`/portal/tickets/${CASE_ID}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Ticket not found.");
  });

  it("accepts customer satisfaction for a resolved ticket", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const { app } = await loadCustomerPortalRouter({
      createNotification,
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          maybeSingle: ok(resolvedCaseRow),
          update: ok({
            ...resolvedCaseRow,
            customer_satisfaction_rating: 5,
            customer_satisfaction_submitted_at: UPDATED_AT,
          }),
        },
      },
    });

    const response = await request(app)
      .post(`/portal/tickets/${CASE_ID}/customer-satisfaction`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5 });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      ticketId: CASE_ID,
      rating: 5,
      submittedAt: UPDATED_AT,
    });
    expect(createNotification).toHaveBeenCalledWith({
      userId: CSR_ID,
      type: "case_customer_satisfaction",
      message: 'A customer submitted a 5/5 satisfaction rating for "Internet issue".',
    });
  });

  it("rejects customer satisfaction before resolution", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          maybeSingle: ok(openCaseRow),
        },
      },
    });

    const response = await request(app)
      .post(`/portal/tickets/${CASE_ID}/customer-satisfaction`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 4 });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Customer satisfaction can only be submitted after a ticket is resolved.",
    );
  });

  it("rejects duplicate customer satisfaction when rating already exists", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          maybeSingle: ok({
            ...resolvedCaseRow,
            customer_satisfaction_rating: 4,
            customer_satisfaction_submitted_at: CREATED_AT,
          }),
        },
      },
    });

    const response = await request(app)
      .post(`/portal/tickets/${CASE_ID}/customer-satisfaction`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5 });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Customer satisfaction has already been submitted for this ticket.");
  });

  it("returns 409 when the update races and no row is updated", async () => {
    const { app } = await loadCustomerPortalRouter({
      plan: {
        customers: {
          maybeSingle: ok(customerRow),
        },
        cases: {
          maybeSingle: ok(resolvedCaseRow),
          update: ok(null),
        },
      },
    });

    const response = await request(app)
      .post(`/portal/tickets/${CASE_ID}/customer-satisfaction`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5 });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Customer satisfaction was already submitted for this ticket.");
  });

  it("creates a customer profile on first ticket-list access when missing", async () => {
    const customersMaybeSingle = vi.fn().mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok(customerRow));
    const customersInsert = vi.fn().mockReturnValue({
      select() {
        return {
          single: () => Promise.resolve({ data: customerRow, error: null }),
        };
      },
    });
    const baseSupabaseAdmin = createSupabaseAdminMock({
      cases: {
        list: ok([]),
      },
    });

    const supabaseAdmin = {
      from(table: string) {
        if (table === "customers") {
          const builder = {
            select() {
              return builder;
            },
            eq() {
              return builder;
            },
            maybeSingle: customersMaybeSingle,
            insert: customersInsert,
          };
          return builder;
        }

        return baseSupabaseAdmin.from(table);
      },
    };

    const { app } = await loadCustomerPortalRouter({
      supabaseAdminOverride: supabaseAdmin,
    });

    const response = await request(app)
      .get("/portal/tickets")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(customersInsert).toHaveBeenCalledWith({
      user_id: CUSTOMER_USER_ID,
      company: "Customer User",
      contact_info: {
        email: "customer@example.com",
      },
    });
    expect(response.body.data.customer).toMatchObject({
      id: CUSTOMER_ID,
      company: "Acme",
    });
  });
});
