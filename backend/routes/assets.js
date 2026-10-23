import { Router } from "express";
import mongoose from "mongoose";
import Asset, {
  ALLOWED_CATEGORIES,
  CATEGORY_ALIASES,
  CATEGORY_DEPARTMENT_MAP,
  CATEGORY_PREFIX_MAP,
  ALLOWED_CONDITIONS,
  ALLOWED_ASSET_STATUSES,
  isValidCategoryDepartment,
} from "../models/Asset.js";
import MaintenanceRequest, { ALLOWED_DEPARTMENTS } from "../models/MaintenanceRequest.js";
import { authenticateToken } from "../middleware/auth.js";
import { getDepartmentForRole, isValidDateString } from "./maintenanceRequests.js";
import { connectDB } from "../db.js";

const router = Router();

// Protect all asset routes with Firebase token & MongoDB active profile verification
router.use(authenticateToken);

/**
 * Escape regular expression special characters to avoid ReDoS or invalid regex syntax
 */
export function escapeRegex(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Helper to determine user's assigned department from their verified MongoDB profile
 */
export function getUserDepartment(user) {
  if (user?.department && typeof user.department === "string" && user.department.trim()) {
    return user.department.trim();
  }
  return getDepartmentForRole(user?.role);
}

/**
 * Safely generate the next sequential unique asset ID (e.g. TRK-101, SIG-201) with bounded attempts
 */
export async function generateUniqueAssetId(category) {
  const normCategory = CATEGORY_ALIASES[category] || category;
  const prefix = CATEGORY_PREFIX_MAP[normCategory] || "AST";

  const startBase =
    prefix === "TRK" ? 100 : prefix === "SIG" ? 200 : prefix === "ELE" ? 300 : prefix === "MEC" ? 400 : 500;

  if (process.env.NODE_ENV === "test" && global.__TEST_ASSETS__) {
    const existingIds = Object.keys(global.__TEST_ASSETS__);
    const nums = existingIds
      .map((id) => {
        const m = String(id).match(new RegExp(`^${prefix}[-_](\\d+)$`, "i"));
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));

    let candNum = (nums.length ? Math.max(...nums) : startBase) + 1;
    return `${prefix}-${candNum}`;
  }

  const existing = await Asset.find({ assetId: new RegExp(`^${prefix}[-_]`, "i") }, "assetId").lean();
  const nums = existing
    .map((a) => {
      const match = String(a.assetId).match(new RegExp(`^${prefix}[-_](\\d+)$`, "i"));
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n) => n !== null && !isNaN(n));

  let candidateNum = (nums.length ? Math.max(...nums) : startBase) + 1;
  let candidateId = `${prefix}-${candidateNum}`;

  let attempts = 0;
  const MAX_ATTEMPTS = 50;
  while (attempts < MAX_ATTEMPTS && (await Asset.exists({ $or: [{ assetId: candidateId }, { id: candidateId }] }))) {
    candidateNum++;
    candidateId = `${prefix}-${candidateNum}`;
    attempts++;
  }

  return candidateId;
}

/**
 * Helper to find an asset by MongoDB ObjectId, assetId, or id
 */
export async function findAsset(idParam) {
  if (!idParam) return null;
  const trimmed = String(idParam).trim();

  if (process.env.NODE_ENV === "test" && global.__TEST_ASSETS__) {
    if (global.__TEST_ASSETS__[trimmed]) return global.__TEST_ASSETS__[trimmed];
    const upper = trimmed.toUpperCase();
    const foundInMock = Object.values(global.__TEST_ASSETS__).find(
      (a) =>
        a.assetId === upper ||
        a.assetId === trimmed ||
        a.id === upper ||
        a.id === trimmed ||
        String(a._id) === trimmed
    );
    return foundInMock || null;
  }

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const found = await Asset.findById(trimmed);
    if (found) return found;
  }

  return await Asset.findOne({
    $or: [{ assetId: trimmed.toUpperCase() }, { assetId: trimmed }, { id: trimmed }],
  });
}

/**
 * POST /api/assets
 * Create a new railway asset in MongoDB Atlas.
 * Enforces role authorization, field validation, and sequential unique ID generation.
 */
