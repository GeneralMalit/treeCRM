import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env, hasJwtSecret } from "../config/env";
import { isRole } from "../constants/roles";

function parseBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!hasJwtSecret) {
    res.status(500).json({
      status: "error",
      message: "JWT_SECRET is required in backend/.env",
    });
    return;
  }

  const token = parseBearerToken(req.header("authorization"));
  if (!token) {
    res.status(401).json({
      status: "error",
      message: "Missing or invalid Authorization header. Use Bearer <token>.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload | string;

    if (typeof decoded === "string") {
      throw new Error("Invalid token payload");
    }

    const sub = decoded.sub;
    const email = decoded.email;
    const role = decoded.role;
    const name = decoded.name;

    if (typeof sub !== "string" || typeof email !== "string" || !isRole(role)) {
      throw new Error("Invalid token claims");
    }

    req.user = {
      ...decoded,
      sub,
      email,
      role,
      name: typeof name === "string" ? name : undefined,
    };

    next();
  } catch {
    res.status(401).json({
      status: "error",
      message: "Invalid or expired token.",
    });
  }
}
