const express = require("express");
const { hasSupabaseConfig } = require("../services/supabaseClient");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "treecrm-backend",
    timestamp: new Date().toISOString(),
  });
});

router.get("/version", (_req, res) => {
  const packageJson = require("../../package.json");
  res.json({
    name: packageJson.name,
    version: packageJson.version,
    node: process.version,
  });
});

router.get("/health/supabase", async (_req, res) => {
  if (!hasSupabaseConfig) {
    return res.status(500).json({
      status: "error",
      message: "SUPABASE_URL and SUPABASE_KEY are required in backend/.env",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: process.env.SUPABASE_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({
        status: "error",
        message: "Supabase reachable, but key is invalid or unauthorized.",
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        status: "error",
        message: "Supabase reachable, but health probe returned an unexpected status.",
        httpStatus: response.status,
      });
    }

    return res.json({
      status: "ok",
      message: "Supabase auth endpoint is reachable and API key is valid.",
      httpStatus: response.status,
    });
  } catch (error) {
    clearTimeout(timeout);
    const message =
      error.name === "AbortError"
        ? "Supabase health check timed out."
        : "Failed to reach Supabase endpoint.";

    return res.status(500).json({
      status: "error",
      message,
      details: error.message,
    });
  }
});

module.exports = { systemRouter: router };
