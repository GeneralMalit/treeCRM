import { RoleDashboard } from "@/components/RoleDashboard";

export default function EmployeeCsrPage() {
  return (
    <RoleDashboard
      allowedRoles={["CSR"]}
      title="CSR Workspace"
      description="CSR operations placeholder for Session 2."
    />
  );
}
