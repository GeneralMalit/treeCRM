"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasJwtSecret = exports.hasSupabaseAdminConfig = exports.hasSupabaseConfig = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey: process.env.SUPABASE_KEY || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    jwtSecret: process.env.JWT_SECRET || "",
};
exports.hasSupabaseConfig = Boolean(exports.env.supabaseUrl && exports.env.supabaseKey);
exports.hasSupabaseAdminConfig = Boolean(exports.env.supabaseUrl && exports.env.supabaseServiceRoleKey);
exports.hasJwtSecret = Boolean(exports.env.jwtSecret);
