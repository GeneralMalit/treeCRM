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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { getLandingRoute, login, register, setStoredAccessToken } from "@/lib/auth";

type Mode = "login" | "register";

const featurePoints = [
  "One credential routes each signed-in user to the correct TreeCRM workspace.",
  "Customer registration stays public; employee and admin accounts are provisioned by admins.",
  "Portal tickets, internal messages, and operations views share the same product shell.",
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
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #ffffff 0%, #f8fafc 42%, #eef7f3 100%)",
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        <Stack spacing={3}>
          <BrandMark />

          <Paper
            variant="outlined"
            sx={{
              overflow: "hidden",
              borderRadius: 2,
              borderColor: "rgba(100, 116, 139, 0.22)",
              boxShadow: "0 28px 90px rgba(15, 23, 42, 0.12)",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "0.88fr 1.12fr" },
              minHeight: { md: 640 },
            }}
          >
            <Box
              sx={{
                p: { xs: 3, md: 4 },
                color: "#ffffff",
                background: "linear-gradient(160deg, #0f5132 0%, #0f766e 100%)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <Stack spacing={2.2}>
                <Typography variant="h3" component="h1" sx={{ color: "#ffffff", lineHeight: 1.05 }}>
                  Sign in to the workspace
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.78)", maxWidth: 460, lineHeight: 1.7 }}>
                  Move from the public landing page into the right support surface: customer portal,
                  employee workspace, manager overview, executive view, or admin controls.
                </Typography>
              </Stack>

              <Stack spacing={1.2}>
                {featurePoints.map((point) => (
                  <Box
                    key={point}
                    sx={{
                      display: "flex",
                      gap: 1.25,
                      alignItems: "flex-start",
                      p: 1.4,
                      borderRadius: 1.2,
                      bgcolor: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <Box sx={{ mt: 0.7, width: 8, height: 8, borderRadius: "50%", bgcolor: "#8ee7ce", flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.6 }}>
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
              <Stack component="form" spacing={2.2} onSubmit={handleSubmit} sx={{ width: "100%" }}>
                <Stack spacing={0.75}>
                  <Typography variant="h4" fontWeight={900}>
                    {mode === "login" ? "Welcome back" : "Create customer account"}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {mode === "login"
                      ? "Sign in with your existing TreeCRM credentials."
                      : "Create a customer account to start and track support conversations."}
                  </Typography>
                </Stack>

                <ToggleButtonGroup
                  fullWidth
                  exclusive
                  color="primary"
                  value={mode}
                  onChange={handleModeChange}
                  sx={{
                    p: 0.45,
                    borderRadius: 1.4,
                    bgcolor: "#f8fafc",
                    border: "1px solid rgba(100, 116, 139, 0.18)",
                    "& .MuiToggleButton-root": {
                      py: 0.9,
                      border: 0,
                      borderRadius: 1,
                      textTransform: "none",
                      fontWeight: 800,
                      "&.Mui-selected": {
                        bgcolor: "#ffffff",
                        color: "#0f5132",
                        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                      },
                    },
                  }}
                >
                  <ToggleButton value="login">Sign in</ToggleButton>
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
                  {isSubmitting ? "Submitting..." : mode === "login" ? "Sign in" : "Register"}
                </Button>

                <Divider sx={{ my: 0.5 }} />

                <Stack spacing={0.7}>
                  <Typography variant="caption" color="text.secondary">
                    Customers can register here. Admin and employee accounts are provisioned separately.
                  </Typography>
                  <Button component={Link} href="/" variant="text" sx={{ alignSelf: "flex-start", px: 0 }}>
                    Back to landing page
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
