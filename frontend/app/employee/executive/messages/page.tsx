"use client";

import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { EmployeeMessagesPage } from "@/components/employee/EmployeeMessagesPage";

export default function ExecutiveMessagesRoute() {
  return (
    <AuthenticatedShell role="Executive" title="Executive" subtitle="Messages">
      <EmployeeMessagesPage
        role="Executive"
        title="Messages"
        description="Send internal messages without crowding the operational workspace."
      />
    </AuthenticatedShell>
  );
}
