import mongoose from "mongoose";

export const ASSET_CATEGORIES = ["Track", "Signal", "Electrical", "Mechanical", "Bridge"];
export const DEPARTMENTS = ["Engineering", "Traction/OHE", "Signal & Telecom"];
export const PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const STATUSES = [
  "Submitted",
  "Under Review",
  "Approved",
  "Scheduled",
  "In Progress",
  "Completed",
  "Rejected",
  "Cancelled",
];

const maintenanceRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: [true, "requestId is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    assetCategory: {
      type: String,
      required: [true, "Asset category is required"],
      enum: {
        values: ASSET_CATEGORIES,
        message: "{VALUE} is not a valid asset category. Allowed: Track, Signal, Electrical, Mechanical, Bridge",
      },
    },
    location: {
      type: String,
      required: [true, "Location / track section is required"],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      enum: {
        values: DEPARTMENTS,
        message: "{VALUE} is not a valid department. Allowed: Engineering, Traction/OHE, Signal & Telecom",
      },
    },
    issueType: {
      type: String,
      required: [true, "Issue type is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    priority: {
      type: String,
      required: [true, "Priority is required"],
      enum: {
        values: PRIORITIES,
        message: "{VALUE} is not a valid priority. Allowed: Critical, High, Medium, Low",
      },
      default: "Medium",
    },
    estimatedDuration: {
      type: Number,
      required: [true, "Estimated duration in minutes is required"],
      min: [1, "Estimated duration must be at least 1 minute"],
    },
    requiredResources: {
      type: String,
      required: [true, "Required team/resources is required"],
      trim: true,
    },
    preferredDateTime: {
      type: Date,
      required: [true, "Preferred maintenance date and time is required"],
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: STATUSES,
        message: "{VALUE} is not a valid status",
      },
      default: "Submitted",
      index: true,
    },
    createdBy: {
      uid: {
        type: String,
        required: [true, "Creator UID is required"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Creator email is required"],
        trim: true,
        lowercase: true,
      },
      role: {
        type: String,
        required: [true, "Creator role is required"],
        trim: true,
      },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedByEmail: { type: String, required: true },
        changedByRole: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, trim: true, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const MaintenanceRequest =
  mongoose.models.MaintenanceRequest ||
  mongoose.model("MaintenanceRequest", maintenanceRequestSchema);

export default MaintenanceRequest;
