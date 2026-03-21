import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock, ok } from "../utils/mockSupabase";
import { signTestJwt } from "../utils/testJwt";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";
const CASE_ID = "550e8400-e29b-41d4-a716-446655440002";
const CASE_ID_2 = "550e8400-e29b-41d4-a716-446655440003";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440004";
const TAG_ID_2 = "550e8400-e29b-41d4-a716-446655440005";
const MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440006";
const ENDORSEMENT_ID = "550e8400-e29b-41d4-a716-446655440007";
const NOTIFICATION_ID = "550e8400-e29b-41d4-a716-446655440008";
const CSR_ID = "550e8400-e29b-41d4-a716-446655440009";
const MANAGER_ID = "550e8400-e29b-41d4-a716-446655440010";
const NOTIFICATION_USER_ID = "550e8400-e29b-41d4-a716-446655440011";
const CREATED_AT = "2026-03-11T00:00:00.000Z";
const UPDATED_AT = "2026-03-11T01:00:00.000Z";

const adminToken = signTestJwt({
  sub: "admin-1",
  email: "admin@example.com",
  role: "Admin",
  name: "Admin User",
});

type LoaderOptions = {
  hasSupabaseAdmin?: boolean;
  plan?: Record<string, Record<string, unknown>>;
  createUser?: ReturnType<typeof vi.fn>;
  updateUserById?: ReturnType<typeof vi.fn>;
  deleteUser?: ReturnType<typeof vi.fn>;
  supabaseAdminOverride?: {
    from: (table: string) => unknown;
    auth?: { admin?: Record<string, unknown> };
  };
};

function createSequencedUsersTable(options: {
  selectResults?: Array<ReturnType<typeof ok>>;
  updateResults?: Array<ReturnType<typeof ok>>;
}) {
  const selectResults = [...(options.selectResults ?? [])];
  const updateResults = [...(options.updateResults ?? [])];
  let mode: "select" | "update" = "select";

  const builder = {
    select() {
      mode = "select";
      return builder;
    },
    update() {
      mode = "update";
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle() {
      const result = mode === "update" ? updateResults.shift() ?? ok(null) : selectResults.shift() ?? ok(null);
      return Promise.resolve(result);
    },
    single() {
      const result = mode === "update" ? updateResults.shift() ?? ok(null) : selectResults.shift() ?? ok(null);
      return Promise.resolve(result);
    },
    then(onFulfilled: (value: ReturnType<typeof ok>) => unknown, onRejected?: (reason: unknown) => unknown) {
      const result = mode === "update" ? updateResults.shift() ?? ok(null) : selectResults.shift() ?? ok(null);
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

async function loadCoreDataApp(options: LoaderOptions = {}) {
  vi.resetModules();
  vi.doMock("../../src/config/env", () => ({
    env: {
      jwtSecret: "test-secret",
    },
    hasJwtSecret: true,
  }));

  const createUser =
    options.createUser ??
    vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID, email: "created@example.com" } },
      error: null,
    });
  const updateUserById =
    options.updateUserById ??
    vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  const deleteUser = options.deleteUser ?? vi.fn().mockResolvedValue({ data: {}, error: null });

  const supabaseAdmin =
    options.supabaseAdminOverride ??
    ({
      ...createSupabaseAdminMock((options.plan ?? {}) as never),
      auth: {
        admin: {
          createUser,
          updateUserById,
          deleteUser,
        },
      },
    } as const);

  vi.doMock("../../src/services/supabaseClient", () => ({
    hasSupabaseAdmin: options.hasSupabaseAdmin ?? true,
    supabaseAdmin,
  }));

  const { coreDataRouter } = await import("../../src/routes/coreDataRoutes");
  const app = express();
  app.use(express.json());
  app.use("/data", coreDataRouter);

  return { app, createUser, updateUserById, deleteUser };
}

