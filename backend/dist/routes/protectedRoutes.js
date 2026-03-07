"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectedRouter = void 0;
const express_1 = __importDefault(require("express"));
const requireAuth_1 = require("../middleware/requireAuth");
const requireRole_1 = require("../middleware/requireRole");
const router = express_1.default.Router();
router.get("/portal", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Customer"), (_req, res) => {
    res.json({ status: "ok", message: "Customer portal access granted." });
});
router.get("/employee/csr", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), (_req, res) => {
    res.json({ status: "ok", message: "CSR dashboard access granted." });
});
router.get("/employee/manager", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Manager"), (_req, res) => {
    res.json({ status: "ok", message: "Manager dashboard access granted." });
});
router.get("/employee/executive", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Executive"), (_req, res) => {
    res.json({ status: "ok", message: "Executive dashboard access granted." });
});
router.get("/admin", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Admin"), (_req, res) => {
    res.json({ status: "ok", message: "Admin dashboard access granted." });
});
exports.protectedRouter = router;
