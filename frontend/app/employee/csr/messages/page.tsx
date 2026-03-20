"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeMessagesPage } from "@/components/employee/EmployeeMessagesPage";

export default function CsrMessagesRoute() {
  return (
    <AuthenticatedShell role="CSR" title="CSR" subtitle="Messages">
      <EmployeeMessagesPage
        role="CSR"
        title="Messages"
        description="Keep direct employee chat separate from the case workspace."
      />
    </AuthenticatedShell>
  );
}
