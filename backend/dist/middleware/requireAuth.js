"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const roles_1 = require("../constants/roles");
function parseBearerToken(authorizationHeader) {
    if (!authorizationHeader) {
        return null;
    }
    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return null;
    }
    return token;
}
function requireAuth(req, res, next) {
    if (!env_1.hasJwtSecret) {
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
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        if (typeof decoded === "string") {
            throw new Error("Invalid token payload");
        }
        const sub = decoded.sub;
        const email = decoded.email;
        const role = decoded.role;
        const name = decoded.name;
        if (typeof sub !== "string" || typeof email !== "string" || !(0, roles_1.isRole)(role)) {
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
    }
    catch {
        res.status(401).json({
            status: "error",
            message: "Invalid or expired token.",
        });
    }
}
