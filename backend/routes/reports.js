import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { connectDB } from "../db.js";
import { ALLOWED_DEPARTMENTS } from "../models/MaintenanceRequest.js";
import { getDepartmentForRole, isValidDateString } from "./maintenanceRequests.js";
import {
  getOverviewReport,
  getDepartmentsReport,
  getTrendsReport,
  getAssetsReport,
} from "../services/reportService.js";

const router = Router();

// Protect all report endpoints with token & user verification
router.use(authenticateToken);

/**
 * Validate and resolve user's department authorization scope.
 * - Admin: full access to all departments; can optionally filter by a valid department.
 * - Department users: restricted strictly to their assigned department.
 * - Passengers / Unknown roles: fail closed with 403.
 */
export function resolveUserScope(req) {
  const user = req.user;
  if (!user) {
    return { error: "Authentication required.", status: 401 };
  }

  const role = String(user.role || "").toLowerCase().trim();

  // Passengers are strictly barred from internal maintenance analytics
  if (role === "passenger") {
    return {
      error: "Access Denied: Passengers are not permitted to access reports.",
      status: 403,
    };
  }

  const requestedDept = req.query.department
    ? String(req.query.department).trim()
    : null;

  // Validate requested department if provided
  if (requestedDept && !ALLOWED_DEPARTMENTS.includes(requestedDept)) {
    return {
      error: `Invalid department filter. Allowed: ${ALLOWED_DEPARTMENTS.join(", ")}`,
      status: 400,
    };
  }

  if (role === "admin") {
    return { departmentScope: requestedDept };
  }

  // Department-specific roles
  const assignedDept = user.department || getDepartmentForRole(role);
  if (!assignedDept) {
    return {
      error: `Access Denied: Role '${user.role}' is not authorized to access reports.`,
      status: 403,
    };
  }

  // If department user specifies a department other than their own, reject with 403
  if (requestedDept && requestedDept !== assignedDept) {
    return {
      error: `Access Denied: You are only authorized to view reports for ${assignedDept}.`,
      status: 403,
    };
  }

  return { departmentScope: assignedDept };
}

/**
 * Validate from and to query dates if supplied
 */
export function validateDateRange(req) {
  const { from, to } = req.query;

  if (from !== undefined && from !== null && String(from).trim() !== "") {
    const trimmedFrom = String(from).trim();
    if (!isValidDateString(trimmedFrom)) {
      return {
        error: "Invalid 'from' date. Expected valid calendar date in YYYY-MM-DD format.",
        status: 400,
      };
    }
  }

  if (to !== undefined && to !== null && String(to).trim() !== "") {
    const trimmedTo = String(to).trim();
    if (!isValidDateString(trimmedTo)) {
      return {
        error: "Invalid 'to' date. Expected valid calendar date in YYYY-MM-DD format.",
        status: 400,
      };
    }
  }

  if (from && to && String(from).trim() > String(to).trim()) {
    return {
      error: "'from' date cannot be after 'to' date.",
      status: 400,
    };
  }

  return {
    from: from ? String(from).trim() : null,
    to: to ? String(to).trim() : null,
  };
}

/**
 * GET /api/reports/overview
 * Total requests, status breakdown, overdue requests, completion rate and average actual duration
 */
router.get("/overview", async (req, res) => {
  try {
    await connectDB();

    const scopeResult = resolveUserScope(req);
    if (scopeResult.error) {
      return res.status(scopeResult.status).json({ error: scopeResult.error });
    }

    const dateResult = validateDateRange(req);
    if (dateResult.error) {
      return res.status(dateResult.status).json({ error: dateResult.error });
    }

    const report = await getOverviewReport({
      from: dateResult.from,
      to: dateResult.to,
      department: scopeResult.departmentScope,
    });

    return res.json(report);
  } catch (error) {
    console.error("Error generating overview report:", error.message);
    return res.status(500).json({ error: "Failed to generate overview report." });
  }
});

/**
 * GET /api/reports/departments
 * Request counts, completion, overdue work and duration metrics across departments
 */
router.get("/departments", async (req, res) => {
  try {
    await connectDB();

    const scopeResult = resolveUserScope(req);
    if (scopeResult.error) {
      return res.status(scopeResult.status).json({ error: scopeResult.error });
    }

    const dateResult = validateDateRange(req);
    if (dateResult.error) {
      return res.status(dateResult.status).json({ error: dateResult.error });
    }

    const report = await getDepartmentsReport({
      from: dateResult.from,
      to: dateResult.to,
      department: scopeResult.departmentScope,
    });

    return res.json(report);
  } catch (error) {
    console.error("Error generating departments report:", error.message);
    return res.status(500).json({ error: "Failed to generate departments report." });
  }
});

/**
 * GET /api/reports/trends
 * Date-range-based monthly maintenance completion and scheduling trends
 */
router.get("/trends", async (req, res) => {
  try {
    await connectDB();

    const scopeResult = resolveUserScope(req);
    if (scopeResult.error) {
      return res.status(scopeResult.status).json({ error: scopeResult.error });
    }

    const dateResult = validateDateRange(req);
    if (dateResult.error) {
      return res.status(dateResult.status).json({ error: dateResult.error });
    }

    const report = await getTrendsReport({
      from: dateResult.from,
      to: dateResult.to,
      department: scopeResult.departmentScope,
    });

    return res.json(report);
  } catch (error) {
    console.error("Error generating trends report:", error.message);
    return res.status(500).json({ error: "Failed to generate trends report." });
  }
});

/**
 * GET /api/reports/assets
 * Asset-category, condition, status, risk and inspection-date analysis
 */
router.get("/assets", async (req, res) => {
  try {
    await connectDB();

    const scopeResult = resolveUserScope(req);
    if (scopeResult.error) {
      return res.status(scopeResult.status).json({ error: scopeResult.error });
    }

    const report = await getAssetsReport({
      department: scopeResult.departmentScope,
    });

    return res.json(report);
  } catch (error) {
    console.error("Error generating assets report:", error.message);
    return res.status(500).json({ error: "Failed to generate assets report." });
  }
});

export default router;