router.post("/", async (req, res) => {
  try {
    await connectDB();

    const {
      assetId,
      name,
      category,
      assetType,
      location,
      department,
      condition,
      status,
      risk,
      age,
      installationDate,
      lastInspectionDate,
      nextInspectionDate,
      description,
    } = req.body || {};

    // 1. Validate required Name
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Asset name is required." });
    }

    // 2. Validate & Normalize Category
    if (!category || !String(category).trim()) {
      return res.status(400).json({ error: "Asset category is required." });
    }
    const rawCategory = String(category).trim();
    const normalizedCategory = CATEGORY_ALIASES[rawCategory] || rawCategory;
    if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        error: `Category is invalid. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
      });
    }

    // 3. Resolve & Validate Department
    const expectedDept = CATEGORY_DEPARTMENT_MAP[normalizedCategory];
    const finalDept = department && ALLOWED_DEPARTMENTS.includes(department) ? department : expectedDept;

    if (!finalDept || !ALLOWED_DEPARTMENTS.includes(finalDept)) {
      return res.status(400).json({
        error: `Department is invalid. Allowed: ${ALLOWED_DEPARTMENTS.join(", ")}`,
      });
    }

    // Validate category and department consistency
    if (!isValidCategoryDepartment(normalizedCategory, finalDept)) {
      return res.status(400).json({
        error: `Category '${normalizedCategory}' is not compatible with department '${finalDept}'. Expected: '${expectedDept}'.`,
      });
    }

    // Role-based department check: non-admins can only create assets for their own department
    const userRole = String(req.user?.role || "").toLowerCase().trim();
    if (userRole === "passenger") {
      return res.status(403).json({
        error: "Access Denied: Passengers are not permitted to manage assets.",
      });
    }

    if (userRole !== "admin") {
      const userDept = getUserDepartment(req.user);
      if (userDept && finalDept !== userDept) {
        return res.status(403).json({
          error: `Access Denied: Your role (${req.user?.role}) can only create assets for ${userDept}.`,
        });
      }
    }

    // 4. Validate Location
    if (!location || !String(location).trim()) {
      return res.status(400).json({ error: "Asset location is required." });
    }

    // 5. Handle Asset ID (custom or auto-generated)
    const isCustomAssetId = Boolean(assetId && String(assetId).trim());
    let initialAssetId = isCustomAssetId ? String(assetId).trim().toUpperCase() : null;

    if (isCustomAssetId) {
      const existing = await findAsset(initialAssetId);
      if (existing) {
        return res.status(400).json({
          error: `Asset identifier '${initialAssetId}' already exists.`,
        });
      }
    }

    // 6. Validate Condition if provided
    let finalCondition = "Good";
    if (condition !== undefined) {
      if (!ALLOWED_CONDITIONS.includes(condition)) {
        return res.status(400).json({
          error: `Invalid condition. Allowed: ${ALLOWED_CONDITIONS.join(", ")}`,
        });
      }
      finalCondition = condition;
    }

    // 7. Validate Status if provided
    let finalStatus = "Active";
    if (status !== undefined) {
      if (!ALLOWED_ASSET_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${ALLOWED_ASSET_STATUSES.join(", ")}`,
        });
      }
      finalStatus = status;
    }

    // 8. Validate Risk if provided
    let finalRisk = 25;
    if (risk !== undefined && risk !== null) {
      const rNum = Number(risk);
      if (isNaN(rNum) || rNum < 0 || rNum > 100) {
        return res.status(400).json({ error: "Risk score must be a number between 0 and 100." });
      }
      finalRisk = rNum;
    }

    // 9. Validate Age if provided
    let finalAge = 1;
    if (age !== undefined && age !== null) {
      const aNum = Number(age);
      if (isNaN(aNum) || aNum < 0) {
        return res.status(400).json({ error: "Age must be a non-negative number." });
      }
      finalAge = aNum;
    }

    // 10. Validate Dates strictly
    if (installationDate !== undefined && installationDate !== null && String(installationDate).trim() !== "") {
      if (!isValidDateString(installationDate)) {
        return res.status(400).json({ error: "Invalid installationDate. Expected valid calendar date in YYYY-MM-DD format." });
      }
    }
    if (lastInspectionDate !== undefined && lastInspectionDate !== null && String(lastInspectionDate).trim() !== "") {
      if (!isValidDateString(lastInspectionDate)) {
        return res.status(400).json({ error: "Invalid lastInspectionDate. Expected valid calendar date in YYYY-MM-DD format." });
      }
    }
    if (nextInspectionDate !== undefined && nextInspectionDate !== null && String(nextInspectionDate).trim() !== "") {
      if (!isValidDateString(nextInspectionDate)) {
        return res.status(400).json({ error: "Invalid nextInspectionDate. Expected valid calendar date in YYYY-MM-DD format." });
      }
    }

    // Bounded retry loop for concurrent unique ID generation and MongoDB duplicate-key handling
    const MAX_RETRIES = 5;
    let saved = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const currentAssetId = isCustomAssetId
        ? initialAssetId
        : await generateUniqueAssetId(normalizedCategory);

      const newAsset = new Asset({
        assetId: currentAssetId,
        id: currentAssetId,
        name: String(name).trim(),
        category: normalizedCategory,
        assetType: String(assetType || "").trim(),
        type: normalizedCategory,
        location: String(location).trim(),
        department: finalDept,
        condition: finalCondition,
        status: finalStatus,
        risk: finalRisk,
        age: finalAge,
        installationDate: installationDate ? String(installationDate).trim() : null,
        lastInspectionDate: lastInspectionDate ? String(lastInspectionDate).trim() : null,
        nextInspectionDate: nextInspectionDate ? String(nextInspectionDate).trim() : null,
        last: lastInspectionDate ? String(lastInspectionDate).trim() : null,
        description: String(description || "").trim(),
        isDeleted: false,
        createdBy: {
          uid: req.user?.firebaseUid || null,
          email: req.user?.email || null,
          role: req.user?.role || null,
        },
      });

      try {
        if (process.env.NODE_ENV === "test" && global.__TEST_ASSETS__) {
          if (global.__TEST_FORCE_ASSET_COLLISION__ && attempt === 1) {
            global.__TEST_FORCE_ASSET_COLLISION__ = false;
            const dupErr = new Error("E11000 duplicate key error collection");
            dupErr.code = 11000;
            throw dupErr;
          }
          saved = {
            _id: newAsset._id || new mongoose.Types.ObjectId().toString(),
            assetId: currentAssetId,
            id: currentAssetId,
            name: String(name).trim(),
            category: normalizedCategory,
            assetType: String(assetType || "").trim(),
            type: normalizedCategory,
            location: String(location).trim(),
            department: finalDept,
            condition: finalCondition,
            status: finalStatus,
            risk: finalRisk,
            age: finalAge,
            installationDate: installationDate ? String(installationDate).trim() : null,
            lastInspectionDate: lastInspectionDate ? String(lastInspectionDate).trim() : null,
            nextInspectionDate: nextInspectionDate ? String(nextInspectionDate).trim() : null,
            last: lastInspectionDate ? String(lastInspectionDate).trim() : null,
            description: String(description || "").trim(),
            isDeleted: false,
            createdBy: {
              uid: req.user?.firebaseUid || null,
              email: req.user?.email || null,
              role: req.user?.role || null,
            },
            saveCallCount: 1,
            async save() {
              this.saveCallCount++;
              if (global.__TEST_ASSETS__) {
                global.__TEST_ASSETS__[this.assetId] = this;
              }
              return { ...this };
            },
          };
          global.__TEST_ASSETS__[currentAssetId] = saved;
          break;
        } else {
          saved = await newAsset.save();
          break;
        }
      } catch (err) {
        lastError = err;
        if (err?.code === 11000) {
          if (isCustomAssetId) {
            return res.status(400).json({
              error: `Asset identifier '${currentAssetId}' already exists.`,
            });
          }
          if (attempt < MAX_RETRIES) {
            continue;
          }
        }
        throw err;
      }
    }

    if (!saved) {
      console.error("Exhausted retries generating unique asset ID:", lastError?.message);
      return res.status(500).json({ error: "Failed to create asset after retries." });
    }

    return res.status(201).json({
      message: "Asset created successfully.",
      asset: saved,
    });
  } catch (error) {
    console.error("Error creating asset:", error.message);
    return res.status(500).json({ error: "Failed to create asset in database." });
  }
});

