import { describe, expect, it } from "vitest";
import { createSupabaseAdminMock, createSupabaseAuthMock, ok } from "./mockSupabase";

describe("mockSupabase", () => {
  it("covers the admin builder action branches and auth defaults", async () => {
    const admin = createSupabaseAdminMock({
      widgets: {
        list: ok([{ id: "list" }]),
        maybeSingle: ok({ id: "single" }),
        single: ok({ id: "single-row" }),
        update: ok({ id: "updated" }),
        delete: ok({ id: "deleted" }),
      },
    });

    await expect(admin.from("widgets")).resolves.toEqual({ data: [{ id: "list" }], error: null });
    await expect(admin.from("widgets").select()).resolves.toEqual({ data: [{ id: "list" }], error: null });
    await expect(admin.from("widgets").maybeSingle()).resolves.toEqual({ data: { id: "single" }, error: null });
    await expect(admin.from("widgets").single()).resolves.toEqual({ data: { id: "single-row" }, error: null });
    await expect(admin.from("widgets").update().maybeSingle()).resolves.toEqual({ data: { id: "updated" }, error: null });
    await expect(admin.from("widgets").update().single()).resolves.toEqual({ data: { id: "updated" }, error: null });
    await expect(admin.from("widgets").delete().maybeSingle()).resolves.toEqual({ data: { id: "deleted" }, error: null });
    await expect(admin.from("widgets").delete().single()).resolves.toEqual({ data: { id: "deleted" }, error: null });
    await expect(admin.from("widgets").update().then((result) => result)).resolves.toEqual({
      data: { id: "updated" },
      error: null,
    });
    await expect(admin.from("widgets").delete().then((result) => result)).resolves.toEqual({
      data: { id: "deleted" },
      error: null,
    });

    const auth = createSupabaseAuthMock();
    await expect(auth.auth.signUp()).resolves.toEqual({ data: null, error: null });
    await expect(auth.auth.signInWithPassword()).resolves.toEqual({ data: null, error: null });

    const authWithValues = createSupabaseAuthMock({
      signUp: ok({ user: { id: "user-1" } }),
      signInWithPassword: ok({ user: { id: "user-2" } }),
    });
    await expect(authWithValues.auth.signUp()).resolves.toEqual({ data: { user: { id: "user-1" } }, error: null });
    await expect(authWithValues.auth.signInWithPassword()).resolves.toEqual({
      data: { user: { id: "user-2" } },
      error: null,
    });
  });
});
