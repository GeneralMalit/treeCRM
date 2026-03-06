import { EmployeeTreeWorkspace } from "@/components/EmployeeTreeWorkspace";

export default function EmployeeExecutivePage() {
  return (
    <EmployeeTreeWorkspace
      allowedRoles={["Executive"]}
      title="Executive Tree Workspace"
      description="View the organization hierarchy and monitor active case distribution."
    />
  );
}
