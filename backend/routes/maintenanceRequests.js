import { Router } from "express";
import mongoose from "mongoose";
import MaintenanceRequest, {
  ASSET_CATEGORIES,
  DEPARTMENTS,
  PRIORITIES,
  STATUSES,
} from "../models/MaintenanceRequest.js";
import { authenticateToken } from "../middleware/auth.js";
import { connectDB } from "../db.js";

const router = Router();

// Protect all maintenance request routes with token verification
router.use(authenticateToken);

/**
 * Generate a unique readable request ID: e.g. REQ-2026-0001
 */
async function generateUniqueRequestId() {
  const year = new Date().getFullYear();
  const count = await MaintenanceRequest.countDocuments();
  const sequence = String(count + 1).padStart(4, "0");
  const candidateId = `REQ-${year}-${sequence}`;

  const exists = await MaintenanceRequest.findOne({ requestId: candidateId });
  if (!exists) {
    return candidateId;
  }

  return `REQ-${year}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
}

/**
 * Helper to check if a user is allowed to access a department
 */
function getDepartmentForRole(role) {
  const normalized = String(role || "").toLowerCase().trim();
  switch (normalized) {
    case "engineering":
      return "Engineering";
    case "traction":
      return "Traction/OHE";
    case "signal":
      return "Signal & Telecom";
    default:
      return null;
  }
}

/**
 * POST /api/maintenance-requests
 * Create a new maintenance request.
 * Identity is captured from req.user (MongoDB verified auth context).
 */
router.post("/", async (req, res) => {
  try {
    await connectDB();

    const {
      assetCategory,
      location,
      department,
      issueType,
      description,
      priority = "Medium",
      estimatedDuration,
      requiredResources,
      preferredDateTime,
    } = req.body || {};

    // Validate required fields
    if (!assetCategory || !ASSET_CATEGORIES.includes(assetCategory)) {
      return res.status(400).json({
        error: `Asset category is required and must be one of: ${ASSET_CATEGORIES.join(", ")}`,
      });
    }

    if (!location || !String(location).trim()) {
      return res.status(400).json({ error: "Location / track section is required." });
    }

    if (!department || !DEPARTMENTS.includes(department)) {
      return res.status(400).json({
        error: `Department is required and must be one of: ${DEPARTMENTS.join(", ")}`,
      });
    }

    if (!issueType || !String(issueType).trim()) {
      return res.status(400).json({ error: "Issue type is required." });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: "Short description is required." });
    }

    if (!priority || !PRIORITIES.includes(priority)) {
      return res.status(400).json({
        error: `Priority must be one of: ${PRIORITIES.join(", ")}`,
      });
    }

    const durationNum = Number(estimatedDuration);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: "Estimated duration must be a positive number in minutes." });
    }

    if (!requiredResources || !String(requiredResources).trim()) {
      return res.status(400).json({ error: "Required team/resources is required." });
    }

    if (!preferredDateTime || isNaN(new Date(preferredDateTime).getTime())) {
      return res.status(400).json({ error: "A valid preferred maintenance date and time is required." });
    }

    const requestId = await generateUniqueRequestId();

    const newRequest = new MaintenanceRequest({
      requestId,
      assetCategory,
      location: String(location).trim(),
      department,
      issueType: String(issueType).trim(),
      description: String(description).trim(),
      priority,
      estimatedDuration: durationNum,
      requiredResources: String(requiredResources).trim(),
      preferredDateTime: new Date(preferredDateTime),
      status: "Submitted",
      createdBy: {
        uid: req.user.firebaseUid,
        email: req.user.email,
        role: req.user.role,
      },
      statusHistory: [
        {
          status: "Submitted",
          changedByEmail: req.user.email,
          changedByRole: req.user.role,
          changedAt: new Date(),
          note: "Maintenance request created.",
        },
      ],
    });

    const savedRequest = await newRequest.save();

    return res.status(201).json({
      message: "Maintenance request created successfully.",
      request: savedRequest,
    });
  } catch (error) {
    console.error("Error creating maintenance request:", error);
    return res.status(500).json({
      error: "Failed to create maintenance request. Please try again.",
    });
  }
});

/**
 * GET /api/maintenance-requests
 * List maintenance requests the user is allowed to access.
 * Admins can see all requests; department users see their department + requests they created.
 */
router.get("/", async (req, res) => {
  try {
    await connectDB();

    const userRole = String(req.user.role || "").toLowerCase().trim();
    const query = {};

    // Filter by role/department permissions
    if (userRole !== "admin") {
      const userDept = getDepartmentForRole(userRole);
      if (userDept) {
        query.$or = [{ department: userDept }, { "createdBy.uid": req.user.firebaseUid }];
      } else {
        // e.g. passenger role
        query.$or = [{ "createdBy.uid": req.user.firebaseUid }];
      }
    }

    // Optional URL query filters
    const { department, priority, status, q } = req.query;

    if (department && DEPARTMENTS.includes(department)) {
      query.department = department;
    }
    if (priority && PRIORITIES.includes(priority)) {
      query.priority = priority;
    }
    if (status && STATUSES.includes(status)) {
      query.status = status;
    }
    if (q && String(q).trim()) {
      const searchRegex = new RegExp(String(q).trim(), "i");
      query.$or = [
        { requestId: searchRegex },
        { location: searchRegex },
        { issueType: searchRegex },
        { description: searchRegex },
      ];
    }

    const requests = await MaintenanceRequest.find(query).sort({ createdAt: -1 });

    return res.json({
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Error fetching maintenance requests:", error);
    return res.status(500).json({
      error: "Failed to retrieve maintenance requests.",
    });
  }
});

/**
 * Helper to find a request by either MongoDB _id or requestId string
 */
async function findRequestByIdOrCustomId(idParam) {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    const found = await MaintenanceRequest.findById(idParam);
    if (found) return found;
  }
  return await MaintenanceRequest.findOne({ requestId: idParam.toUpperCase() });
}

/**
 * GET /api/maintenance-requests/:id
 * Retrieve a single maintenance request.
 */
router.get("/:id", async (req, res) => {
  try {
    await connectDB();

    const request = await findRequestByIdOrCustomId(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const userRole = String(req.user.role || "").toLowerCase().trim();
    if (userRole !== "admin") {
      const userDept = getDepartmentForRole(userRole);
      const isCreator = request.createdBy.uid === req.user.firebaseUid;
      const isSameDept = userDept && request.department === userDept;

      if (!isCreator && !isSameDept) {
        return res.status(403).json({
          error: "Access Denied: You do not have permission to view this request.",
        });
      }
    }

    return res.json({ request });
  } catch (error) {
    console.error("Error retrieving maintenance request:", error);
    return res.status(500).json({ error: "Failed to retrieve maintenance request." });
  }
});

/**
 * PATCH /api/maintenance-requests/:id/status
 * Update the status of a maintenance request.
 * Enforces valid transition paths and role permissions.
 */
router.patch("/:id/status", async (req, res) => {
  try {
    await connectDB();

    const { status: newStatus, note = "" } = req.body || {};

    if (!newStatus || !STATUSES.includes(newStatus)) {
      return res.status(400).json({
        error: `A valid status is required. Allowed statuses: ${STATUSES.join(", ")}`,
      });
    }

    const request = await findRequestByIdOrCustomId(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const currentStatus = request.status;
    const userRole = String(req.user.role || "").toLowerCase().trim();
    const userDept = getDepartmentForRole(userRole);
    const isCreator = request.createdBy.uid === req.user.firebaseUid;
    const isSameDept = userDept && request.department === userDept;

    if (currentStatus === newStatus) {
      return res.status(400).json({
        error: `Request is already in status '${newStatus}'.`,
      });
    }

    // Terminal statuses cannot transition further
    if (["Completed", "Rejected", "Cancelled"].includes(currentStatus)) {
      return res.status(400).json({
        error: `Cannot update a request that is already '${currentStatus}'.`,
      });
    }

    // Valid transition definitions
    const allowedTransitions = {
      Submitted: ["Under Review", "Approved", "Rejected", "Cancelled"],
      "Under Review": ["Approved", "Rejected", "Cancelled"],
      Approved: ["Scheduled", "In Progress", "Cancelled"],
      Scheduled: ["In Progress", "Cancelled"],
      "In Progress": ["Completed", "Cancelled"],
    };

    const validNextStates = allowedTransitions[currentStatus] || [];
    if (!validNextStates.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid transition from '${currentStatus}' to '${newStatus}'. Allowed: ${validNextStates.join(", ") || "none"}`,
      });
    }

    // Role-based authorization on specific actions
    if (userRole === "admin") {
      // Admins can execute all valid transitions
    } else if (isCreator || isSameDept) {
      // Creators can cancel submitted requests
      if (newStatus === "Cancelled" && ["Submitted", "Under Review"].includes(currentStatus)) {
        // Allowed
      }
      // Department teams can start and complete approved/scheduled work
      else if (
        (newStatus === "In Progress" && ["Approved", "Scheduled"].includes(currentStatus)) ||
        (newStatus === "Completed" && currentStatus === "In Progress")
      ) {
        // Allowed
      } else {
        return res.status(403).json({
          error: `Access Denied: Your role (${req.user.role}) is not authorized to transition request from '${currentStatus}' to '${newStatus}'. Only administrators can approve or reject requests.`,
        });
      }
    } else {
      return res.status(403).json({
        error: "Access Denied: You do not have permission to modify this request.",
      });
    }

    // Update status and append to history
    request.status = newStatus;
    request.statusHistory.push({
      status: newStatus,
      changedByEmail: req.user.email,
      changedByRole: req.user.role,
      changedAt: new Date(),
      note: String(note || "").trim(),
    });

    const updatedRequest = await request.save();

    return res.json({
      message: `Status updated to '${newStatus}' successfully.`,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating maintenance request status:", error);
    return res.status(500).json({
      error: "Failed to update maintenance request status.",
    });
  }
});

export default router;
