import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock, ok } from "../utils/mockSupabase";
import { createRouterApp } from "../utils/routerApp";
import { signTestJwt } from "../utils/testJwt";

const CSR_ID = "550e8400-e29b-41d4-a716-446655440200";
const MANAGER_ID = "550e8400-e29b-41d4-a716-446655440201";
const EXECUTIVE_ID = "550e8400-e29b-41d4-a716-446655440202";
const ADMIN_ID = "550e8400-e29b-41d4-a716-446655440203";
const CUSTOMER_USER_ID = "550e8400-e29b-41d4-a716-446655440204";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440205";
const CASE_ID = "550e8400-e29b-41d4-a716-446655440206";
const MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440207";
const MESSAGE_ID_2 = "550e8400-e29b-41d4-a716-446655440208";
const INTERNAL_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440209";
const CREATED_AT = "2026-03-11T00:00:00.000Z";
const UPDATED_AT = "2026-03-11T01:00:00.000Z";

type ChatLoaderOptions = {
  plan?: Record<string, Record<string, unknown>>;
  supabaseAdminOverride?: {
    from: (table: string) => unknown;
  };
  createNotification?: ReturnType<typeof vi.fn>;
  emitCaseChatMessage?: ReturnType<typeof vi.fn>;
  emitInternalChatMessage?: ReturnType<typeof vi.fn>;
};

