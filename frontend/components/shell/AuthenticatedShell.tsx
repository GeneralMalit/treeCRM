"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", backgroundColor: "#f6f8fb" }}>
      <ShellSidebar role={role} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} currentPath={pathname} />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <ShellTopbar title={title} subtitle={subtitle} actions={actions} onMenuClick={() => setMobileNavOpen(true)} />
        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, lg: 3.5 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
