"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = __importDefault(require("express"));
const requireAuth_1 = require("../middleware/requireAuth");
const requireRole_1 = require("../middleware/requireRole");
const systemSettings_1 = require("../services/systemSettings");
const router = express_1.default.Router();
router.use("/admin", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Admin"));
router.get("/admin/settings", async (_req, res) => {
    const settings = await (0, systemSettings_1.getSystemSettings)();
    res.json({
        status: "ok",
        data: {
            settings,
        },
    });
});
router.patch("/admin/settings", async (req, res) => {
    const parsed = (0, systemSettings_1.parseSystemSettingsPatch)(req.body);
    if ("error" in parsed) {
        res.status(400).json({
            status: "error",
            message: parsed.error,
        });
        return;
    }
    try {
        const settings = await (0, systemSettings_1.upsertSystemSettings)(parsed.data);
        res.json({
            status: "ok",
            data: {
                settings,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update admin settings.",
        });
    }
});
exports.adminRouter = router;
