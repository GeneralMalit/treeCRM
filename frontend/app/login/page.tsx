"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { getLandingRoute, login, register, setStoredAccessToken } from "@/lib/auth";

type Mode = "login" | "register";

const featurePoints = [
  "Role-based entry points for admin, employee, and portal workflows.",
  "Compact registration for customer accounts only.",
  "One shell, fewer dead ends, and faster navigation once signed in.",
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") {
      setMode("register");
    }
  }, []);

  const handleModeChange = (_event: MouseEvent<HTMLElement>, newMode: Mode | null) => {
    if (!newMode) {
      return;
    }

    setMode(newMode);
    setMessage(null);
    setError(null);
    setPassword("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const payload = await login(email.trim(), password);
        setStoredAccessToken(payload.token);
        router.push(getLandingRoute(payload.user.role));
        return;
      }

      const payload = await register(email.trim(), password, name.trim() || undefined);
      setPassword("");
      setMode("login");
      setMessage(
        payload.emailConfirmationRequired
          ? "Registration succeeded. Verify your email before logging in."
          : "Registration succeeded. You can now log in.",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 6 } }}>
      <Paper
        variant="outlined"
        sx={{
          overflow: "hidden",
          borderRadius: 3,
          borderColor: "rgba(148, 163, 184, 0.35)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "0.92fr 1.08fr" },
          minHeight: { md: 620 },
        }}
      >
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            color: "#e2e8f0",
            background:
              "radial-gradient(circle at top left, rgba(34, 197, 94, 0.22), transparent 42%), linear-gradient(160deg, #0f172a 0%, #111827 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: "inline-flex",
                alignSelf: "flex-start",
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                bgcolor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <Typography variant="caption" sx={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                TreeCRM
              </Typography>
            </Box>
            <Stack spacing={1}>
              <Typography variant="h3" component="h1" fontWeight={800} sx={{ letterSpacing: "-0.03em" }}>
                Sign in to the workspace
              </Typography>
              <Typography variant="body1" sx={{ color: "#cbd5e1", maxWidth: 460 }}>
                Keep the flow tight. Use one account to move into the right role, ticket list, or customer portal.
              </Typography>
            </Stack>
          </Stack>

          <Stack spacing={1.5}>
            {featurePoints.map((point) => (
              <Box
                key={point}
                sx={{
                  display: "flex",
                  gap: 1.25,
                  alignItems: "flex-start",
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(255, 255, 255, 0.05)",
                }}
              >
                <Box sx={{ mt: 0.7, width: 8, height: 8, borderRadius: "50%", bgcolor: "#22c55e", flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: "#e2e8f0" }}>
                  {point}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            bgcolor: "#ffffff",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Stack component="form" spacing={2.25} onSubmit={handleSubmit} sx={{ width: "100%" }}>
            <Stack spacing={0.75}>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
                {mode === "login" ? "Login" : "Create account"}
              </Typography>
              <Typography color="text.secondary">
                {mode === "login"
                  ? "Sign in with your existing TreeCRM credentials."
                  : "Create a customer account to start a support conversation."}
              </Typography>
            </Stack>

            <ToggleButtonGroup
              fullWidth
              exclusive
              color="primary"
              value={mode}
              onChange={handleModeChange}
              sx={{
                "& .MuiToggleButton-root": {
                  py: 1,
                  textTransform: "none",
                  borderColor: "rgba(148, 163, 184, 0.45)",
                },
              }}
            >
              <ToggleButton value="login">Login</ToggleButton>
              <ToggleButton value="register">Register</ToggleButton>
            </ToggleButtonGroup>

            {mode === "register" ? (
              <TextField
                label="Name (optional)"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            ) : null}

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              helperText="Minimum 8 characters"
              required
            />

            {message ? <Alert severity="info">{message}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : mode === "login" ? "Login" : "Register"}
            </Button>

            <Divider sx={{ my: 0.5 }} />

            <Typography variant="caption" color="text.secondary">
              Customers can register here. Admin and employee accounts are provisioned separately.
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
