export const ROLES = ["CSR", "Manager", "Executive", "Admin", "Customer"] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "Customer";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
