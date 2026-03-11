"use client";

import { FormEvent, MouseEvent, useState } from "react";
import {
  Alert,
  Button,
  Container,
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

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Typography variant="h5">Authentication</Typography>
          <Typography color="text.secondary">
            Sign in to access your workspace, or register a customer account.
          </Typography>

          <ToggleButtonGroup value={mode} exclusive color="primary" onChange={handleModeChange}>
            <ToggleButton value="login">Login</ToggleButton>
            <ToggleButton value="register">Register</ToggleButton>
          </ToggleButtonGroup>

          {mode === "register" && (
            <TextField
              label="Name (optional)"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          )}

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

          {message && <Alert severity="info">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : mode === "login" ? "Login" : "Register"}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
