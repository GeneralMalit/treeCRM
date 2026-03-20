import type { Role } from "./roles";

export type ShellNavItem = {
  label: string;
  href: string;
  description?: string;
};

export type RoleShellNavMap = Record<Role, ShellNavItem[]>;

export const ROLE_SHELL_NAV: RoleShellNavMap = {
  Admin: [
    { label: "Overview", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: "Tags", href: "/admin/tags" },
    { label: "Settings", href: "/admin/settings" },
  ],
  CSR: [
    { label: "Workspace", href: "/employee/csr/workspace" },
    { label: "Messages", href: "/employee/csr/messages" },
  ],
  Manager: [
    { label: "Overview", href: "/employee/manager/overview" },
    { label: "Workspace", href: "/employee/manager/workspace" },
    { label: "Messages", href: "/employee/manager/messages" },
  ],
  Executive: [
    { label: "Overview", href: "/employee/executive/overview" },
    { label: "Workspace", href: "/employee/executive/workspace" },
    { label: "Messages", href: "/employee/executive/messages" },
  ],
  Customer: [{ label: "Tickets", href: "/portal" }],
};

export function isShellNavActive(currentPath: string, href: string): boolean {
  if (href === "/") {
    return currentPath === href;
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}
