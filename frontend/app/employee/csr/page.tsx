import { EmployeeTreeWorkspace } from "@/components/EmployeeTreeWorkspace";

export default function EmployeeCsrPage() {
  return (
    <EmployeeTreeWorkspace
      allowedRoles={["CSR"]}
      title="CSR Tree Workspace"
      description="Manage assigned customers and cases through the employee tree."
    />
  );
}
