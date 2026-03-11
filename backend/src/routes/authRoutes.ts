import express from "express";
import { hasJwtSecret, hasSupabaseConfig } from "../config/env";
import { DEFAULT_ROLE } from "../constants/roles";
import {
  isVerifiedAuthUser,
  issueToken,
  normalizeUserRole,
  parseEmailPassword,
} from "../domain/authLogic";
import { requireAuth } from "../middleware/requireAuth";
import { supabase } from "../services/supabaseClient";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

const router = express.Router();

router.post("/register", async (req, res) => {
  if (!hasSupabaseConfig || !supabase) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
    });
    return;
  }

  if (!hasJwtSecret) {
    res.status(500).json({
      status: "error",
      message: "JWT_SECRET is required in backend/.env",
    });
    return;
  }

  const { email, password, name } = req.body as RegisterBody;
  const parsedCredentials = parseEmailPassword(email, password);

  if ("error" in parsedCredentials) {
    res.status(400).json({ status: "error", message: parsedCredentials.error });
    return;
  }

  const normalizedRole = DEFAULT_ROLE;
  const normalizedName = typeof name === "string" && name.trim() ? name.trim() : null;

  const { data, error } = await supabase.auth.signUp({
    email: parsedCredentials.email,
    password: parsedCredentials.password,
    options: {
      data: {
        role: normalizedRole,
        ...(normalizedName ? { name: normalizedName } : {}),
      },
    },
  });

  if (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (!data.user || !data.user.email) {
    res.status(500).json({
      status: "error",
      message: "User registration did not return a valid user object.",
    });
    return;
  }

  const registeredName =
    typeof data.user.user_metadata?.name === "string"
      ? data.user.user_metadata.name
      : normalizedName ?? undefined;
  const emailVerified = isVerifiedAuthUser(data.user);
  const token = emailVerified
    ? issueToken({
        sub: data.user.id,
        email: data.user.email,
        role: normalizedRole,
        emailVerified: true,
        name: registeredName,
      })
    : undefined;

  res.status(201).json({
    status: "ok",
    message: "User registered successfully.",
    ...(token ? { token } : {}),
    user: {
      id: data.user.id,
      email: data.user.email,
      role: normalizedRole,
      name: registeredName,
    },
    emailConfirmationRequired: !emailVerified,
  });
});

router.post("/login", async (req, res) => {
  if (!hasSupabaseConfig || !supabase) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
    });
    return;
  }

  if (!hasJwtSecret) {
    res.status(500).json({
      status: "error",
      message: "JWT_SECRET is required in backend/.env",
    });
    return;
  }

  const { email, password } = req.body as LoginBody;
  const parsedCredentials = parseEmailPassword(email, password);

  if ("error" in parsedCredentials) {
    res.status(400).json({ status: "error", message: parsedCredentials.error });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsedCredentials.email,
    password: parsedCredentials.password,
  });

  if (error || !data.user || !data.user.email) {
    res.status(401).json({
      status: "error",
      message: error?.message || "Invalid email or password.",
    });
    return;
  }

  if (!isVerifiedAuthUser(data.user)) {
    res.status(403).json({
      status: "error",
      message: "Email verification is required before you can log in.",
      emailConfirmationRequired: true,
    });
    return;
  }

  const role = normalizeUserRole(data.user.user_metadata?.role);
  const name =
    typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : undefined;

  const token = issueToken({
    sub: data.user.id,
    email: data.user.email,
    role,
    emailVerified: true,
    name,
  });

  res.json({
    status: "ok",
    message: "Login successful.",
    token,
    user: {
      id: data.user.id,
      email: data.user.email,
      role,
      name,
    },
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    status: "ok",
    user: req.user,
  });
});

router.post("/logout", requireAuth, (_req, res) => {
  res.json({
    status: "ok",
    message: "Logout successful on client. Remove token from local storage.",
  });
});

export const authRouter = router;