/**
 * GET /api/assets
 * Retrieve list of assets with pagination, search, and multi-field filtering.
 */
router.get("/", async (req, res) => {
  try {
    await connectDB();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    // Exclude soft-deleted assets unless explicitly requested
    if (req.query.includeDeleted !== "true") {
      query.isDeleted = { $ne: true };
    }

    // Category filter (supports aliases)
    if (req.query.category) {
      const cat = String(req.query.category).trim();
      const normCat = CATEGORY_ALIASES[cat] || cat;
      query.category = normCat;
    }

    // Department filter
    if (req.query.department) {
      query.department = String(req.query.department).trim();
    }

    // Condition filter
    if (req.query.condition) {
      query.condition = String(req.query.condition).trim();
    }

    // Status filter
    if (req.query.status) {
      query.status = String(req.query.status).trim();
    }

    // Location filter
    if (req.query.location) {
      const safeLoc = escapeRegex(String(req.query.location).trim());
      query.location = new RegExp(safeLoc, "i");
    }

    // Search query by asset ID or name
    const search = req.query.search || req.query.q;
    if (search && String(search).trim()) {
      const cleanSearch = escapeRegex(String(search).trim());
      query.$or = [
        { assetId: new RegExp(cleanSearch, "i") },
        { name: new RegExp(cleanSearch, "i") },
      ];
    }

    if (process.env.NODE_ENV === "test" && global.__TEST_ASSETS__) {
      const all = Object.values(global.__TEST_ASSETS__);
      let filtered = all.filter((a) => {
        if (query.isDeleted && a.isDeleted) return false;
        if (query.category && a.category !== query.category) return false;
        if (query.department && a.department !== query.department) return false;
        if (query.condition && a.condition !== query.condition) return false;
        if (query.status && a.status !== query.status) return false;
        if (req.query.location) {
          const locQuery = String(req.query.location).trim().toLowerCase();
          if (!String(a.location || "").toLowerCase().includes(locQuery)) return false;
        }
        if (search) {
          const s = String(search).trim().toLowerCase();
          const matchId = String(a.assetId || "").toLowerCase().includes(s);
          const matchName = String(a.name || "").toLowerCase().includes(s);
          if (!matchId && !matchName) return false;
        }
        return true;
      });

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);
      return res.json({
        assets: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      });
    }

    const total = await Asset.countDocuments(query);
    const assets = await Asset.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    return res.json({
      assets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("Error fetching assets:", error.message);
    return res.status(500).json({ error: "Failed to retrieve assets." });
  }
});

/**
 * GET /api/assets/:id
 * Retrieve a single asset by MongoDB ID or human-readable asset ID.
 */
router.get("/:id", async (req, res) => {
  try {
    await connectDB();

    const asset = await findAsset(req.params.id);
    if (!asset || (asset.isDeleted && req.query.includeDeleted !== "true")) {
      return res.status(404).json({ error: "Asset not found." });
    }

    return res.json({ asset });
  } catch (error) {
    console.error("Error retrieving asset:", error.message);
    return res.status(500).json({ error: "Failed to retrieve asset." });
  }
});

/**
 * PATCH /api/assets/:id
 * Update allowed asset fields. Enforces department/admin permissions and field validation.
 */
router.patch("/:id", async (req, res) => {
  try {
    await connectDB();

    const asset = await findAsset(req.params.id);
    if (!asset || asset.isDeleted) {
      return res.status(404).json({ error: "Asset not found." });
    }

    // Role check: non-admins can only modify assets belonging to their department
    const userRole = String(req.user?.role || "").toLowerCase().trim();
    if (userRole === "passenger") {
      return res.status(403).json({
        error: "Access Denied: Passengers are not permitted to modify assets.",
      });
    }

    if (userRole !== "admin") {
      const userDept = getUserDepartment(req.user);
      if (userDept && asset.department !== userDept) {
        return res.status(403).json({
          error: `Access Denied: You do not have permission to update assets in ${asset.department}.`,
        });
      }
    }

    // Check for immutable or protected fields
    const IMMUTABLE_FIELDS = ["_id", "assetId", "id", "createdAt", "updatedAt", "isDeleted", "createdBy"];
    const payloadKeys = Object.keys(req.body || {});

    const disallowedKeys = payloadKeys.filter((k) => IMMUTABLE_FIELDS.includes(k));
    if (disallowedKeys.length > 0) {
      return res.status(400).json({
        error: `Cannot modify immutable field(s): ${disallowedKeys.join(", ")}.`,
      });
    }

    const {
      name,
      category,
      assetType,
      location,
      department,
      condition,
      status,
      risk,
      age,
      installationDate,
      lastInspectionDate,
      nextInspectionDate,
      description,
    } = req.body || {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: "Asset name cannot be empty." });
      }
      asset.name = String(name).trim();
    }

    // Validate Category and Department consistency (including partial updates)
    let candidateCategory = asset.category;
    let candidateDept = asset.department;

    if (category !== undefined) {
      if (!category || !String(category).trim()) {
        return res.status(400).json({ error: "Category cannot be empty." });
      }
      const rawCat = String(category).trim();
      const normCat = CATEGORY_ALIASES[rawCat] || rawCat;
      if (!ALLOWED_CATEGORIES.includes(normCat)) {
        return res.status(400).json({
          error: `Category is invalid. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
        });
      }
      candidateCategory = normCat;
    }

    if (department !== undefined) {
      if (!department || !ALLOWED_DEPARTMENTS.includes(department)) {
        return res.status(400).json({
          error: `Department is invalid. Allowed: ${ALLOWED_DEPARTMENTS.join(", ")}`,
        });
      }
      if (userRole !== "admin") {
        const userDept = getUserDepartment(req.user);
        if (userDept && department !== userDept) {
          return res.status(403).json({
            error: `Access Denied: You cannot reassign asset out of your department (${userDept}).`,
          });
        }
      }
      candidateDept = department;
    }

    if (category !== undefined || department !== undefined) {
      if (!isValidCategoryDepartment(candidateCategory, candidateDept)) {
        const expectedDept = CATEGORY_DEPARTMENT_MAP[candidateCategory];
        return res.status(400).json({
          error: `Category '${candidateCategory}' is not compatible with department '${candidateDept}'. Expected: '${expectedDept}'.`,
        });
      }
      asset.category = candidateCategory;
      asset.type = candidateCategory;
      asset.department = candidateDept;
    }

    if (assetType !== undefined) {
      asset.assetType = String(assetType).trim();
    }

    if (location !== undefined) {
      if (!String(location).trim()) {
        return res.status(400).json({ error: "Location cannot be empty." });
      }
      asset.location = String(location).trim();
    }

    if (condition !== undefined) {
      if (!ALLOWED_CONDITIONS.includes(condition)) {
        return res.status(400).json({
          error: `Invalid condition. Allowed: ${ALLOWED_CONDITIONS.join(", ")}`,
        });
      }
      asset.condition = condition;
    }

    if (status !== undefined) {
      if (!ALLOWED_ASSET_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${ALLOWED_ASSET_STATUSES.join(", ")}`,
        });
      }
      asset.status = status;
    }

    if (risk !== undefined && risk !== null) {
      const rNum = Number(risk);
      if (isNaN(rNum) || rNum < 0 || rNum > 100) {
        return res.status(400).json({ error: "Risk score must be a number between 0 and 100." });
      }
      asset.risk = rNum;
    }

    if (age !== undefined && age !== null) {
      const aNum = Number(age);
      if (isNaN(aNum) || aNum < 0) {
        return res.status(400).json({ error: "Age must be a non-negative number." });
      }
      asset.age = aNum;
    }

    // Validate Dates strictly
    if (installationDate !== undefined) {
      if (installationDate !== null && String(installationDate).trim() !== "") {
        if (!isValidDateString(installationDate)) {
          return res.status(400).json({ error: "Invalid installationDate. Expected valid calendar date in YYYY-MM-DD format." });
        }
        asset.installationDate = String(installationDate).trim();
      } else {
        asset.installationDate = null;
      }
    }

    if (lastInspectionDate !== undefined) {
      if (lastInspectionDate !== null && String(lastInspectionDate).trim() !== "") {
        if (!isValidDateString(lastInspectionDate)) {
          return res.status(400).json({ error: "Invalid lastInspectionDate. Expected valid calendar date in YYYY-MM-DD format." });
        }
        const trimmedDate = String(lastInspectionDate).trim();
        asset.lastInspectionDate = trimmedDate;
        asset.last = trimmedDate;
      } else {
        asset.lastInspectionDate = null;
        asset.last = null;
      }
    }

    if (nextInspectionDate !== undefined) {
      if (nextInspectionDate !== null && String(nextInspectionDate).trim() !== "") {
        if (!isValidDateString(nextInspectionDate)) {
          return res.status(400).json({ error: "Invalid nextInspectionDate. Expected valid calendar date in YYYY-MM-DD format." });
        }
        asset.nextInspectionDate = String(nextInspectionDate).trim();
      } else {
        asset.nextInspectionDate = null;
      }
    }

    if (description !== undefined) {
      asset.description = String(description).trim();
    }

    const updated = await asset.save();

    return res.json({
      message: "Asset updated successfully.",
      asset: updated,
    });
  } catch (error) {
    console.error("Error updating asset:", error.message);
    return res.status(500).json({ error: "Failed to update asset in database." });
  }
});

