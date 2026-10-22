import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/auth/me
 * 1. Checks Firebase Bearer token -> 401 if missing/invalid
 * 2. Queries user from MongoDB Atlas by Firebase UID -> 403 if not found or inactive
 * 3. Compares selected login role (header x-selected-role, query param, or body) with MongoDB role
 *    -> 403 if mismatch: "The selected role does not match your assigned role. Please select the correct role."
 * 4. Returns verified user profile from MongoDB Atlas
 */
router.get("/me", authenticateToken, (req, res) => {
  const user = req.user;
  const selectedRole =
    req.get("x-selected-role") ||
    req.query?.selectedRole ||
    req.query?.role ||
    req.body?.selectedRole ||
    req.body?.role;

  if (selectedRole) {
    const normalizedSelected = String(selectedRole).trim().toLowerCase();
    const normalizedDbRole = String(user.role || "").trim().toLowerCase();

    if (normalizedSelected !== normalizedDbRole) {
      return res.status(403).json({
        error: "The selected role does not match your assigned role. Please select the correct role.",
      });
    }
  }

  return res.json({
    uid: user.firebaseUid,
    email: user.email,
    role: user.role,
    department: user.department ?? null,
    status: user.status,
  });
});

/**
 * GET /api/auth/admin-only
 * Protected verification endpoint: requires authenticated user with admin role.
 * Non-admin roles (e.g. engineering) receive 403 Forbidden.
 */
router.get("/admin-only", authenticateToken, requireRole("admin"), (req, res) => {
  return res.json({
    message: "Admin authorization verified successfully.",
    user: req.user.email,
    role: req.user.role,
  });
});

export default router;