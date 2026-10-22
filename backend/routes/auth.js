import { Router } from "express";
import { getAuth } from "firebase-admin/auth";
import User from "../models/User.js";
import { connectDB } from "../db.js";

const router = Router();

/**
 * GET /api/auth/me
 * 1. Checks Firebase Bearer token -> 401 if missing/invalid
 * 2. Queries user from MongoDB Atlas by Firebase UID -> 403 if not found or inactive
 * 3. Returns role and profile details to frontend
 */
router.get("/me", async (req, res) => {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return res.status(401).json({ error: "No authorization token provided." });
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  try {
    await connectDB();
    const user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (!user) {
      return res.status(403).json({
        error: "Access Denied: Your account is not registered in RailMaint. Contact an administrator.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: "Access Denied: Your account is inactive. Contact an administrator.",
      });
    }

    return res.json({
      uid: user.firebaseUid,
      email: user.email,
      role: user.role,
      department: user.department ?? null,
      status: user.status,
    });
  } catch (dbError) {
    console.error("Database lookup error:", dbError.message);
    return res.status(500).json({ error: "Database error while fetching profile." });
  }
});

export default router;