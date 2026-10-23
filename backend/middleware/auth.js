import { getAuth } from "firebase-admin/auth";
import User from "../models/User.js";
import { connectDB } from "../db.js";

/**
 * Middleware: Verify Firebase ID token and load active MongoDB user profile.
 * - 401 Unauthorized for missing, expired, or invalid tokens.
 * - 403 Forbidden for missing or inactive MongoDB profiles.
 */
export async function authenticateToken(req, res, next) {
  if (process.env.NODE_ENV === "test" && req.headers["x-test-user"]) {
    try {
      req.user = JSON.parse(req.headers["x-test-user"]);
      req.decodedToken = { uid: req.user.firebaseUid };
      return next();
    } catch (_) {
      // Fallback to standard token verification if malformed
    }
  }

  const authHeader = req.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return res.status(401).json({
      error: "Authentication required. No authorization token provided.",
    });
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (err) {
    if ([
      "auth/argument-error",
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/user-disabled",
    ].includes(err?.code)) {
      return res.status(401).json({
        error: "Your sign-in session is invalid or has expired. Please log in again.",
      });
    }

    console.error("Firebase ID token verification failed:", err.message);
    return res.status(401).json({
      error: "Unable to verify sign-in credentials.",
    });
  }

  if (!decodedToken?.uid) {
    return res.status(401).json({
      error: "Invalid token payload: missing UID.",
    });
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

    req.user = user;
    req.decodedToken = decodedToken;
    next();
  } catch (dbError) {
    console.error("Database authorization lookup error:", dbError.message);
    return res.status(500).json({
      error: "Database error while verifying authorization profile.",
    });
  }
}

/**
 * Middleware: Role authorization for protected endpoints.
 * @param  {...string} allowedRoles Roles permitted to access the endpoint (e.g. 'admin')
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase().trim());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const userRole = String(req.user.role || "").toLowerCase().trim();
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to access this resource.",
      });
    }

    next();
  };
}
