"use client";

import { AppBar, Box, Button, IconButton, Stack, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearStoredAccessToken, getStoredAccessToken, logout } from "@/lib/auth";

type ShellTopbarProps = {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  actions?: ReactNode;
};

export function ShellTopbar({ title, subtitle, onMenuClick, actions }: ShellTopbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    const accessToken = getStoredAccessToken();
    try {
      if (accessToken) {
        await logout(accessToken);
      }
    } finally {
      clearStoredAccessToken();
      router.replace("/login");
      setIsLoggingOut(false);
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: "rgba(255,255,255,0.92)",
        color: "text.primary",
        borderBottom: "1px solid rgba(100, 116, 139, 0.18)",
        backdropFilter: "blur(16px)",
      }}
    >
      <Toolbar sx={{ minHeight: 66, gap: 2, px: { xs: 2, sm: 3 } }}>
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
          <Typography variant="subtitle1" fontWeight={900} sx={{ lineHeight: 1.15, letterSpacing: 0 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {actions ? <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{actions}</Box> : null}
        <Button
          variant="outlined"
          size="small"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          sx={{ ml: 1, whiteSpace: "nowrap" }}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </Toolbar>
    </AppBar>
  );
}
