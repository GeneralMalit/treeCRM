import { RoleDashboard } from "@/components/RoleDashboard";

export default function AdminPage() {
  return (
    <RoleDashboard
      allowedRoles={["Admin"]}
      title="Admin Workspace"
      description="Admin control center placeholder for Session 2."
    />
  );
}
