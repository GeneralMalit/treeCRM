"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearStoredAccessToken, getLandingRoute, getStoredAccessToken, logout, me } from "@/lib/auth";
import type { Role } from "@/lib/roles";

type RoleDashboardProps = {
  allowedRoles: Role[];
  title: string;
  description: string;
};

type ViewState =
  | { status: "loading" }
  | { status: "ready"; user: { email: string; role: Role; name?: string } }
  | { status: "error"; message: string };

export function RoleDashboard({ allowedRoles, title, description }: RoleDashboardProps) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const accessToken = getStoredAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      try {
        const currentUser = await me(accessToken);
        if (cancelled) {
          return;
        }

        if (!allowedRoles.includes(currentUser.role)) {
          router.replace(getLandingRoute(currentUser.role));
          return;
        }

        setState({
          status: "ready",
          user: {
            email: currentUser.email,
            role: currentUser.role,
            ...(currentUser.name ? { name: currentUser.name } : {}),
          },
        });
      } catch (error) {
        clearStoredAccessToken();
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Authentication failed.",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [allowedRoles, router]);

  const handleLogout = async () => {
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }

    clearStoredAccessToken();
    router.replace("/login");
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5">{title}</Typography>
            <Typography color="text.secondary">{description}</Typography>
          </Box>

          {state.status === "loading" && <Alert severity="info">Validating session...</Alert>}
          {state.status === "error" && <Alert severity="error">{state.message}</Alert>}
          {state.status === "ready" && (
            <Alert severity="success">
              Signed in as {state.user.name ? `${state.user.name} (${state.user.email})` : state.user.email}
              {" - "}
              role: {state.user.role}
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleLogout}>
              Logout
            </Button>
            <Button component={Link} href="/" variant="outlined">
              Home
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
