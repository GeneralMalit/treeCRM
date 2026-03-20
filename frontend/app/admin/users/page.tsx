"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export default function AdminUsersRoute() {
  return (
    <AuthenticatedShell role="Admin" title="Admin" subtitle="Users">
      <AdminUsersPage />
    </AuthenticatedShell>
  );
}
