import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { connectDB } from "../db.js";
import { ALLOWED_DEPARTMENTS } from "../models/MaintenanceRequest.js";
import { getDepartmentForRole } from "./maintenanceRequests.js";
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  checkAndGenerateOverdueNotifications,
} from "../services/notificationService.js";

const router = Router();

// Protect all notification endpoints with token & user verification
router.use(authenticateToken);

/**
 * Validate and resolve user's department authorization scope for notifications.
 * - Admin: full cross-department access; can optionally filter by a valid department.
 * - Department users: restricted strictly to their assigned department.
 * - Passengers / Unknown roles: fail closed with 403.
 */
export function resolveNotificationScope(req) {
  const user = req.user;
  if (!user) {
    return { error: "Authentication required.", status: 401 };
  }

  const role = String(user.role || "").toLowerCase().trim();

  // Passengers are strictly barred from maintenance and operational notifications
  if (role === "passenger") {
    return {
      error: "Access Denied: Passengers are not permitted to access operational notifications.",
      status: 403,
    };
  }

  const requestedDept = req.query.department
    ? String(req.query.department).trim()
    : null;

  if (requestedDept && !ALLOWED_DEPARTMENTS.includes(requestedDept)) {
    return {
      error: `Invalid department filter. Allowed: ${ALLOWED_DEPARTMENTS.join(", ")}`,
      status: 400,
    };
  }

  if (role === "admin") {
    return {
      isAdmin: true,
      departmentScope: requestedDept,
    };
  }

  const assignedDept = user.department || getDepartmentForRole(role);
  if (!assignedDept) {
    return {
      error: `Access Denied: Role '${user.role}' is not authorized to access notifications.`,
      status: 403,
    };
  }

  if (requestedDept && requestedDept !== assignedDept) {
    return {
      error: `Access Denied: You are only authorized to view notifications for ${assignedDept}.`,
      status: 403,
    };
  }

  return {
    isAdmin: false,
    departmentScope: assignedDept,
  };
}

/**
 * GET /api/notifications
 * Retrieve notifications and unread count scoped by role and department.
 */
router.get("/", async (req, res) => {
  try {
    await connectDB();

    const scope = resolveNotificationScope(req);
    if (scope.error) {
      return res.status(scope.status).json({ error: scope.error });
    }

    // Refresh overdue notifications automatically
    await checkAndGenerateOverdueNotifications();

    const unreadOnly =
      req.query.unreadOnly === "true" ||
      req.query.status === "unread" ||
      req.query.filter === "unread";

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const result = await getNotifications({
      department: scope.departmentScope,
      unreadOnly,
      limit,
    });

    return res.json(result);
  } catch (error) {
    console.error("Error retrieving notifications:", error.message);
    return res.status(500).json({ error: "Failed to retrieve notifications." });
  }
});

/**
 * GET /api/notifications/unread-count
 * Quick count of unread notifications for badge display.
 */
router.get("/unread-count", async (req, res) => {
  try {
    await connectDB();

    const scope = resolveNotificationScope(req);
    if (scope.error) {
      return res.status(scope.status).json({ error: scope.error });
    }

    const unreadCount = await getUnreadCount({
      department: scope.departmentScope,
    });

    return res.json({ unreadCount });
  } catch (error) {
    console.error("Error retrieving unread notification count:", error.message);
    return res.status(500).json({ error: "Failed to retrieve unread notification count." });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark an individual notification as read.
 */
router.patch("/:id/read", async (req, res) => {
  try {
    await connectDB();

    const scope = resolveNotificationScope(req);
    if (scope.error) {
      return res.status(scope.status).json({ error: scope.error });
    }

    const result = await markNotificationAsRead(req.params.id, {
      userDepartment: scope.departmentScope,
      isAdmin: scope.isAdmin,
    });

    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    return res.json({
      message: "Notification marked as read.",
      notification: result.notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error.message);
    return res.status(500).json({ error: "Failed to mark notification as read." });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications in the user's scope as read.
 */
router.post("/mark-all-read", async (req, res) => {
  try {
    await connectDB();

    const scope = resolveNotificationScope(req);
    if (scope.error) {
      return res.status(scope.status).json({ error: scope.error });
    }

    const result = await markAllNotificationsAsRead({
      userDepartment: scope.departmentScope,
      isAdmin: scope.isAdmin,
    });

    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    return res.json({
      message: "All notifications marked as read.",
      count: result.count,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error.message);
    return res.status(500).json({ error: "Failed to mark notifications as read." });
  }
});

export default router;
