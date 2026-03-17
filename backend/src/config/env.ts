import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_KEY || "",
  supabaseAdminKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "",
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseKey);
export const hasSupabaseAdminConfig = Boolean(env.supabaseUrl && env.supabaseAdminKey);
export const hasJwtSecret = Boolean(env.jwtSecret);
