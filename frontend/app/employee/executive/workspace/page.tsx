"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeTreeWorkspace } from "@/components/EmployeeTreeWorkspace";

export default function ExecutiveWorkspaceRoute() {
  return (
    <AuthenticatedShell role="Executive" title="Executive" subtitle="Workspace">
      <EmployeeTreeWorkspace
        allowedRoles={["Executive"]}
        title="Executive Workspace"
        description="A focused workspace for drilling into manager teams and escalations."
      />
    </AuthenticatedShell>
  );
}