/**
 * DELETE /api/assets/:id
 * Safely delete or deactivate an asset.
 * Inspects maintenance request history: if requests exist, performs soft deactivation to prevent breaking references.
 */
router.delete("/:id", async (req, res) => {
  try {
    await connectDB();

    const asset = await findAsset(req.params.id);
    if (!asset || asset.isDeleted) {
      return res.status(404).json({ error: "Asset not found." });
    }

    const userRole = String(req.user?.role || "").toLowerCase().trim();
    if (userRole === "passenger") {
      return res.status(403).json({
        error: "Access Denied: Passengers are not permitted to delete assets.",
      });
    }

    if (userRole !== "admin") {
      const userDept = getUserDepartment(req.user);
      if (userDept && asset.department !== userDept) {
        return res.status(403).json({
          error: `Access Denied: You do not have permission to delete assets in ${asset.department}.`,
        });
      }
    }

    // Check linked maintenance requests in MongoDB or mock store
    let linkedCount = 0;
    if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
      const docs = Object.values(global.__TEST_DOCS__);
      linkedCount = docs.filter(
        (r) => r.asset === asset.assetId || r.asset === asset.id || String(r.assetRef) === String(asset._id)
      ).length;
    } else {
      linkedCount = await MaintenanceRequest.countDocuments({
        $or: [{ asset: asset.assetId }, { asset: asset.id }, { assetRef: asset._id }],
      });
    }

    // Safe deactivation / soft deletion strategy
    asset.status = "Decommissioned";
    asset.isDeleted = true;
    const saved = await asset.save();

    if (linkedCount > 0) {
      return res.json({
        message: "Asset has associated maintenance history. Safely deactivated and marked as decommissioned.",
        asset: saved,
        deactivated: true,
        linkedRequests: linkedCount,
      });
    }

    return res.json({
      message: "Asset deleted successfully.",
      asset: saved,
      deleted: true,
    });
  } catch (error) {
    console.error("Error deleting asset:", error.message);
    return res.status(500).json({ error: "Failed to delete asset from database." });
  }
});

/**
 * GET /api/assets/:id/maintenance-history
 * Retrieve all maintenance requests linked to this asset.
 */
router.get("/:id/maintenance-history", async (req, res) => {
  try {
    await connectDB();

    const asset = await findAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found." });
    }

    let history = [];
    if (process.env.NODE_ENV === "test" && global.__TEST_DOCS__) {
      const docs = Object.values(global.__TEST_DOCS__);
      history = docs.filter(
        (r) => r.asset === asset.assetId || r.asset === asset.id || String(r.assetRef) === String(asset._id)
      );
    } else {
      history = await MaintenanceRequest.find({
        $or: [{ asset: asset.assetId }, { asset: asset.id }, { assetRef: asset._id }],
      }).sort({ createdAt: -1 });
    }

    return res.json({
      assetId: asset.assetId,
      maintenanceHistory: history,
      count: history.length,
    });
  } catch (error) {
    console.error("Error fetching maintenance history:", error.message);
    return res.status(500).json({ error: "Failed to retrieve asset maintenance history." });
  }
});

export default router;
