import { Router } from "express";
import mongoose from "mongoose";
import MaintenanceRequest, {
  ALLOWED_PRIORITIES,
  ALLOWED_STATUSES,
  ALLOWED_DEPARTMENTS,
} from "../models/MaintenanceRequest.js";
import { authenticateToken } from "../middleware/auth.js";
import { connectDB } from "../db.js";
import { findAsset } from "./assets.js";
import { createNotification } from "../services/notificationService.js";

const router = Router();

// Protect all routes with Firebase ID token and MongoDB profile verification
router.use(authenticateToken);

/**
 * Supported fields for PATCH /:id/status
 */
export const ALLOWED_UPDATE_FIELDS = ["status", "start", "doneDate", "actual", "note"];

/**
 * Strict calendar date validator for YYYY-MM-DD.
 * Rejects malformed strings and impossible calendar dates (e.g. Feb 30, non-leap year Feb 29, April 31).
 */
export function isValidDateString(str) {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [yStr, mStr, dStr] = trimmed.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Map user roles to corresponding department name
 */
export function getDepartmentForRole(role) {
  const normalized = String(role || "").toLowerCase().trim();
  switch (normalized) {
    case "engineering":
      return "Engineering / Track";
    case "traction":
    case "electrical":
      return "Electrical / Traction";
    case "signal":
    case "telecom":
      return "Signal & Telecom";
    case "mechanical":
      return "Mechanical";
    case "bridges":
    case "bridge":
      return "Bridges";
    default:
      return null;
  }
}

/**
 * Safely generate the next sequential unique request ID (e.g. MR-1001, MR-1002) with bounded attempts
 */
async function generateUniqueRequestId() {
  if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
    const existingIds = Object.keys(global.__TEST_DOCS__);
    const nums = existingIds
      .map((id) => {
        const match = String(id).match(/^MR-(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));

    let candNum = (nums.length ? Math.max(...nums) : 1000) + 1;
    return `MR-${candNum}`;
  }

  const existing = await MaintenanceRequest.find({}, "id").lean();
  const nums = existing
    .map((r) => {
      const match = String(r.id).match(/^MR-(\d+)$/i);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n) => n !== null && !isNaN(n));

  let candidateNum = (nums.length ? Math.max(...nums) : 1000) + 1;
  let candidateId = `MR-${candidateNum}`;

  let attempts = 0;
  const MAX_ATTEMPTS = 50;
  while (attempts < MAX_ATTEMPTS && (await MaintenanceRequest.exists({ id: candidateId }))) {
    candidateNum++;
    candidateId = `MR-${candidateNum}`;
    attempts++;
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
      const userDept = req.user?.department || getDepartmentForRole(userRole);
      if (userDept) {
        query.$or = [{ dept: userDept }, { "createdBy.uid": req.user.firebaseUid }];
      } else {
        query["createdBy.uid"] = req.user.firebaseUid;
      }
    }

    if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
      const all = Object.values(global.__TEST_DOCS__);
      const filtered = all.filter((r) => {
        if (userRole !== "admin") {
          const userDept = req.user?.department || getDepartmentForRole(userRole);
          const isCreator = r.createdBy?.uid === req.user?.firebaseUid;
          const isDept = userDept && r.dept === userDept;
          if (!isCreator && !isDept) return false;
        }
        if (req.query.dept && r.dept !== req.query.dept) return false;
        if (req.query.status && r.status !== req.query.status) return false;
        return true;
      });
      return res.json({
        requests: filtered,
        count: filtered.length,
      });
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

    // 1. Validate Asset existence and status
    if (!asset || !String(asset).trim()) {
      return res.status(400).json({ error: "Asset identifier is required." });
    }

    const assetIdTrimmed = String(asset).trim();
    const assetDoc = await findAsset(assetIdTrimmed);

    if (!assetDoc) {
      return res.status(404).json({ error: `Asset '${assetIdTrimmed}' not found.` });
    }

    if (assetDoc.isDeleted || assetDoc.status === "Decommissioned" || assetDoc.status === "Inactive") {
      return res.status(400).json({
        error: `Asset '${assetIdTrimmed}' is inactive or decommissioned and cannot receive new maintenance requests.`,
      });
    }

    // 2. Validate Department
    if (!dept || !ALLOWED_DEPARTMENTS.includes(dept)) {
      return res.status(400).json({
        error: `Department is invalid. Allowed: ${ALLOWED_DEPARTMENTS.join(", ")}`,
      });
    }

    // Asset department must match request department
    if (assetDoc.department && assetDoc.department !== dept) {
      return res.status(400).json({
        error: `Asset department '${assetDoc.department}' does not match request department '${dept}'.`,
      });
    }

    const linkedAssetRef = assetDoc._id;
    const finalAssetIdentifier = assetDoc.assetId || assetIdTrimmed;

    // Role-based department check: non-admins can only create requests for their own department
    const userRole = String(req.user?.role || "").toLowerCase().trim();
    if (userRole === "passenger") {
      return res.status(403).json({
        error: "Access Denied: Passengers are not permitted to submit internal maintenance requests.",
      });
    }

    if (userRole !== "admin") {
      const permittedDept = req.user?.department || getDepartmentForRole(userRole);
      if (!permittedDept) {
        return res.status(403).json({
          error: `Access Denied: Role '${req.user?.role}' is not authorized to create maintenance requests.`,
        });
      }
      if (dept !== permittedDept) {
        return res.status(403).json({
          error: `Access Denied: Your role (${req.user?.role}) can only submit requests for ${permittedDept}.`,
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

    // 5. Validate Date strictly
    if (!date || !isValidDateString(date)) {
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

    // Bounded retry loop for concurrent unique ID generation and MongoDB duplicate-key handling
    const MAX_RETRIES = 5;
    let saved = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const uniqueId = await generateUniqueRequestId();

      // Create record: creator and status are determined by backend context, NEVER client input
      const newRequest = new MaintenanceRequest({
        id: uniqueId,
        asset: finalAssetIdentifier,
        assetRef: linkedAssetRef,
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

      try {
        if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
          if (global.__TEST_FORCE_MR_COLLISION__ && attempt === 1) {
            global.__TEST_FORCE_MR_COLLISION__ = false;
            const dupErr = new Error("E11000 duplicate key error collection");
            dupErr.code = 11000;
            throw dupErr;
          }
          saved = {
            _id: newRequest._id || new mongoose.Types.ObjectId().toString(),
            id: uniqueId,
            asset: finalAssetIdentifier,
            assetRef: linkedAssetRef,
            dept,
            type: String(type).trim(),
            pri,
            date: String(date).trim(),
            dur: durationNum,
            desc: String(desc).trim(),
            status: "Pending",
            start: null,
            doneDate: null,
            actual: null,
            note: "",
            createdBy: {
              uid: req.user.firebaseUid,
              email: req.user.email,
              role: req.user.role,
            },
            saveCallCount: 1,
            async save() {
              this.saveCallCount++;
              if (global.__TEST_DOCS__) {
                global.__TEST_DOCS__[this.id] = this;
              }
              return { ...this };
            },
          };
          global.__TEST_DOCS__[uniqueId] = saved;
          break;
        } else {
          saved = await newRequest.save();
          break;
        }
      } catch (err) {
        lastError = err;
        if (err?.code === 11000 && attempt < MAX_RETRIES) {
          continue;
        }
        throw err;
      }
    }

    if (!saved) {
      console.error("Exhausted retries generating unique request ID:", lastError?.message);
      return res.status(500).json({ error: "Failed to generate unique maintenance request ID after retries." });
    }

    try {
      await createNotification({
        kind: "request-created",
        title: `New Maintenance Request: ${saved.id}`,
        desc: `${saved.type} for asset ${saved.asset} (${saved.pri} priority).`,
        department: saved.dept,
        ref: { id: saved.id, t: "request" },
      });
    } catch (notifErr) {
      console.warn("Could not create notification for new request:", notifErr.message);
    }

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
  const trimmed = String(idParam).trim();
  if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
    if (global.__TEST_DOCS__[trimmed]) return global.__TEST_DOCS__[trimmed];
    const foundInMock = Object.values(global.__TEST_DOCS__).find(
      (r) => r.id === trimmed || String(r._id) === trimmed
    );
    return foundInMock || null;
  }

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const found = await MaintenanceRequest.findById(trimmed);
    if (found) return found;
  }
  return await MaintenanceRequest.findOne({
    $or: [{ id: trimmed }, { id: new RegExp(`^${trimmed}$`, "i") }],
  });
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
      if (!isValidDateString(doneDate)) {
        return res.status(400).json({
          error: "Invalid date format for doneDate. Expected valid calendar date in YYYY-MM-DD format.",
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
    if (userRole === "passenger") {
      return res.status(403).json({
        error: "Access Denied: Passengers are not permitted to update maintenance requests.",
      });
    }
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

    try {
      if (status === "Completed") {
        await createNotification({
          kind: "completed",
          title: `Maintenance Completed: ${reqDoc.id}`,
          desc: `${reqDoc.type} for asset ${reqDoc.asset} marked as Completed.`,
          department: reqDoc.dept,
          ref: { id: reqDoc.id, t: "request" },
        });
      } else if (start !== undefined && start !== null) {
        await createNotification({
          kind: "schedule-change",
          title: `Schedule Updated: ${reqDoc.id}`,
          desc: `Scheduled window set to ${reqDoc.start} for ${reqDoc.asset}.`,
          department: reqDoc.dept,
          ref: { id: reqDoc.id, t: "request" },
        });
      }
    } catch (notifErr) {
      console.warn("Could not create notification for status update:", notifErr.message);
    }

    return res.json({
      message: "Status updated successfully.",
      request: updated,
    });
  } catch (error) {
    console.error("Error updating status:", error.message);
    return res.status(500).json({ error: "Failed to update request status in database." });
  }
});

/**
 * DELETE /api/maintenance-requests/:id
 * Delete a maintenance request.
 * Enforces role and creator permissions.
 */
router.delete("/:id", async (req, res) => {
  try {
    await connectDB();

    const reqDoc = await findReq(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const userRole = String(req.user?.role || "").toLowerCase().trim();
    if (userRole === "passenger") {
      return res.status(403).json({
        error: "Access Denied: Passengers are not permitted to delete requests.",
      });
    }

    // Role check: Admin can delete any request. Department users can delete requests in their department or that they created.
    if (userRole !== "admin") {
      const userDept = getDepartmentForRole(userRole);
      const isCreator = reqDoc.createdBy?.uid === req.user?.firebaseUid;
      const isSameDept = Boolean(userDept && reqDoc.dept === userDept);

      if (!isCreator && !isSameDept) {
        return res.status(403).json({
          error: "Access Denied: You do not have permission to delete this request.",
        });
      }
    }

    if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
      delete global.__TEST_DOCS__[req.params.id];
      delete global.__TEST_DOCS__[reqDoc.id];
    } else {
      await MaintenanceRequest.deleteOne({
        $or: [{ _id: reqDoc._id }, { id: reqDoc.id }, { id: req.params.id }],
      });
    }

    return res.json({
      message: "Maintenance request deleted successfully.",
      id: reqDoc.id,
      deleted: true,
    });
  } catch (error) {
    console.error("Error deleting maintenance request:", error.message);
    return res.status(500).json({ error: "Failed to delete maintenance request from database." });
  }
});

export default router;
