import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "../config/env";

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
