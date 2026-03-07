"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSupabaseAdmin = exports.supabaseAdmin = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
exports.supabase = env_1.hasSupabaseConfig
    ? (0, supabase_js_1.createClient)(env_1.env.supabaseUrl, env_1.env.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
exports.supabaseAdmin = env_1.hasSupabaseAdminConfig
    ? (0, supabase_js_1.createClient)(env_1.env.supabaseUrl, env_1.env.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
exports.hasSupabaseAdmin = Boolean(exports.supabaseAdmin);
