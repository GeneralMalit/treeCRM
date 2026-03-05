import { RoleDashboard } from "@/components/RoleDashboard";

export default function EmployeeExecutivePage() {
  return (
    <RoleDashboard
      allowedRoles={["Executive"]}
      title="Executive Workspace"
      description="Executive oversight placeholder for Session 2."
    />
  );
}
