"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeMessagesPage } from "@/components/employee/EmployeeMessagesPage";

export default function ManagerMessagesRoute() {
  return (
    <AuthenticatedShell role="Manager" title="Manager" subtitle="Messages">
      <EmployeeMessagesPage
        role="Manager"
        title="Messages"
        description="Chat with approved internal peers without mixing it into the workspace."
      />
    </AuthenticatedShell>
  );
}
