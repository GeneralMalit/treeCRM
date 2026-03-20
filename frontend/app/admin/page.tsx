"use client";

import Link from "next/link";
import { Button, Stack, Typography } from "@mui/material";
import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import { useAdminPanel } from "@/components/admin/useAdminPanel";

export default function AdminPage() {
  const { data, error, loadingData, refresh } = useAdminPanel();

  const users = data?.users ?? [];
  const tags = data?.tags ?? [];
  const stats = data
    ? [
        { label: "Total users", value: String(users.length), detail: "All active accounts" },
        {
          label: "Employees",
          value: String(users.filter((user) => user.role === "CSR" || user.role === "Manager" || user.role === "Executive").length),
          detail: "CSR, manager, and executive roles",
        },
        { label: "Admins", value: String(users.filter((user) => user.role === "Admin").length), detail: "Privileged accounts" },
        { label: "Tags", value: String(tags.length), detail: "Reusable labels" },
      ]
    : [];

  return (
    <AuthenticatedShell role="Admin" title="Admin" subtitle="Overview">
      <Stack spacing={3}>
        <ShellPageHeader
          title="Overview"
          description="A short entry point for admin work. Use the dedicated sections for users, tags, and settings."
          actions={
            <>
              <Button variant="outlined" onClick={() => void refresh()} disabled={loadingData}>
                {loadingData ? "Refreshing" : "Refresh"}
              </Button>
            </>
          }
        />

        {error ? (
          <ShellSection>
            <Typography color="error">{error}</Typography>
          </ShellSection>
        ) : null}

        {data ? <ShellStatStrip items={stats} /> : null}

        <ShellSection>
          <Stack spacing={1}>
            <Typography variant="h6" fontWeight={700}>
              Shortcuts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Jump directly into the section you need without opening a giant workspace view.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} flexWrap="wrap" sx={{ pt: 1 }}>
              <Button component={Link} href="/admin/users" variant="contained">
                Manage users
              </Button>
              <Button component={Link} href="/admin/tags" variant="outlined">
                Manage tags
              </Button>
              <Button component={Link} href="/admin/settings" variant="outlined">
                Edit settings
              </Button>
            </Stack>
          </Stack>
        </ShellSection>
      </Stack>
    </AuthenticatedShell>
  );
}
