"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeTreeWorkspace } from "@/components/EmployeeTreeWorkspace";

export default function ManagerWorkspaceRoute() {
  return (
    <AuthenticatedShell role="Manager" title="Manager" subtitle="Workspace">
      <EmployeeTreeWorkspace
        allowedRoles={["Manager"]}
        title="Manager Workspace"
        description="A focused workspace for supervising CSRs and reviewing escalations."
      />
    </AuthenticatedShell>
  );
}
