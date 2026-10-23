import { Router } from "express";
import mongoose from "mongoose";
import MaintenanceRequest, {
  ALLOWED_PRIORITIES,
  ALLOWED_STATUSES,
  ALLOWED_DEPARTMENTS,
} from "../models/MaintenanceRequest.js";
import { authenticateToken } from "../middleware/auth.js";
import { connectDB } from "../db.js";

const router = Router();

// Protect all routes with Firebase ID token and MongoDB profile verification
router.use(authenticateToken);

/**
 * Supported fields for PATCH /:id/status
 */
export const ALLOWED_UPDATE_FIELDS = ["status", "start", "doneDate", "actual", "note"];

/**
 * Map user roles to corresponding department name
 */
export function getDepartmentForRole(role) {
  const normalized = String(role || "").toLowerCase().trim();
  switch (normalized) {
    case "engineering":
      return "Engineering / Track";
    case "traction":
      return "Electrical / Traction";
    case "signal":
      return "Signal & Telecom";
    default:
      return null;
  }
}

/**
 * Safely generate the next sequential unique request ID (e.g. MR-1001, MR-1002)
 */
async function generateUniqueRequestId() {
  const existing = await MaintenanceRequest.find({}, "id").lean();
  const nums = existing
    .map((r) => {
      const match = String(r.id).match(/^MR-(\d+)$/i);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n) => n !== null && !isNaN(n));

  let candidateNum = (nums.length ? Math.max(...nums) : 1000) + 1;
  let candidateId = `MR-${candidateNum}`;

  while (await MaintenanceRequest.exists({ id: candidateId })) {
    candidateNum++;
    candidateId = `MR-${candidateNum}`;
  }

  return candidateId;
}

/**
 * GET /api/maintenance-requests
 * Retrieve requests from MongoDB Atlas scoped by user permissions.
 */
router.get("/", async (req, res) => {
  try {
    await connectDB();

    const userRole = String(req.user.role || "").toLowerCase().trim();
    const query = {};

    // Restrict access by role and department
    if (userRole !== "admin") {
      const userDept = getDepartmentForRole(userRole);
      if (userDept) {
        query.$or = [{ dept: userDept }, { "createdBy.uid": req.user.firebaseUid }];
      } else {
        query["createdBy.uid"] = req.user.firebaseUid;
      }
    }

    const requests = await MaintenanceRequest.find(query).sort({ createdAt: -1 });

    return res.json({
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Error fetching maintenance requests:", error.message);
    return res.status(500).json({ error: "Failed to retrieve maintenance requests." });
  }
});

/**
 * POST /api/maintenance-requests
 * Create a new maintenance request in MongoDB Atlas.
 * Validates all fields, generates unique ID, and enforces initial status and creator identity.
 */
router.post("/", async (req, res) => {
  try {
    await connectDB();

    const { asset, dept, type, pri, date, dur, desc } = req.body || {};

    // 1. Validate Asset
    if (!asset || !String(asset).trim()) {
      return res.status(400).json({ error: "Asset identifier is required." });
    }

    // 2. Validate Department
    if (!dept || !ALLOWED_DEPARTMENTS.includes(dept)) {
      return res.status(400).json({
        error: `Department is invalid. Allowed: ${ALLOWED_DEPARTMENTS.join(", ")}`,
      });
    }

    // Role-based department check: non-admins can only create requests for their own department
    const userRole = String(req.user.role || "").toLowerCase().trim();
    if (userRole !== "admin") {
      const permittedDept = getDepartmentForRole(userRole);
      if (permittedDept && dept !== permittedDept) {
        return res.status(403).json({
          error: `Access Denied: Your role (${req.user.role}) can only submit requests for ${permittedDept}.`,
        });
      }
    }

    // 3. Validate Work Type
    if (!type || !String(type).trim()) {
      return res.status(400).json({ error: "Work type is required." });
    }

    // 4. Validate Priority
    if (!pri || !ALLOWED_PRIORITIES.includes(pri)) {
      return res.status(400).json({
        error: `Priority is invalid. Allowed: ${ALLOWED_PRIORITIES.join(", ")}`,
      });
    }

    // 5. Validate Date
    if (!date || !String(date).trim() || isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: "A valid target date (YYYY-MM-DD) is required." });
    }

    // 6. Validate Duration
    const durationNum = Number(dur);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: "Duration must be a positive number of minutes." });
    }

    // 7. Validate Description
    if (!desc || !String(desc).trim()) {
      return res.status(400).json({ error: "Description is required." });
    }

    // Safe backend ID generation
    const uniqueId = await generateUniqueRequestId();

    // Create record: creator and status are determined by backend context, NEVER client input
    const newRequest = new MaintenanceRequest({
      id: uniqueId,
      asset: String(asset).trim(),
      dept,
      type: String(type).trim(),
      pri,
      date: String(date).trim(),
      dur: durationNum,
      desc: String(desc).trim(),
      status: "Pending", // Always starts as Pending
      start: null,
      doneDate: null,
      actual: null,
      note: "",
      createdBy: {
        uid: req.user.firebaseUid,
        email: req.user.email,
        role: req.user.role,
      },
    });

    const saved = await newRequest.save();

    return res.status(201).json({
      message: "Maintenance request created successfully.",
      request: saved,
    });
  } catch (error) {
    console.error("Error creating maintenance request:", error.message);
    return res.status(500).json({ error: "Failed to create maintenance request in database." });
  }
});

