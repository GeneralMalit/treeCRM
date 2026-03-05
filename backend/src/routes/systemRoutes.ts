import express from "express";
import packageJson from "../../package.json";
import { env, hasSupabaseConfig } from "../config/env";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "treecrm-backend",
    timestamp: new Date().toISOString(),
  });
});

router.get("/version", (_req, res) => {
  res.json({
    name: packageJson.name,
    version: packageJson.version,
    node: process.version,
  });
});

router.get("/health/supabase", async (_req, res) => {
  if (!hasSupabaseConfig) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: env.supabaseKey,
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
  } catch (error) {
    clearTimeout(timeout);

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Supabase health check timed out."
        : "Failed to reach Supabase endpoint.";

    res.status(500).json({
      status: "error",
      message,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const systemRouter = router;
