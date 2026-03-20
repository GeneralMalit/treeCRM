"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeOverviewPage } from "@/components/employee/EmployeeOverviewPage";

export default function ExecutiveOverviewRoute() {
  return (
    <AuthenticatedShell role="Executive" title="Executive" subtitle="Overview">
      <EmployeeOverviewPage
        role="Executive"
        title="Overview"
        description="Review manager coverage, executive-level aggregates, and broad support health."
        workspaceHref="/employee/executive/workspace"
        messagesHref="/employee/executive/messages"
      />
    </AuthenticatedShell>
  );
}