async function loadEmployeeChatRouter(options: ChatLoaderOptions = {}) {
  const createNotification = options.createNotification ?? vi.fn().mockResolvedValue(null);
  const emitCaseChatMessage = options.emitCaseChatMessage ?? vi.fn();
  const emitInternalChatMessage = options.emitInternalChatMessage ?? vi.fn();

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

const csrToken = signTestJwt({
  sub: CSR_ID,
  email: "csr@example.com",
  role: "CSR",
  name: "CSR One",
});

const managerToken = signTestJwt({
  sub: MANAGER_ID,
  email: "manager@example.com",
  role: "Manager",
  name: "Manager One",
});

const assignedCaseRow = {
  id: CASE_ID,
  customer_id: CUSTOMER_ID,
  assigned_to: CSR_ID,
  title: "Internet issue",
};

describe("employeeChatRoutes coverage", () => {
  it("returns case chat messages for the assigned CSR", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        cases: {
          maybeSingle: ok(assignedCaseRow),
        },
        customers: {
          maybeSingle: ok({
            id: CUSTOMER_ID,
            user_id: CUSTOMER_USER_ID,
          }),
        },
        messages: {
          list: ok([
            {
              id: MESSAGE_ID,
              case_id: CASE_ID,
              sender_id: CSR_ID,
              sender_role: "CSR",
              message_type: "text",
              message_text: "We are on it",
              created_at: CREATED_AT,
            },
            {
              id: MESSAGE_ID_2,
              case_id: CASE_ID,
              sender_id: CUSTOMER_USER_ID,
              sender_role: "Customer",
              message_type: "text",
              message_text: "Thanks",
              created_at: UPDATED_AT,
            },
          ]),
        },
        users: {
          list: ok([
            {
              id: CSR_ID,
              email: "csr@example.com",
              name: "CSR One",
              role: "CSR",
              created_at: CREATED_AT,
            },
            {
              id: CUSTOMER_USER_ID,
              email: "customer@example.com",
              name: "Customer User",
              role: "Customer",
              created_at: CREATED_AT,
            },
          ]),
        },
      },
    });

    const response = await request(app)
      .get(`/employee/cases/${CASE_ID}/messages`)
      .set("Authorization", `Bearer ${csrToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.case).toMatchObject({
      id: CASE_ID,
      title: "Internet issue",
    });
    expect(response.body.data.messages).toEqual([
      expect.objectContaining({
        id: MESSAGE_ID,
        senderName: "You",
        isCustomer: false,
        isSelf: true,
      }),
      expect.objectContaining({
        id: MESSAGE_ID_2,
        senderName: "Customer User",
        isCustomer: true,
        isSelf: false,
      }),
    ]);
  });

  it("forbids case chat access when the case is assigned to another CSR", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        cases: {
          maybeSingle: ok({
            ...assignedCaseRow,
            assigned_to: MANAGER_ID,
          }),
        },
      },
    });

    const response = await request(app)
      .get(`/employee/cases/${CASE_ID}/messages`)
      .set("Authorization", `Bearer ${csrToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You can only access chat messages for cases assigned to your account.",
    );
  });

  it("returns 404 when the case customer profile is missing", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        cases: {
          maybeSingle: ok(assignedCaseRow),
        },
        customers: {
          maybeSingle: ok(null),
        },
        messages: {
          list: ok([]),
        },
      },
    });

    const response = await request(app)
      .get(`/employee/cases/${CASE_ID}/messages`)
      .set("Authorization", `Bearer ${csrToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Customer profile for this case was not found.");
  });

  it("lists internal chat contacts sorted by role weight then name", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        users: {
          list: ok([
            {
              id: ADMIN_ID,
              email: "admin@example.com",
              name: "Admin User",
              role: "Admin",
              created_at: CREATED_AT,
            },
            {
              id: CSR_ID,
              email: "csr@example.com",
              name: "Zed CSR",
              role: "CSR",
              created_at: CREATED_AT,
            },
            {
              id: EXECUTIVE_ID,
              email: "executive@example.com",
              name: "Executive User",
              role: "Executive",
              created_at: CREATED_AT,
            },
          ]),
        },
      },
    });

    const response = await request(app)
      .get("/employee/internal-chat/contacts")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.contacts.map((contact: { role: string; name: string }) => `${contact.role}:${contact.name}`))
      .toEqual(["Executive:Executive User", "CSR:Zed CSR", "Admin:Admin User"]);
  });

  it("returns internal thread messages with peer metadata", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        users: {
          maybeSingle: ok({
            id: EXECUTIVE_ID,
            email: "executive@example.com",
            name: "Executive User",
            role: "Executive",
            created_at: CREATED_AT,
          }),
        },
        internal_messages: {
          list: ok([
            {
              id: INTERNAL_MESSAGE_ID,
              sender_id: MANAGER_ID,
              recipient_id: EXECUTIVE_ID,
              message_text: "Need approval",
              created_at: CREATED_AT,
            },
            {
              id: MESSAGE_ID,
              sender_id: EXECUTIVE_ID,
              recipient_id: MANAGER_ID,
              message_text: "Approved",
              created_at: UPDATED_AT,
            },
          ]),
        },
      },
    });

    const response = await request(app)
      .get(`/employee/internal-chat/${EXECUTIVE_ID}/messages`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.peer).toMatchObject({
      id: EXECUTIVE_ID,
      role: "Executive",
    });
    expect(response.body.data.messages).toEqual([
      expect.objectContaining({
        id: INTERNAL_MESSAGE_ID,
        senderName: "You",
        recipientName: "Executive User",
        isSelf: true,
      }),
      expect.objectContaining({
        id: MESSAGE_ID,
        senderName: "Executive User",
        recipientName: "Manager One",
        isSelf: false,
      }),
    ]);
  });

  it("rejects internal thread lookups where peerUserId equals the viewer", async () => {
    const response = await request((await loadEmployeeChatRouter()).app)
      .get(`/employee/internal-chat/${MANAGER_ID}/messages`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("peerUserId cannot be the same as the authenticated user.");
  });

  it("rejects internal thread lookups for disallowed role pairs", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        users: {
          maybeSingle: ok({
            id: CUSTOMER_USER_ID,
            email: "customer@example.com",
            name: "Customer User",
            role: "Customer",
            created_at: CREATED_AT,
          }),
        },
      },
    });

    const response = await request(app)
      .get(`/employee/internal-chat/${CUSTOMER_USER_ID}/messages`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Internal chat is not allowed between Manager and Customer.");
  });

  it("creates an internal message and notifies the peer", async () => {
    const createNotification = vi.fn().mockResolvedValue(null);
    const emitInternalChatMessage = vi.fn();
    const { app } = await loadEmployeeChatRouter({
      createNotification,
      emitInternalChatMessage,
      plan: {
        users: {
          maybeSingle: ok({
            id: EXECUTIVE_ID,
            email: "executive@example.com",
            name: "Executive User",
            role: "Executive",
            created_at: CREATED_AT,
          }),
        },
        internal_messages: {
          single: ok({
            id: INTERNAL_MESSAGE_ID,
            sender_id: MANAGER_ID,
            recipient_id: EXECUTIVE_ID,
            message_text: "Need approval",
            created_at: CREATED_AT,
          }),
        },
      },
    });

    const response = await request(app)
      .post(`/employee/internal-chat/${EXECUTIVE_ID}/messages`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ messageText: "Need approval" });

    expect(response.status).toBe(201);
    expect(emitInternalChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: INTERNAL_MESSAGE_ID,
        senderId: MANAGER_ID,
        recipientId: EXECUTIVE_ID,
        senderName: "Manager One",
        recipientName: "Executive User",
        messageText: "Need approval",
      }),
    );
    expect(createNotification).toHaveBeenCalledWith({
      userId: EXECUTIVE_ID,
      type: "internal_message",
      message: "New internal message from Manager One.",
    });
    expect(response.body.data.message).toMatchObject({
      id: INTERNAL_MESSAGE_ID,
      isSelf: true,
    });
  });

  it("returns 404 when posting to a missing internal-chat peer", async () => {
    const { app } = await loadEmployeeChatRouter({
      plan: {
        users: {
          maybeSingle: ok(null),
        },
      },
    });

    const response = await request(app)
      .post(`/employee/internal-chat/${EXECUTIVE_ID}/messages`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ messageText: "Need approval" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Internal chat peer was not found.");
  });

  it("rejects invalid internal message bodies", async () => {
    const { app } = await loadEmployeeChatRouter();

    const response = await request(app)
      .post(`/employee/internal-chat/${EXECUTIVE_ID}/messages`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ messageText: "   " });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("messageText cannot be empty.");
  });
});
