import type { NextFunction, Request, Response } from "express";
import type { Role } from "../constants/roles";

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: "error",
        message: "Authentication is required.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: "error",
        message: `Access denied for role '${req.user.role}'.`,
      });
      return;
    }

    next();
  };
}
