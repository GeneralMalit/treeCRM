import { EmployeeTreeWorkspace } from "@/components/EmployeeTreeWorkspace";

export default function EmployeeManagerPage() {
  return (
    <EmployeeTreeWorkspace
      allowedRoles={["Manager"]}
      title="Manager Tree Workspace"
      description="Inspect employee workloads and drill into customer cases from the hierarchy."
    />
  );
}
