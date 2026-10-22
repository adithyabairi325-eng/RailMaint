import { Router } from "express";
import mongoose from "mongoose";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import { authenticateToken } from "../middleware/auth.js";
import { connectDB } from "../db.js";

const router = Router();

// Protect endpoints with token authentication
router.use(authenticateToken);

/**
 * GET /api/maintenance-requests
 * Retrieve maintenance requests from MongoDB Atlas
 */
router.get("/", async (req, res) => {
  try {
    await connectDB();
    const requests = await MaintenanceRequest.find().sort({ createdAt: -1 });
    return res.json({ requests, count: requests.length });
  } catch (error) {
    console.error("Error fetching maintenance requests:", error.message);
    return res.status(500).json({ error: "Failed to retrieve maintenance requests from database." });
  }
});

/**
 * POST /api/maintenance-requests
 * Create a maintenance request in MongoDB Atlas
 */
router.post("/", async (req, res) => {
  try {
    await connectDB();

    const body = req.body || {};

    let requestId = body.id || body.requestId;
    if (!requestId) {
      const count = await MaintenanceRequest.countDocuments();
      requestId = `MR-${1001 + count}`;
    }

    const newRequest = new MaintenanceRequest({
      id: requestId,
      asset: body.asset || body.assetCategory || "TRK_101",
      dept: body.dept || body.department || "Engineering / Track",
      type: body.type || body.issueType || "Maintenance Inspection",
      pri: body.pri || body.priority || "Medium",
      date: body.date || new Date().toISOString().slice(0, 10),
      dur: Number(body.dur || body.estimatedDuration || 60),
      desc: body.desc || body.description || "",
      status: body.status || "Pending",
      start: body.start || null,
      doneDate: body.doneDate || null,
      actual: body.actual ? Number(body.actual) : null,
      note: body.note || "",
      createdBy: {
        uid: req.user?.firebaseUid || "",
        email: req.user?.email || "",
        role: req.user?.role || "",
      },
    });

    const saved = await newRequest.save();
    return res.status(201).json({ message: "Request saved to MongoDB Atlas", request: saved });
  } catch (error) {
    console.error("Error creating maintenance request:", error.message);
    return res.status(500).json({ error: "Failed to save maintenance request to database." });
  }
});

/**
 * Helper to find by id or custom MR ID
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
 * Retrieve a single request by ID
 */
router.get("/:id", async (req, res) => {
  try {
    await connectDB();
    const reqDoc = await findReq(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }
    return res.json({ request: reqDoc });
  } catch (error) {
    console.error("Error finding request:", error.message);
    return res.status(500).json({ error: "Failed to retrieve maintenance request." });
  }
});

/**
 * PATCH /api/maintenance-requests/:id/status
 * Update status and work details in MongoDB Atlas
 */
router.patch("/:id/status", async (req, res) => {
  try {
    await connectDB();
    const reqDoc = await findReq(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({ error: "Maintenance request not found." });
    }

    const { status, doneDate, actual, note } = req.body || {};
    if (status) reqDoc.status = status;
    if (doneDate) reqDoc.doneDate = doneDate;
    if (actual !== undefined && actual !== null) reqDoc.actual = Number(actual);
    if (note !== undefined) reqDoc.note = String(note).trim();

    const updated = await reqDoc.save();
    return res.json({ message: "Status updated in MongoDB Atlas", request: updated });
  } catch (error) {
    console.error("Error updating status:", error.message);
    return res.status(500).json({ error: "Failed to update status in database." });
  }
});

export default router;
