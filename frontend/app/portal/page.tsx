import { RoleDashboard } from "@/components/RoleDashboard";

export default function PortalPage() {
  return (
    <RoleDashboard
      allowedRoles={["Customer"]}
      title="Customer Portal"
      description="Customer ticket dashboard placeholder for Session 2."
    />
  );
}
