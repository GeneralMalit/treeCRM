import jwt from "jsonwebtoken";
import { env, hasJwtSecret } from "../config/env";
import { DEFAULT_ROLE, isRole, type Role } from "../constants/roles";
import type { AuthTokenPayload } from "../types/auth";

export type ParsedCredentials = { email: string; password: string } | { error: string };

export function parseEmailPassword(email: unknown, password: unknown): ParsedCredentials {
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password is required and must be at least 8 characters." };
  }

  return { email: email.trim(), password };
}

export function normalizeUserRole(rawRole: unknown, fallback: Role = DEFAULT_ROLE): Role {
  return isRole(rawRole) ? rawRole : fallback;
}

export function issueToken(payload: Pick<AuthTokenPayload, "sub" | "email" | "role" | "name">): string {
  if (!hasJwtSecret) {
    throw new Error("JWT_SECRET is required in backend/.env");
  }

  return jwt.sign(payload, env.jwtSecret, { expiresIn: "8h" });
}
