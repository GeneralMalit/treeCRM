"use client";

import Link from "next/link";
import { Box, Button, Divider, Drawer, Stack, Typography } from "@mui/material";
import type { Role } from "@/lib/roles";
import { ROLE_SHELL_NAV, isShellNavActive } from "@/lib/shellNav";
import { BrandMark } from "@/components/BrandMark";

type ShellSidebarProps = {
  role: Role;
  open: boolean;
  onClose: () => void;
  currentPath: string;
};

export function ShellSidebar({ role, open, onClose, currentPath }: ShellSidebarProps) {
  const navItems = ROLE_SHELL_NAV[role];

  const content = (
    <Stack spacing={2.25} sx={{ width: 276, p: 2.25, height: "100%" }}>
      <Stack spacing={1}>
        <BrandMark compact />
        <Box
          sx={{
            alignSelf: "flex-start",
            px: 1,
            py: 0.45,
            borderRadius: 1,
            color: "#0f5132",
            bgcolor: "#e8f6ef",
            border: "1px solid rgba(15, 107, 69, 0.16)",
          }}
        >
          <Typography variant="caption" fontWeight={900}>
            {role} workspace
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <Stack spacing={0.55}>
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
                borderRadius: 1.25,
                textTransform: "none",
                px: 1.35,
                py: 1.05,
                color: active ? "#ffffff" : "#334155",
                fontWeight: active ? 900 : 760,
                "&:hover": {
                  bgcolor: active ? "#0f5132" : "rgba(15, 107, 69, 0.06)",
                },
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
          width: 276,
          flexShrink: 0,
          borderRight: "1px solid rgba(100, 116, 139, 0.18)",
          backgroundColor: "#ffffff",
        }}
      >
        {content}
      </Box>
      <Drawer
        open={open}
        onClose={onClose}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { borderRight: "1px solid rgba(100, 116, 139, 0.18)" } }}
      >
        {content}
      </Drawer>
    </>
  );
}
