"use client";

import { FormEvent, MouseEvent, useState } from "react";
import {
  Alert,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { getLandingRoute, login, register, setStoredAccessToken } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/roles";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Customer");
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
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const payload =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password, role, name.trim() || undefined);

      setStoredAccessToken(payload.token);

      if (payload.emailConfirmationRequired) {
        setMessage("Registration succeeded. Email confirmation may be required by Supabase settings.");
      }

      router.push(getLandingRoute(payload.user.role));
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
            Sign in or register, then you will be routed to your role workspace.
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

          {mode === "register" && (
            <TextField
              select
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              helperText="For development, registration can set any role."
            >
              {ROLES.map((roleValue) => (
                <MenuItem key={roleValue} value={roleValue}>
                  {roleValue}
                </MenuItem>
              ))}
            </TextField>
          )}

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
