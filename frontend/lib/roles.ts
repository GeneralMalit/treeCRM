export const ROLES = ["CSR", "Manager", "Executive", "Admin", "Customer"] as const;

export type Role = (typeof ROLES)[number];

const roleRouteMap: Record<Role, string> = {
  Customer: "/portal",
  CSR: "/employee/csr",
  Manager: "/employee/manager",
  Executive: "/employee/executive",
  Admin: "/admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function getRouteForRole(role: Role): string {
  return roleRouteMap[role];
}
