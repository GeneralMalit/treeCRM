"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemRouter = void 0;
const express_1 = __importDefault(require("express"));
const package_json_1 = __importDefault(require("../../package.json"));
const env_1 = require("../config/env");
const router = express_1.default.Router();
router.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "treecrm-backend",
        timestamp: new Date().toISOString(),
    });
});
router.get("/version", (_req, res) => {
    res.json({
        name: package_json_1.default.name,
        version: package_json_1.default.version,
        node: process.version,
    });
});
router.get("/health/supabase", async (_req, res) => {
    if (!env_1.hasSupabaseConfig) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
        });
        return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${env_1.env.supabaseUrl}/auth/v1/settings`, {
            method: "GET",
            headers: {
                apikey: env_1.env.supabaseKey,
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.status === 401 || response.status === 403) {
            res.status(401).json({
                status: "error",
                message: "Supabase reachable, but key is invalid or unauthorized.",
            });
            return;
        }
        if (!response.ok) {
            res.status(500).json({
                status: "error",
                message: "Supabase reachable, but health probe returned an unexpected status.",
                httpStatus: response.status,
            });
            return;
        }
        res.json({
            status: "ok",
            message: "Supabase auth endpoint is reachable and API key is valid.",
            httpStatus: response.status,
        });
    }
    catch (error) {
        clearTimeout(timeout);
        const message = error instanceof Error && error.name === "AbortError"
            ? "Supabase health check timed out."
            : "Failed to reach Supabase endpoint.";
        res.status(500).json({
            status: "error",
            message,
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.systemRouter = router;
