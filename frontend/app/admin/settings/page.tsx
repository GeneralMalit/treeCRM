"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { AdminSettingsPage } from "@/components/admin/AdminSettingsPage";

export default function AdminSettingsRoute() {
  return (
    <AuthenticatedShell role="Admin" title="Admin" subtitle="Settings">
      <AdminSettingsPage />
    </AuthenticatedShell>
  );
}
