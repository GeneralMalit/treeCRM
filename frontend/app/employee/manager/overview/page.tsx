"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeOverviewPage } from "@/components/employee/EmployeeOverviewPage";

export default function ManagerOverviewRoute() {
  return (
    <AuthenticatedShell role="Manager" title="Manager" subtitle="Overview">
      <EmployeeOverviewPage
        role="Manager"
        title="Overview"
        description="Track manager workload, direct CSR coverage, and key team metrics."
        workspaceHref="/employee/manager/workspace"
        messagesHref="/employee/manager/messages"
      />
    </AuthenticatedShell>
  );
}
