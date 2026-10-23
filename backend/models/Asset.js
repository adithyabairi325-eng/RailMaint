import mongoose from "mongoose";
import { ALLOWED_DEPARTMENTS } from "./MaintenanceRequest.js";

export const ALLOWED_CATEGORIES = [
  "Track",
  "Signals & Communication",
  "Electrical & Power",
  "Mechanical",
  "Bridges",
];

export const CATEGORY_ALIASES = {
  "Signal and Communication": "Signals & Communication",
  "Electrical": "Electrical & Power",
};

export const CATEGORY_DEPARTMENT_MAP = {
  "Track": "Engineering / Track",
  "Signals & Communication": "Signal & Telecom",
  "Signal and Communication": "Signal & Telecom",
  "Electrical & Power": "Electrical / Traction",
  "Electrical": "Electrical / Traction",
  "Mechanical": "Mechanical",
  "Bridges": "Bridges",
};

export const CATEGORY_PREFIX_MAP = {
  "Track": "TRK",
  "Signals & Communication": "SIG",
  "Signal and Communication": "SIG",
  "Electrical & Power": "ELE",
  "Electrical": "ELE",
  "Mechanical": "MEC",
  "Bridges": "BRG",
};

export const ALLOWED_CONDITIONS = [
  "Good",
  "Fair",
  "Poor",
  "Critical",
  "Healthy",
  "At Risk",
];

export const ALLOWED_ASSET_STATUSES = [
  "Active",
  "Under Maintenance",
  "Decommissioned",
  "Inactive",
  "Operational",
];

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: [true, "Asset ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    // Mirror of assetId for backward compatibility with frontend code expecting a.id
    id: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Asset name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: {
        values: ALLOWED_CATEGORIES,
        message: "{VALUE} is not a valid category. Allowed: " + ALLOWED_CATEGORIES.join(", "),
      },
    },
    // Specific asset type (e.g. rails, sleepers, signals, transformers)
    assetType: {
      type: String,
      trim: true,
      default: "",
    },
    // Category mirror for frontend compatibility expecting a.type
    type: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      required: [true, "Asset location is required"],
      trim: true,
      default: "Main Line",
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
      enum: {
        values: ALLOWED_DEPARTMENTS,
        message: "{VALUE} is not a valid department",
      },
    },
    condition: {
      type: String,
      trim: true,
      enum: {
        values: ALLOWED_CONDITIONS,
        message: "{VALUE} is not a valid condition",
      },
      default: "Good",
    },
    status: {
      type: String,
      trim: true,
      enum: {
        values: ALLOWED_ASSET_STATUSES,
        message: "{VALUE} is not a valid status",
      },
      default: "Active",
    },
    risk: {
      type: Number,
      default: 25,
      min: [0, "Risk score cannot be less than 0"],
      max: [100, "Risk score cannot exceed 100"],
    },
    age: {
      type: Number,
      default: 1,
      min: [0, "Age cannot be negative"],
    },
    installationDate: {
      type: String,
      default: null,
    },
    lastInspectionDate: {
      type: String,
      default: null,
    },
    nextInspectionDate: {
      type: String,
      default: null,
    },
    // Mirror of lastInspectionDate for frontend compatibility expecting a.last
    last: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      uid: { type: String, default: null },
      email: { type: String, default: null },
      role: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to keep id, type, and last synchronized with primary fields
assetSchema.pre("save", function (next) {
  if (this.assetId) {
    this.id = this.assetId;
  }
  if (this.category) {
    this.type = this.category;
  }
  if (this.lastInspectionDate) {
    this.last = this.lastInspectionDate;
  }
  if (!this.lastInspectionDate && this.last) {
    this.lastInspectionDate = this.last;
  }
  next();
});

const Asset = mongoose.models.Asset || mongoose.model("Asset", assetSchema);

export default Asset;
