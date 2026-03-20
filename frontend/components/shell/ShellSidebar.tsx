"use client";

import Link from "next/link";
import { Box, Button, Divider, Drawer, Stack, Typography } from "@mui/material";
import type { Role } from "@/lib/roles";
import { ROLE_SHELL_NAV, isShellNavActive } from "@/lib/shellNav";

type ShellSidebarProps = {
  role: Role;
  open: boolean;
  onClose: () => void;
  currentPath: string;
};

export function ShellSidebar({ role, open, onClose, currentPath }: ShellSidebarProps) {
  const navItems = ROLE_SHELL_NAV[role];

  const content = (
    <Stack spacing={2} sx={{ width: 264, p: 2.5, height: "100%" }}>
      <Box>
        <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.03em" }}>
          TreeCRM
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {role}
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={1}>
        {navItems.map((item) => {
          const active = isShellNavActive(currentPath, item.href);
          return (
            <Button
              key={item.href}
              component={Link}
              href={item.href}
              onClick={onClose}
              variant={active ? "contained" : "text"}
              color={active ? "primary" : "inherit"}
              sx={{
                justifyContent: "flex-start",
                borderRadius: 2,
                textTransform: "none",
                px: 1.5,
                py: 1,
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>
    </Stack>
  );

  return (
    <>
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          width: 264,
          flexShrink: 0,
          borderRight: "1px solid rgba(148, 163, 184, 0.28)",
          backgroundColor: "rgba(248, 250, 252, 0.92)",
        }}
      >
        {content}
      </Box>
      <Drawer open={open} onClose={onClose} variant="temporary">
        {content}
      </Drawer>
    </>
  );
}
