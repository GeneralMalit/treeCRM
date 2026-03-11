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
      message: "Auth user created. Public users row may still be syncing from auth metadata.",
      data: {
        id: USER_ID,
        email: "created@example.com",
        role: "Customer",
        name: "Created User",
      },
    });
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

  it("returns sync-pending fallback when user update succeeds but synced row is missing", async () => {
    const maybeSingle = vi
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
          const builder = {
            select() {
              return builder;
            },
            eq() {
              return builder;
            },
            maybeSingle,
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
      message: "Auth user updated. Public users row may still be syncing from auth metadata.",
      data: {
        id: USER_ID,
        email: "updated@example.com",
        role: "Admin",
        name: "Target User",
      },
    });
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
});
