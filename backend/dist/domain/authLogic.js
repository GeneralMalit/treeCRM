"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEmailPassword = parseEmailPassword;
exports.normalizeUserRole = normalizeUserRole;
exports.issueToken = issueToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const roles_1 = require("../constants/roles");
function parseEmailPassword(email, password) {
    if (typeof email !== "string" || !email.trim()) {
        return { error: "Email is required." };
    }
    if (typeof password !== "string" || password.length < 8) {
        return { error: "Password is required and must be at least 8 characters." };
    }
    return { email: email.trim(), password };
}
function normalizeUserRole(rawRole, fallback = roles_1.DEFAULT_ROLE) {
    return (0, roles_1.isRole)(rawRole) ? rawRole : fallback;
}
function issueToken(payload) {
    if (!env_1.hasJwtSecret) {
        throw new Error("JWT_SECRET is required in backend/.env");
    }
    return jsonwebtoken_1.default.sign(payload, env_1.env.jwtSecret, { expiresIn: "8h" });
}
