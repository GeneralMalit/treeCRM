"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Container, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { getBackendHealth } from "@/lib/backend";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await getBackendHealth();
        setHealth({
          status: "ok",
          message: `Backend healthy at ${data.timestamp}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setHealth({ status: "error", message });
      }
    };

    fetchHealth();
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" gutterBottom>
              TreeCRM Session 2 Auth Shell
            </Typography>
            <Typography color="text.secondary">
              Authentication and role-based routing are available in this iteration.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            <Link href="/login">/login</Link>
            <Link href="/portal">/portal</Link>
            <Link href="/employee/csr">/employee/csr</Link>
            <Link href="/employee/manager">/employee/manager</Link>
            <Link href="/employee/executive">/employee/executive</Link>
            <Link href="/admin">/admin</Link>
          </Stack>

          {health.status === "loading" && <Alert severity="info">Checking backend health...</Alert>}
          {health.status === "ok" && <Alert severity="success">{health.message}</Alert>}
          {health.status === "error" && <Alert severity="error">{health.message}</Alert>}
        </Stack>
      </Paper>
    </Container>
  );
}
