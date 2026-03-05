const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");

const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseKey);

const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

module.exports = { supabase, hasSupabaseConfig };

