import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminTag,
  createAdminUser,
  deleteAdminTag,
  deleteAdminUser,
  fetchAdminSettings,
  fetchAdminTags,
  fetchAdminUsers,
  updateAdminSettings,
  updateAdminTag,
  updateAdminUser,
} from "@/lib/adminPanel";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adminPanel client", () => {
  it("parses manager assignment from admin users list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        data: [
          {
            id: "user-1",
            email: "csr@example.com",
            name: "CSR One",
            role: "CSR",
            manager_id: "manager-1",
            created_at: "2026-03-01T00:00:00.000Z",
          },
          {
            id: "user-2",
            email: "manager@example.com",
            name: "Manager One",
            role: "Manager",
            manager_id: null,
            created_at: "2026-03-01T00:00:00.000Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const users = await fetchAdminUsers("token-1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/data/users", expect.any(Object));
    expect(users).toEqual([
      {
        id: "user-1",
        email: "csr@example.com",
        name: "CSR One",
        role: "CSR",
        managerId: "manager-1",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "user-2",
        email: "manager@example.com",
        name: "Manager One",
        role: "Manager",
        managerId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
  });

  it("sends managerId when creating users", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createAdminUser("token-1", {
      email: "csr@example.com",
      password: "password123",
      role: "CSR",
      managerId: "manager-1",
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.method).toBe("POST");
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      email: "csr@example.com",
      role: "CSR",
      managerId: "manager-1",
    });
  });

  it("serializes null managerId on updates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateAdminUser("token-1", "user-1", {
      role: "Manager",
      managerId: null,
    });

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/data/users/user-1");
    expect(requestInit.method).toBe("PATCH");
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      role: "Manager",
      managerId: null,
    });
  });

  it("parses tags and settings and falls back on partial style values", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        data: [
          { id: "tag-1", name: "VIP", color: "#ff0", affects_node_color: true },
          { id: "tag-2", name: "Low", color: "#f00", affects_node_color: false },
        ],
      }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        data: {
          settings: {
            availabilityRefreshMinutes: 14.6,
            defaultCasePriority: "High",
            priorityStyleMap: {
              High: { label: " Rush ", color: " #f00 ", background: " #fee " },
              Medium: { label: "", color: "", background: "" },
            },
          },
        },
      }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok", data: { settings: { availabilityRefreshMinutes: 30, defaultCasePriority: "Low", priorityStyleMap: { High: { label: "H", color: "#a", background: "#b" }, Medium: { label: "M", color: "#c", background: "#d" }, Low: { label: "L", color: "#e", background: "#f" } } } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdminTags("token-1")).resolves.toEqual([
      { id: "tag-1", name: "VIP", color: "#ff0", affectsNodeColor: true },
      { id: "tag-2", name: "Low", color: "#f00", affectsNodeColor: false },
    ]);

    await expect(fetchAdminSettings("token-1")).resolves.toEqual({
      availabilityRefreshMinutes: 15,
      defaultCasePriority: "High",
      priorityStyleMap: {
        High: { label: "Rush", color: "#f00", background: "#fee" },
        Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
        Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
      },
    });

    await expect(updateAdminSettings("token-1", { availabilityRefreshMinutes: 30 })).resolves.toEqual({
      availabilityRefreshMinutes: 30,
      defaultCasePriority: "Low",
      priorityStyleMap: {
        High: { label: "H", color: "#a", background: "#b" },
        Medium: { label: "M", color: "#c", background: "#d" },
        Low: { label: "L", color: "#e", background: "#f" },
      },
    });
  });

  it("sends tag mutations and surfaces request failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: "Nope" }) });
    vi.stubGlobal("fetch", fetchMock);

    await createAdminTag("token-1", { name: "VIP", color: "#ff0", affectsNodeColor: true });
    await updateAdminTag("token-1", "tag-1", { name: "Updated", affectsNodeColor: false });
    await deleteAdminTag("token-1", "tag-1");

    const createCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(createCall[0]).toBe("http://localhost:4000/data/tags");
    expect(createCall[1].method).toBe("POST");
    expect(JSON.parse(String(createCall[1].body))).toMatchObject({ name: "VIP" });

    await expect(deleteAdminUser("token-1", "user-1")).rejects.toThrow("Nope");
  });

  it("rejects malformed admin payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ok",
          data: [
            {
              id: "bad",
              email: "user@example.com",
              name: "User",
              role: "NotARole",
              manager_id: null,
              created_at: "2026-03-01T00:00:00.000Z",
            },
          ],
        }),
      }),
    );

    await expect(fetchAdminUsers("token-1")).rejects.toThrow("Unexpected admin user payload format.");
  });
});
