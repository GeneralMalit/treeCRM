import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseAdminConfig, hasSupabaseConfig } from "../config/env";

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const supabaseAdmin = hasSupabaseAdminConfig
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const hasSupabaseAdmin = Boolean(supabaseAdmin);
