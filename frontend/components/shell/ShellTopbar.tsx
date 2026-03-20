"use client";

import { AppBar, Box, Button, IconButton, Stack, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";

type ShellTopbarProps = {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  actions?: ReactNode;
};

export function ShellTopbar({ title, subtitle, onMenuClick, actions }: ShellTopbarProps) {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: "rgba(255,255,255,0.92)",
        color: "text.primary",
        borderBottom: "1px solid rgba(148, 163, 184, 0.28)",
        backdropFilter: "blur(16px)",
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 2 }}>
        {onMenuClick ? (
          <IconButton edge="start" onClick={onMenuClick} sx={{ display: { md: "none" } }}>
            <Box
              aria-hidden
              sx={{
                width: 18,
                height: 12,
                display: "grid",
                gap: 0.45,
                "&::before, &::after, & > span": {
                  content: '""',
                  display: "block",
                  height: 2,
                  borderRadius: 999,
                  backgroundColor: "currentColor",
                },
                "&::before": {
                  width: "100%",
                },
                "&::after": {
                  width: "80%",
                },
              }}
            >
              <Box component="span" sx={{ width: "65%" }} />
            </Box>
          </IconButton>
        ) : null}
        <Stack spacing={0.1} sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {actions ? <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{actions}</Box> : null}
        <Button variant="outlined" size="small" href="/login" sx={{ ml: 1 }}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}
