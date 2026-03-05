import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = express.Router();

router.get("/portal", requireAuth, requireRole("Customer"), (_req, res) => {
  res.json({ status: "ok", message: "Customer portal access granted." });
});

router.get("/employee/csr", requireAuth, requireRole("CSR"), (_req, res) => {
  res.json({ status: "ok", message: "CSR dashboard access granted." });
});

router.get("/employee/manager", requireAuth, requireRole("Manager"), (_req, res) => {
  res.json({ status: "ok", message: "Manager dashboard access granted." });
});

router.get("/employee/executive", requireAuth, requireRole("Executive"), (_req, res) => {
  res.json({ status: "ok", message: "Executive dashboard access granted." });
});

router.get("/admin", requireAuth, requireRole("Admin"), (_req, res) => {
  res.json({ status: "ok", message: "Admin dashboard access granted." });
});

export const protectedRouter = router;
