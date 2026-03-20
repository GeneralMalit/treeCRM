"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { ShellSidebar } from "./ShellSidebar";
import { ShellTopbar } from "./ShellTopbar";

type AuthenticatedShellProps = {
  role: Role;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function AuthenticatedShell({ role, title, subtitle, children, actions }: AuthenticatedShellProps) {
  const pathname = usePathname();

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", backgroundColor: "#f8fafc" }}>
      <ShellSidebar role={role} open={false} onClose={() => undefined} currentPath={pathname} />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <ShellTopbar title={title} subtitle={subtitle} actions={actions} />
        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, lg: 4 }, py: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