/**
 * Helper to find by string ID (MR-XXXX) or Mongo ObjectId
 */
export async function findReq(idParam) {
  if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__ && global.__TEST_DOCS__[idParam]) {
    return global.__TEST_DOCS__[idParam];
  }
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    const found = await MaintenanceRequest.findById(idParam);
    if (found) return found;
  }
  return await MaintenanceRequest.findOne({ id: idParam });
}

/**
 * GET /api/maintenance-requests/:id
 * Retrieve a single request by ID with permission enforcement.
 */
router.get("/:id", async (req, res) => {
  try {
    await connectDB();
    const reqDoc = await findReq(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const userRole = String(req.user.role || "").toLowerCase().trim();
    if (userRole !== "admin") {
      const userDept = getDepartmentForRole(userRole);
      const isCreator = reqDoc.createdBy.uid === req.user.firebaseUid;
      const isSameDept = userDept && reqDoc.dept === userDept;

      if (!isCreator && !isSameDept) {
        return res.status(403).json({
          error: "Access Denied: You do not have permission to view this request.",
        });
      }
    }

    return res.json({ request: reqDoc });
  } catch (error) {
    console.error("Error finding request:", error.message);
    return res.status(500).json({ error: "Failed to retrieve maintenance request." });
  }
});

/**
 * PATCH /api/maintenance-requests/:id/status
 * Update status, scheduling, or completion in MongoDB Atlas.
 * Validates all fields and enforces strict role and department permissions.
 */
router.patch("/:id/status", async (req, res) => {
  try {
    await connectDB();

    // 1. Validate payload structure
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Invalid request payload. Expected a JSON object." });
    }

    const payloadKeys = Object.keys(req.body);
    if (payloadKeys.length === 0) {
      return res.status(400).json({ error: "Payload must contain at least one field to update." });
    }

    // 2. Reject unsupported or protected fields (e.g. id, createdBy, dept, pri, asset, etc.)
    const disallowedKeys = payloadKeys.filter((k) => !ALLOWED_UPDATE_FIELDS.includes(k));
    if (disallowedKeys.length > 0) {
      return res.status(400).json({
        error: `Cannot modify field(s): ${disallowedKeys.join(", ")}. Unsupported or protected field.`,
      });
    }

    const { status, doneDate, actual, note, start } = req.body;

    // 3. Validate field formats and values before checking permissions
    // 3a. Validate status
    if (status !== undefined) {
      if (typeof status !== "string" || !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid status '${status}'. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}`,
        });
      }
    }

    // 3b. Validate start (scheduling)
    if (start !== undefined) {
      const isValidStart =
        start === null ||
        (typeof start === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(start.trim()));
      if (!isValidStart) {
        return res.status(400).json({
          error: "Invalid time format for start. Expected HH:mm in 24-hour format (e.g. '09:30') or null.",
        });
      }
    }

    // 3c. Validate doneDate
    if (doneDate !== undefined) {
      const isValidDate =
        typeof doneDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(doneDate.trim()) &&
        !isNaN(new Date(doneDate.trim()).getTime());
      if (!isValidDate) {
        return res.status(400).json({
          error: "Invalid date format for doneDate. Expected YYYY-MM-DD.",
        });
      }
    }

    // 3d. Validate actual duration
    let actualNum;
    if (actual !== undefined) {
      actualNum =
        typeof actual === "number"
          ? actual
          : typeof actual === "string" && actual.trim() !== ""
            ? Number(actual)
            : NaN;
      if (!Number.isFinite(actualNum) || actualNum <= 0) {
        return res.status(400).json({
          error: "Actual duration must be a finite positive number of minutes.",
        });
      }
    }

    // 3e. Validate note
    if (note !== undefined) {
      if (typeof note !== "string") {
        return res.status(400).json({
          error: "Note must be a string.",
        });
      }
      if (note.length > 2000) {
        return res.status(400).json({
          error: "Note cannot exceed 2000 characters.",
        });
      }
    }

    // 4. Retrieve document from MongoDB
    const reqDoc = await findReq(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    // 5. Determine user credentials from verified MongoDB profile
    const userRole = String(req.user?.role || "").toLowerCase().trim();
    const userDept = req.user?.department || getDepartmentForRole(userRole);
    const isCreator = Boolean(
      req.user?.firebaseUid && reqDoc.createdBy?.uid === req.user.firebaseUid
    );
    const isSameDept = Boolean(userDept && reqDoc.dept === userDept);
    const isAuthorizedDeptUser = isCreator || isSameDept;

    // 6. Enforce permissions
    if (userRole !== "admin") {
      // Non-admins must be either the request creator or part of the assigned department
      if (!isAuthorizedDeptUser) {
        return res.status(403).json({
          error: "Access Denied: You do not have permission to update this request.",
        });
      }

      // Non-admins cannot modify the scheduling window (start)
      if (start !== undefined) {
        return res.status(403).json({
          error: "Access Denied: Only administrators can schedule time windows.",
        });
      }

      // Non-admins cannot modify completion details (doneDate, actual, note) independently
      // or outside an authorized completion workflow
      const hasCompletionFields =
        doneDate !== undefined || actual !== undefined || note !== undefined;

      if (hasCompletionFields && status !== "Completed") {
        return res.status(403).json({
          error: "Access Denied: Completion details can only be updated when completing the request.",
        });
      }

      // If updating status, enforce permitted state transitions
      if (status !== undefined) {
        const currentStatus = reqDoc.status;
        const isProgressTransition =
          status === "In Progress" && ["Pending", "Scheduled"].includes(currentStatus);
        const isCompletionTransition =
          status === "Completed" && currentStatus === "In Progress";

        if (!isProgressTransition && !isCompletionTransition) {
          return res.status(403).json({
            error: `Access Denied: Your role (${req.user?.role}) is not authorized to transition status from '${currentStatus}' to '${status}'.`,
          });
        }
      }
    }

    // 7. Apply updates to document
    if (status !== undefined) {
      reqDoc.status = status;
    }
    if (start !== undefined) {
      reqDoc.start = typeof start === "string" ? start.trim() : start;
    }
    if (doneDate !== undefined) {
      reqDoc.doneDate = doneDate.trim();
    }
    if (actual !== undefined) {
      reqDoc.actual = actualNum;
    }
    if (note !== undefined) {
      reqDoc.note = note.trim();
    }

    // 8. Persist to MongoDB Atlas
    const updated = await reqDoc.save();

    return res.json({
      message: "Status updated successfully.",
      request: updated,
    });
  } catch (error) {
    console.error("Error updating status:", error.message);
    return res.status(500).json({ error: "Failed to update request status in database." });
  }
});

export default router;
