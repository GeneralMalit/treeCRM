import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getSystemSettings, parseSystemSettingsPatch, upsertSystemSettings } from "../services/systemSettings";

const router = express.Router();

router.use("/admin", requireAuth, requireRole("Admin"));

router.get("/admin/settings", async (_req, res) => {
  const settings = await getSystemSettings();
  res.json({
    status: "ok",
    data: {
      settings,
    },
  });
});

router.patch("/admin/settings", async (req, res) => {
  const parsed = parseSystemSettingsPatch(req.body);
  if ("error" in parsed) {
    res.status(400).json({
      status: "error",
      message: parsed.error,
    });
    return;
  }

  try {
    const settings = await upsertSystemSettings(parsed.data);
    res.json({
      status: "ok",
      data: {
        settings,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to update admin settings.",
    });
  }
});

export const adminRouter = router;
