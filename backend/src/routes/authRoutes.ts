import express from "express";
import jwt from "jsonwebtoken";
import { env, hasJwtSecret, hasSupabaseConfig } from "../config/env";
import { DEFAULT_ROLE, isRole, type Role } from "../constants/roles";
import { requireAuth } from "../middleware/requireAuth";
import { supabase } from "../services/supabaseClient";
import type { AuthTokenPayload } from "../types/auth";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  role?: unknown;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type ParsedCredentials = { email: string; password: string } | { error: string };

function parseEmailPassword(email: unknown, password: unknown): ParsedCredentials {
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password is required and must be at least 8 characters." };
  }

  return { email: email.trim(), password };
}

function normalizeUserRole(rawRole: unknown, fallback: Role = DEFAULT_ROLE): Role {
  return isRole(rawRole) ? rawRole : fallback;
}

function issueToken(payload: Pick<AuthTokenPayload, "sub" | "email" | "role" | "name">): string {
  if (!hasJwtSecret) {
    throw new Error("JWT_SECRET is required in backend/.env");
  }

  return jwt.sign(payload, env.jwtSecret, { expiresIn: "8h" });
}

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

  const { email, password, role, name } = req.body as RegisterBody;
  const parsedCredentials = parseEmailPassword(email, password);

  if ("error" in parsedCredentials) {
    res.status(400).json({ status: "error", message: parsedCredentials.error });
    return;
  }

  if (typeof role !== "undefined" && !isRole(role)) {
    res.status(400).json({
      status: "error",
      message: "Role must be one of: CSR, Manager, Executive, Admin, Customer.",
    });
    return;
  }

  const normalizedRole = normalizeUserRole(role);
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

  const registeredRole = normalizeUserRole(data.user.user_metadata?.role, normalizedRole);
  const registeredName =
    typeof data.user.user_metadata?.name === "string"
      ? data.user.user_metadata.name
      : normalizedName ?? undefined;

  const token = issueToken({
    sub: data.user.id,
    email: data.user.email,
    role: registeredRole,
    name: registeredName,
  });

  res.status(201).json({
    status: "ok",
    message: "User registered successfully.",
    token,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: registeredRole,
      name: registeredName,
    },
    emailConfirmationRequired: !data.session,
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

  const role = normalizeUserRole(data.user.user_metadata?.role);
  const name =
    typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : undefined;

  const token = issueToken({
    sub: data.user.id,
    email: data.user.email,
    role,
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
