"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = __importDefault(require("express"));
const env_1 = require("../config/env");
const roles_1 = require("../constants/roles");
const authLogic_1 = require("../domain/authLogic");
const requireAuth_1 = require("../middleware/requireAuth");
const supabaseClient_1 = require("../services/supabaseClient");
const router = express_1.default.Router();
router.post("/register", async (req, res) => {
    if (!env_1.hasSupabaseConfig || !supabaseClient_1.supabase) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
        });
        return;
    }
    if (!env_1.hasJwtSecret) {
        res.status(500).json({
            status: "error",
            message: "JWT_SECRET is required in backend/.env",
        });
        return;
    }
    const { email, password, role, name } = req.body;
    const parsedCredentials = (0, authLogic_1.parseEmailPassword)(email, password);
    if ("error" in parsedCredentials) {
        res.status(400).json({ status: "error", message: parsedCredentials.error });
        return;
    }
    if (typeof role !== "undefined" && !(0, roles_1.isRole)(role)) {
        res.status(400).json({
            status: "error",
            message: "Role must be one of: CSR, Manager, Executive, Admin, Customer.",
        });
        return;
    }
    const normalizedRole = (0, authLogic_1.normalizeUserRole)(role);
    const normalizedName = typeof name === "string" && name.trim() ? name.trim() : null;
    const { data, error } = await supabaseClient_1.supabase.auth.signUp({
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
    const registeredRole = (0, authLogic_1.normalizeUserRole)(data.user.user_metadata?.role, normalizedRole);
    const registeredName = typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name
        : normalizedName ?? undefined;
    const token = (0, authLogic_1.issueToken)({
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
    if (!env_1.hasSupabaseConfig || !supabaseClient_1.supabase) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
        });
        return;
    }
    if (!env_1.hasJwtSecret) {
        res.status(500).json({
            status: "error",
            message: "JWT_SECRET is required in backend/.env",
        });
        return;
    }
    const { email, password } = req.body;
    const parsedCredentials = (0, authLogic_1.parseEmailPassword)(email, password);
    if ("error" in parsedCredentials) {
        res.status(400).json({ status: "error", message: parsedCredentials.error });
        return;
    }
    const { data, error } = await supabaseClient_1.supabase.auth.signInWithPassword({
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
    const role = (0, authLogic_1.normalizeUserRole)(data.user.user_metadata?.role);
    const name = typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : undefined;
    const token = (0, authLogic_1.issueToken)({
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
router.get("/me", requireAuth_1.requireAuth, (req, res) => {
    res.json({
        status: "ok",
        user: req.user,
    });
});
router.post("/logout", requireAuth_1.requireAuth, (_req, res) => {
    res.json({
        status: "ok",
        message: "Logout successful on client. Remove token from local storage.",
    });
});
exports.authRouter = router;
