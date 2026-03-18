import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminUser, fetchAdminUsers, updateAdminUser } from "@/lib/adminPanel";

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
});
