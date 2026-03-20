"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeTreeWorkspace } from "@/components/EmployeeTreeWorkspace";

export default function CsrWorkspacePage() {
  return (
    <AuthenticatedShell role="CSR" title="Workspace" subtitle="CSR">
      <EmployeeTreeWorkspace
        allowedRoles={["CSR"]}
        title="CSR Workspace"
        description="A focused workspace for assigned cases, escalation decisions, and customer conversation."
      />
    </AuthenticatedShell>
  );
}
