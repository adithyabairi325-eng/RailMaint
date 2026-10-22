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
 * Map user roles to corresponding department name
 */
function getDepartmentForRole(role) {
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
async function findReq(idParam) {
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
 * Validates allowed statuses and enforces role permissions.
 */
router.patch("/:id/status", async (req, res) => {
  try {
    await connectDB();

    const reqDoc = await findReq(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const { status, doneDate, actual, note, start } = req.body || {};

    // Validate Status if changing status
    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid status '${status}'. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}`,
        });
      }

      const userRole = String(req.user.role || "").toLowerCase().trim();
      const userDept = getDepartmentForRole(userRole);
      const isCreator = reqDoc.createdBy.uid === req.user.firebaseUid;
      const isSameDept = userDept && reqDoc.dept === userDept;

      // Permission check: Admins can update any status; Department users can only update work progress
      if (userRole === "admin") {
        reqDoc.status = status;
      } else if (isCreator || isSameDept) {
        // Department team can progress to In Progress or Completed
        if (
          (status === "In Progress" && ["Scheduled", "Pending"].includes(reqDoc.status)) ||
          (status === "Completed" && reqDoc.status === "In Progress")
        ) {
          reqDoc.status = status;
        } else {
          return res.status(403).json({
            error: `Access Denied: Your role (${req.user.role}) is not authorized to set status to '${status}'.`,
          });
        }
      } else {
        return res.status(403).json({
          error: "Access Denied: You do not have permission to update this request.",
        });
      }
    }

    // Schedule start time (Admin only)
    if (start !== undefined) {
      const userRole = String(req.user.role || "").toLowerCase().trim();
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Access Denied: Only administrators can schedule time windows." });
      }
      reqDoc.start = start;
    }

    // Completion details
    if (doneDate !== undefined) reqDoc.doneDate = doneDate;
    if (actual !== undefined && actual !== null) {
      const actualNum = Number(actual);
      if (isNaN(actualNum) || actualNum <= 0) {
        return res.status(400).json({ error: "Actual duration must be a positive number." });
      }
      reqDoc.actual = actualNum;
    }
    if (note !== undefined) reqDoc.note = String(note).trim();

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
