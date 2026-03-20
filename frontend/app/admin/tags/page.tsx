"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { AdminTagsPage } from "@/components/admin/AdminTagsPage";

export default function AdminTagsRoute() {
  return (
    <AuthenticatedShell role="Admin" title="Admin" subtitle="Tags">
      <AdminTagsPage />
    </AuthenticatedShell>
  );
}
