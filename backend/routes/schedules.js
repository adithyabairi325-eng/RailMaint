import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/schedules - list current maintenance schedules (requires authenticated user)
router.get("/", authenticateToken, (req, res) => {
  res.json({
    schedules: [],
    message: "Schedule service ready.",
    userRole: req.user.role,
  });
});

// GET /api/schedules/admin - admin-only endpoint for maintenance approvals / management
router.get("/admin", authenticateToken, requireRole("admin"), (req, res) => {
  res.json({
    message: "Admin schedule management access granted.",
    user: req.user.email,
  });
});

export default router;