const genericResourceConfigs = [
  {
    path: "customers",
    table: "customers",
    id: CUSTOMER_ID,
    createPayload: {
      userId: USER_ID,
      company: "Acme Co",
      contactInfo: { email: "customer@example.com" },
    },
    invalidPayload: {
      userId: "not-a-uuid",
      company: "Acme Co",
    },
    updatePayload: {
      company: "Renamed Co",
    },
    dbRow: {
      id: CUSTOMER_ID,
      user_id: USER_ID,
      company: "Acme Co",
      contact_info: { email: "customer@example.com" },
      created_at: CREATED_AT,
    },
    updatedRow: {
      id: CUSTOMER_ID,
      user_id: USER_ID,
      company: "Renamed Co",
      contact_info: { email: "customer@example.com" },
      created_at: CREATED_AT,
    },
  },
  {
    path: "cases",
    table: "cases",
    id: CASE_ID,
    createPayload: {
      customerId: CUSTOMER_ID,
      assignedTo: CSR_ID,
      title: "Broken router",
      description: "",
      status: "Open",
      priority: "High",
    },
    invalidPayload: {
      customerId: CUSTOMER_ID,
      assignedTo: "bad-id",
      title: "Broken router",
    },
    updatePayload: {
      assignedTo: null,
      status: "Resolved",
      priority: "Low",
    },
    dbRow: {
      id: CASE_ID,
      customer_id: CUSTOMER_ID,
      assigned_to: CSR_ID,
      title: "Broken router",
      description: "",
      status: "Open",
      priority: "High",
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    updatedRow: {
      id: CASE_ID,
      customer_id: CUSTOMER_ID,
      assigned_to: null,
      title: "Broken router",
      description: "",
      status: "Resolved",
      priority: "Low",
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
  },
  {
    path: "tags",
    table: "tags",
    id: TAG_ID,
    createPayload: {
      name: "VIP",
      color: "#ffaa00",
      affectsNodeColor: true,
    },
    invalidPayload: {
      name: 123,
    },
    updatePayload: {
      affectsNodeColor: false,
    },
    dbRow: {
      id: TAG_ID,
      name: "VIP",
      color: "#ffaa00",
      affects_node_color: true,
      created_at: CREATED_AT,
    },
    updatedRow: {
      id: TAG_ID,
      name: "VIP",
      color: "#ffaa00",
      affects_node_color: false,
      created_at: CREATED_AT,
    },
  },
  {
    path: "case-tags",
    table: "case_tags",
    id: CASE_ID_2,
    createPayload: {
      caseId: CASE_ID,
      tagId: TAG_ID,
    },
    invalidPayload: {
      caseId: CASE_ID,
    },
    updatePayload: {
      tagId: TAG_ID_2,
    },
    dbRow: {
      id: CASE_ID_2,
      case_id: CASE_ID,
      tag_id: TAG_ID,
      created_at: CREATED_AT,
    },
    updatedRow: {
      id: CASE_ID_2,
      case_id: CASE_ID,
      tag_id: TAG_ID_2,
      created_at: CREATED_AT,
    },
  },
  {
    path: "messages",
    table: "messages",
    id: MESSAGE_ID,
    createPayload: {
      caseId: CASE_ID,
      senderId: CSR_ID,
      senderRole: "CSR",
      messageType: "text",
      messageText: "",
    },
    invalidPayload: {
      caseId: CASE_ID,
      senderRole: "Support",
      messageText: "hello",
    },
    updatePayload: {
      senderId: null,
      messageType: "system",
      messageText: "Escalated",
    },
    dbRow: {
      id: MESSAGE_ID,
      case_id: CASE_ID,
      sender_id: CSR_ID,
      sender_role: "CSR",
      message_type: "text",
      message_text: "",
      created_at: CREATED_AT,
    },
    updatedRow: {
      id: MESSAGE_ID,
      case_id: CASE_ID,
      sender_id: null,
      sender_role: "CSR",
      message_type: "system",
      message_text: "Escalated",
      created_at: CREATED_AT,
    },
  },
  {
    path: "endorsements",
    table: "endorsements",
    id: ENDORSEMENT_ID,
    createPayload: {
      caseId: CASE_ID,
      endorsedBy: CSR_ID,
      endorsedTo: MANAGER_ID,
      status: "Pending",
    },
    invalidPayload: {
      caseId: CASE_ID,
      endorsedBy: CSR_ID,
      endorsedTo: "bad-id",
    },
    updatePayload: {
      status: "Accepted",
    },
    dbRow: {
      id: ENDORSEMENT_ID,
      case_id: CASE_ID,
      endorsed_by: CSR_ID,
      endorsed_to: MANAGER_ID,
      status: "Pending",
      created_at: CREATED_AT,
    },
    updatedRow: {
      id: ENDORSEMENT_ID,
      case_id: CASE_ID,
      endorsed_by: CSR_ID,
      endorsed_to: MANAGER_ID,
      status: "Accepted",
      created_at: CREATED_AT,
    },
  },
  {
    path: "notifications",
    table: "notifications",
    id: NOTIFICATION_ID,
    createPayload: {
      userId: NOTIFICATION_USER_ID,
      type: "case_message",
      message: "",
      read: false,
    },
    invalidPayload: {
      userId: NOTIFICATION_USER_ID,
      type: 5,
      message: "",
    },
    updatePayload: {
      read: true,
    },
    dbRow: {
      id: NOTIFICATION_ID,
      user_id: NOTIFICATION_USER_ID,
      type: "case_message",
      message: "",
      read: false,
      created_at: CREATED_AT,
    },
    updatedRow: {
      id: NOTIFICATION_ID,
      user_id: NOTIFICATION_USER_ID,
      type: "case_message",
      message: "",
      read: true,
      created_at: CREATED_AT,
    },
  },
] as const;

describe("coreDataRoutes coverage", () => {
  it("returns 500 when Supabase admin is unavailable", async () => {
    const { app } = await loadCoreDataApp({ hasSupabaseAdmin: false });

    const response = await request(app).get("/data/users").set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("lists users successfully", async () => {
    const { app } = await loadCoreDataApp({
      plan: {
        users: {
          list: ok([
            {
              id: USER_ID,
              email: "admin@example.com",
              name: "Admin User",
              role: "Admin",
              created_at: CREATED_AT,
            },
          ]),
        },
      },
    });

    const response = await request(app).get("/data/users").set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      data: [
        {
          id: USER_ID,
          email: "admin@example.com",
          role: "Admin",
        },
      ],
    });
  });

  it("rejects invalid user creation payloads", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "target@example.com",
        password: "short",
        role: "Customer",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("password must be at least 8 characters.");
  });

  it("returns sync-pending fallback when auth user is created but public row is missing", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID, email: "created@example.com" } },
      error: null,
    });
    const { app } = await loadCoreDataApp({
      createUser,
      plan: {
        users: {
          maybeSingle: ok(null),
        },
      },
    });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "created@example.com",
        password: "long-enough-password",
        role: "Customer",
        name: "Created User",
      });

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalled();
    expect(response.body).toMatchObject({
      status: "ok",
      message: "Auth user created. Public users row may still be syncing from auth metadata and manager assignment updates.",
      data: {
        id: USER_ID,
        email: "created@example.com",
        role: "Customer",
        name: "Created User",
      },
    });
  });

  it("creates a CSR with a valid manager assignment", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID, email: "csr@example.com" } },
      error: null,
    });
    const usersTable = createSequencedUsersTable({
      selectResults: [
        ok({
          id: MANAGER_ID,
          role: "Manager",
        }),
        ok({
          id: USER_ID,
          email: "csr@example.com",
          name: "CSR User",
          role: "CSR",
          manager_id: MANAGER_ID,
        }),
      ],
      updateResults: [
        ok({
          id: USER_ID,
          manager_id: MANAGER_ID,
        }),
      ],
    });
    const { app } = await loadCoreDataApp({
      createUser,
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser,
            updateUserById: vi.fn(),
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "csr@example.com",
        password: "long-enough-password",
        role: "CSR",
        name: "CSR User",
        managerId: MANAGER_ID,
      });

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      email: "csr@example.com",
      password: "long-enough-password",
      email_confirm: true,
      user_metadata: {
        role: "CSR",
        name: "CSR User",
      },
    });
    expect(response.body).toMatchObject({
      status: "ok",
      data: {
        id: USER_ID,
        email: "csr@example.com",
        role: "CSR",
        manager_id: MANAGER_ID,
      },
    });
  });

  it("rejects CSR creation with an invalid manager UUID", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "csr@example.com",
        password: "long-enough-password",
        role: "CSR",
        name: "CSR User",
        managerId: "not-a-uuid",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("managerId must be a valid UUID.");
  });

  it("rejects CSR creation when the manager user does not exist", async () => {
    const usersTable = createSequencedUsersTable({
      selectResults: [ok(null)],
    });
    const { app } = await loadCoreDataApp({
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById: vi.fn(),
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "csr@example.com",
        password: "long-enough-password",
        role: "CSR",
        name: "CSR User",
        managerId: MANAGER_ID,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("managerId must reference an existing Manager user.");
  });

  it("rejects CSR creation when the referenced manager is not a Manager role", async () => {
    const usersTable = createSequencedUsersTable({
      selectResults: [
        ok({
          id: MANAGER_ID,
          role: "Admin",
        }),
      ],
    });
    const { app } = await loadCoreDataApp({
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById: vi.fn(),
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "csr@example.com",
        password: "long-enough-password",
        role: "CSR",
        name: "CSR User",
        managerId: MANAGER_ID,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("managerId must reference a Manager user.");
  });

  it("rejects invalid user id on lookup", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .get("/data/users/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("id must be a valid UUID.");
  });

  it("returns 404 when user lookup misses", async () => {
    const { app } = await loadCoreDataApp({
      plan: {
        users: {
          maybeSingle: ok(null),
        },
      },
    });

    const response = await request(app)
      .get(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Record not found.");
  });

  it("returns 500 when generic record lookup fails", async () => {
    const { app } = await loadCoreDataApp({
      plan: {
        customers: {
          maybeSingle: {
            data: null,
            error: { message: "lookup failed" },
          },
        },
      },
    });

    const response = await request(app)
      .get(`/data/customers/${CUSTOMER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("lookup failed");
  });

  it("returns sync-pending fallback when user update succeeds but synced row is missing", async () => {
    const selectMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          id: USER_ID,
          email: "target@example.com",
          name: "Target User",
          role: "Customer",
        }),
      )
      .mockResolvedValueOnce(ok(null));
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    const supabaseAdmin = {
      from(table: string) {
        if (table === "users") {
          let updateMode = false;
          const builder = {
            select() {
              return builder;
            },
            update() {
              updateMode = true;
              return builder;
            },
            eq() {
              return builder;
            },
            maybeSingle() {
              if (updateMode) {
                updateMode = false;
                return Promise.resolve(ok(null));
              }
              return selectMaybeSingle();
            },
          };
          return builder;
        }

        return createSupabaseAdminMock({}).from(table);
      },
      auth: {
        admin: {
          createUser: vi.fn(),
          updateUserById,
          deleteUser: vi.fn(),
        },
      },
    };

    const { app } = await loadCoreDataApp({
      supabaseAdminOverride: supabaseAdmin,
      updateUserById,
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "updated@example.com",
        role: "Admin",
      });

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, {
      email: "updated@example.com",
      user_metadata: {
        role: "Admin",
        name: "Target User",
      },
    });
    expect(response.body).toMatchObject({
      status: "ok",
      message: "Auth user updated. Public users row may still be syncing from auth metadata and manager assignment updates.",
      data: {
        id: USER_ID,
        email: "updated@example.com",
        role: "Admin",
        name: "Target User",
      },
    });
  });

  it("clears CSR manager assignment when the role changes away from CSR", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    const usersTable = createSequencedUsersTable({
      selectResults: [
        ok({
          id: USER_ID,
          email: "csr@example.com",
          name: "CSR User",
          role: "CSR",
          manager_id: MANAGER_ID,
        }),
        ok({
          id: USER_ID,
          email: "csr@example.com",
          name: "CSR User",
          role: "Manager",
          manager_id: null,
        }),
      ],
      updateResults: [
        ok({
          id: USER_ID,
          email: "csr@example.com",
          name: "CSR User",
          role: "Manager",
          manager_id: null,
        }),
      ],
    });
    const { app } = await loadCoreDataApp({
      updateUserById,
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById,
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "Manager",
      });

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, {
      email: "csr@example.com",
      user_metadata: {
        role: "Manager",
        name: "CSR User",
      },
    });
    expect(response.body).toMatchObject({
      status: "ok",
      data: {
        id: USER_ID,
        role: "Manager",
        manager_id: null,
      },
    });
  });

  it("blocks self-demotion for admin users", async () => {
    const selfAdminToken = signTestJwt({
      sub: USER_ID,
      email: "admin@example.com",
      role: "Admin",
    });

    const { app, updateUserById } = await loadCoreDataApp({
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            email: "admin@example.com",
            name: "Admin User",
            role: "Admin",
          }),
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${selfAdminToken}`)
      .send({ role: "Manager" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Admin users cannot demote their own account.");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("blocks demotion of the last remaining admin", async () => {
    const { app, updateUserById } = await loadCoreDataApp({
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            email: "admin@example.com",
            name: "Admin User",
            role: "Admin",
          }),
          list: ok([{ id: USER_ID }]),
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Manager" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cannot demote the last remaining Admin account.");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("allows demotion when another admin account exists", async () => {
    const { app, updateUserById } = await loadCoreDataApp({
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            email: "admin@example.com",
            name: "Admin User",
            role: "Admin",
          }),
          list: ok([{ id: USER_ID }, { id: "550e8400-e29b-41d4-a716-446655440099" }]),
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Manager" });

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalled();
  });

  it("creates an additional admin account", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID, email: "new-admin@example.com" } },
      error: null,
    });
    const { app } = await loadCoreDataApp({
      createUser,
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            email: "new-admin@example.com",
            name: "New Admin",
            role: "Admin",
          }),
        },
      },
    });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "new-admin@example.com",
        password: "long-enough-password",
        role: "Admin",
        name: "New Admin",
      });

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      email: "new-admin@example.com",
      password: "long-enough-password",
      email_confirm: true,
      user_metadata: {
        role: "Admin",
        name: "New Admin",
      },
    });
    expect(response.body).toMatchObject({
      status: "ok",
      data: {
        id: USER_ID,
        email: "new-admin@example.com",
        role: "Admin",
        name: "New Admin",
      },
    });
  });

  it("promotes an existing user to admin", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    const usersTable = createSequencedUsersTable({
      selectResults: [
        ok({
          id: USER_ID,
          email: "promote@example.com",
          name: "Promote Me",
          role: "CSR",
          manager_id: MANAGER_ID,
        }),
        ok({
          id: USER_ID,
          email: "promote@example.com",
          name: "Promote Me",
          role: "Admin",
          manager_id: null,
        }),
      ],
      updateResults: [
        ok({
          id: USER_ID,
          email: "promote@example.com",
          name: "Promote Me",
          role: "Admin",
          manager_id: null,
        }),
      ],
    });
    const { app } = await loadCoreDataApp({
      updateUserById,
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById,
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "Admin",
      });

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, {
      email: "promote@example.com",
      user_metadata: {
        role: "Admin",
        name: "Promote Me",
      },
    });
    expect(response.body).toMatchObject({
      status: "ok",
      data: {
        id: USER_ID,
        role: "Admin",
        manager_id: null,
      },
    });
  });

  it("blocks self-delete for admin users", async () => {
    const selfAdminToken = signTestJwt({
      sub: USER_ID,
      email: "admin@example.com",
      role: "Admin",
    });

    const { app, deleteUser } = await loadCoreDataApp();
    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${selfAdminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Admin users cannot delete their own account.");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("blocks deletion of the last remaining admin", async () => {
    const { app, deleteUser } = await loadCoreDataApp({
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            role: "Admin",
          }),
          list: ok([{ id: USER_ID }]),
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cannot delete the last remaining Admin account.");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("allows deleting an admin when another admin account exists", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const { app } = await loadCoreDataApp({
      deleteUser,
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            role: "Admin",
          }),
          list: ok([{ id: USER_ID }, { id: "550e8400-e29b-41d4-a716-446655440099" }]),
          delete: ok(null),
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("returns fallback when auth delete succeeds and public row was already removed", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const { app } = await loadCoreDataApp({
      deleteUser,
      plan: {
        users: {
          delete: ok(null),
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(response.body).toMatchObject({
      status: "ok",
      authUserDeleted: true,
      data: {
        id: USER_ID,
      },
      message: "Auth user deleted. Public users row was already removed by trigger.",
    });
  });

  it("returns 500 when the public user row deletion fails after auth delete succeeds", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const { app } = await loadCoreDataApp({
      deleteUser,
      plan: {
        users: {
          delete: {
            data: null,
            error: { message: "public row delete failed" },
          },
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("public row delete failed");
  });

  it("returns 500 when counting admin users fails during admin deletion", async () => {
    const usersTable = createSequencedUsersTable({
      selectResults: [ok({ id: USER_ID, role: "Admin" }), { data: null, error: { message: "count failed" } }],
    });

    const { app } = await loadCoreDataApp({
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById: vi.fn(),
            deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
          },
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("count failed");
  });

  it("returns 500 when looking up a user to delete fails", async () => {
    const usersTable = createSequencedUsersTable({
      selectResults: [{ data: null, error: { message: "lookup failed" } }],
    });

    const { app } = await loadCoreDataApp({
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById: vi.fn(),
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("lookup failed");
  });

  it.each(genericResourceConfigs)("covers generic resource GET list routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          list: ok([resource.dbRow]),
        },
      },
    });

    const response = await request(app)
      .get(`/data/${resource.path}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      data: [resource.dbRow],
    });
  });

  it.each(genericResourceConfigs)("covers generic resource GET by id success routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          maybeSingle: ok(resource.dbRow),
        },
      },
    });

    const response = await request(app)
      .get(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      data: resource.dbRow,
    });
  });

  it.each(genericResourceConfigs)("covers generic resource GET list error routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          list: {
            data: null,
            error: { message: "list failed" },
          },
        },
      },
    });

    const response = await request(app)
      .get(`/data/${resource.path}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("list failed");
  });

  it.each(genericResourceConfigs)("covers generic resource POST success routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          single: ok(resource.dbRow),
        },
      },
    });

    const response = await request(app)
      .post(`/data/${resource.path}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(resource.createPayload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "ok",
      data: resource.dbRow,
    });
  });

  it.each(genericResourceConfigs)(
    "rejects non-JSON request bodies for generic resource POST routes for $path",
    async (resource) => {
      const { app } = await loadCoreDataApp();

      const response = await request(app)
        .post(`/data/${resource.path}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "text/plain")
        .send("hello");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Request body must be a JSON object.");
    },
  );

  it.each(genericResourceConfigs)("covers generic resource POST error routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          single: {
            data: null,
            error: { message: "insert failed" },
          },
        },
      },
    });

    const response = await request(app)
      .post(`/data/${resource.path}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(resource.createPayload);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("insert failed");
  });

  it.each(genericResourceConfigs)(
    "covers generic resource POST validation failures for $path",
    async (resource) => {
      const { app } = await loadCoreDataApp();

      const response = await request(app)
        .post(`/data/${resource.path}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(resource.invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
    },
  );

  it("covers generic resource GET by id not-found path", async () => {
    const { app } = await loadCoreDataApp({
      plan: {
        customers: {
          maybeSingle: ok(null),
        },
      },
    });

    const response = await request(app)
      .get(`/data/customers/${CUSTOMER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Record not found.");
  });

  it("rejects invalid UUIDs when reading generic resources by id", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .get("/data/customers/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("id must be a valid UUID.");
  });

  it.each(genericResourceConfigs)("covers generic resource PATCH success routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          update: ok(resource.updatedRow),
        },
      },
    });

    const response = await request(app)
      .patch(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(resource.updatePayload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      data: resource.updatedRow,
    });
  });

  it("covers generic resource PATCH validation failure for customers", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .patch(`/data/customers/${CUSTOMER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        company: 123,
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
  });

  it("rejects non-object PATCH bodies for generic resources", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .patch(`/data/cases/${CASE_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send([]);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Request body must be a JSON object.");
  });

  it("rejects invalid UUIDs when patching generic resources", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .patch("/data/cases/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "Resolved",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("id must be a valid UUID.");
  });

  it.each(genericResourceConfigs)("covers generic resource PATCH validation failures for $path", async (resource) => {
    const { app } = await loadCoreDataApp();
    const invalidPayload =
      resource.path === "case-tags"
        ? {
            caseId: CASE_ID,
            tagId: "not-a-uuid",
          }
        : resource.invalidPayload;

    const response = await request(app)
      .patch(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(invalidPayload);

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
  });

  it.each(genericResourceConfigs)("covers generic resource PATCH not-found routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          update: ok(null),
        },
      },
    });

    const response = await request(app)
      .patch(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(resource.updatePayload);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Record not found.");
  });

  it.each(genericResourceConfigs)("covers generic resource PATCH error routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          update: {
            data: null,
            error: { message: "update failed" },
          },
        },
      },
    });

    const response = await request(app)
      .patch(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(resource.updatePayload);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("update failed");
  });

  it.each(genericResourceConfigs)("covers generic resource DELETE success routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          delete: ok(resource.dbRow),
        },
      },
    });

    const response = await request(app)
      .delete(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      data: resource.dbRow,
    });
  });

  it("covers generic resource POST success routes with minimal optional fields", async () => {
    const minimalResources = [
      {
        path: "customers",
        table: "customers",
        payload: {
          userId: USER_ID,
          company: "Acme Co",
        },
        row: {
          id: CUSTOMER_ID,
          user_id: USER_ID,
          company: "Acme Co",
          created_at: CREATED_AT,
        },
      },
      {
        path: "cases",
        table: "cases",
        payload: {
          customerId: CUSTOMER_ID,
          title: "Broken router",
        },
        row: {
          id: CASE_ID,
          customer_id: CUSTOMER_ID,
          title: "Broken router",
          created_at: CREATED_AT,
          updated_at: UPDATED_AT,
        },
      },
      {
        path: "tags",
        table: "tags",
        payload: {
          name: "VIP",
        },
        row: {
          id: TAG_ID,
          name: "VIP",
          created_at: CREATED_AT,
        },
      },
      {
        path: "messages",
        table: "messages",
        payload: {
          caseId: CASE_ID,
          senderRole: "CSR",
          messageText: "Hello",
        },
        row: {
          id: MESSAGE_ID,
          case_id: CASE_ID,
          sender_id: null,
          sender_role: "CSR",
          message_type: "text",
          message_text: "Hello",
          created_at: CREATED_AT,
        },
      },
      {
        path: "endorsements",
        table: "endorsements",
        payload: {
          caseId: CASE_ID,
          endorsedBy: CSR_ID,
          endorsedTo: MANAGER_ID,
        },
        row: {
          id: ENDORSEMENT_ID,
          case_id: CASE_ID,
          endorsed_by: CSR_ID,
          endorsed_to: MANAGER_ID,
          created_at: CREATED_AT,
        },
      },
      {
        path: "notifications",
        table: "notifications",
        payload: {
          userId: NOTIFICATION_USER_ID,
          type: "case_message",
          message: "Hello",
        },
        row: {
          id: NOTIFICATION_ID,
          user_id: NOTIFICATION_USER_ID,
          type: "case_message",
          message: "Hello",
          created_at: CREATED_AT,
        },
      },
    ] as const;

    for (const resource of minimalResources) {
      const { app } = await loadCoreDataApp({
        plan: {
          [resource.table]: {
            single: ok(resource.row),
          },
        },
      });

      const response = await request(app)
        .post(`/data/${resource.path}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(resource.payload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: "ok",
        data: resource.row,
      });
    }
  });

  it("rejects invalid UUIDs when deleting generic resources", async () => {
    const { app } = await loadCoreDataApp();

    const response = await request(app)
      .delete("/data/tags/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("id must be a valid UUID.");
  });

  it.each(genericResourceConfigs)("covers generic resource DELETE not-found routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          delete: ok(null),
        },
      },
    });

    const response = await request(app)
      .delete(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Record not found.");
  });

  it.each(genericResourceConfigs)("covers generic resource DELETE error routes for $path", async (resource) => {
    const { app } = await loadCoreDataApp({
      plan: {
        [resource.table]: {
          delete: {
            data: null,
            error: { message: "delete failed" },
          },
        },
      },
    });

    const response = await request(app)
      .delete(`/data/${resource.path}/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("delete failed");
  });

  it("covers generic resource DELETE not-found and error paths for customers", async () => {
    const notFoundApp = await loadCoreDataApp({
      plan: {
        customers: {
          delete: ok(null),
        },
      },
    });

    const notFoundResponse = await request(notFoundApp.app)
      .delete(`/data/customers/${CUSTOMER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.body.message).toBe("Record not found.");

    const errorApp = await loadCoreDataApp({
      plan: {
        customers: {
          delete: {
            data: null,
            error: { message: "delete failed" },
          },
        },
      },
    });

    const errorResponse = await request(errorApp.app)
      .delete(`/data/customers/${CUSTOMER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(errorResponse.status).toBe(400);
    expect(errorResponse.body.message).toBe("delete failed");
  });

  it("returns 400 when auth user creation fails", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "create failed" },
    });
    const { app } = await loadCoreDataApp({ createUser });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "created@example.com",
        password: "long-enough-password",
        role: "Customer",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("create failed");
  });

  it("returns 500 when persisting a CSR manager assignment fails", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: USER_ID, email: "csr@example.com" } },
      error: null,
    });
    const usersTable = createSequencedUsersTable({
      selectResults: [
        ok({ id: MANAGER_ID, role: "Manager" }),
        {
          data: null,
          error: { message: "persist failed" },
        } as ReturnType<typeof ok>,
      ],
    });
    const { app } = await loadCoreDataApp({
      createUser,
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return usersTable;
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser,
            updateUserById: vi.fn(),
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .post("/data/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "csr@example.com",
        password: "long-enough-password",
        role: "CSR",
        name: "CSR User",
        managerId: MANAGER_ID,
      });

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("failed to persist manager assignment");
  });

  it("returns 500 when user lookup fails during update", async () => {
    const { app } = await loadCoreDataApp({
      supabaseAdminOverride: {
        from(table: string) {
          if (table === "users") {
            return {
              select() {
                return this;
              },
              update() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle() {
                return Promise.resolve({
                  data: null,
                  error: { message: "lookup failed" },
                });
              },
            };
          }

          return createSupabaseAdminMock({}).from(table);
        },
        auth: {
          admin: {
            createUser: vi.fn(),
            updateUserById: vi.fn(),
            deleteUser: vi.fn(),
          },
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "updated@example.com",
      });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("lookup failed");
  });

  it("returns 400 when auth user update fails", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "update failed" },
    });
    const { app } = await loadCoreDataApp({
      updateUserById,
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            email: "target@example.com",
            name: "Target User",
            role: "Customer",
          }),
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "updated@example.com",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("update failed");
  });

  it("returns 500 when admin counts cannot be loaded during demotion", async () => {
    const { app } = await loadCoreDataApp({
      plan: {
        users: {
          maybeSingle: ok({
            id: USER_ID,
            email: "admin@example.com",
            name: "Admin User",
            role: "Admin",
          }),
          list: {
            data: null,
            error: { message: "count failed" },
          },
        },
      },
    });

    const response = await request(app)
      .patch(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Manager" });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("count failed");
  });

  it("returns 400 when auth user deletion fails", async () => {
    const deleteUser = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "delete failed" },
    });
    const { app } = await loadCoreDataApp({
      deleteUser,
      plan: {
        users: {
          delete: ok({ id: USER_ID, role: "Customer" }),
        },
      },
    });

    const response = await request(app)
      .delete(`/data/users/${USER_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("delete failed");
  });
});
