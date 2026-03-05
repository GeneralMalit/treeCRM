import { RoleDashboard } from "@/components/RoleDashboard";

export default function EmployeeManagerPage() {
  return (
    <RoleDashboard
      allowedRoles={["Manager"]}
      title="Manager Workspace"
      description="Manager team view placeholder for Session 2."
    />
  );
}
