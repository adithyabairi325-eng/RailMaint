import mongoose from "mongoose";

export const ALLOWED_PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const ALLOWED_STATUSES = ["Pending", "Scheduled", "In Progress", "Completed", "Delayed"];
export const ALLOWED_DEPARTMENTS = [
  "Engineering / Track",
  "Signal & Telecom",
  "Electrical / Traction",
  "Mechanical",
  "Bridges",
];

const maintenanceRequestSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, "Request ID is required"],
      unique: true,
      trim: true,
    },
    asset: {
      type: String,
      required: [true, "Asset ID is required"],
      trim: true,
    },
    dept: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
      enum: {
        values: ALLOWED_DEPARTMENTS,
        message: "{VALUE} is not a valid department",
      },
    },
    type: {
      type: String,
      required: [true, "Work type is required"],
      trim: true,
    },
    pri: {
      type: String,
      required: [true, "Priority is required"],
      trim: true,
      enum: {
        values: ALLOWED_PRIORITIES,
        message: "{VALUE} is not a valid priority. Allowed: Critical, High, Medium, Low",
      },
      default: "Medium",
    },
    date: {
      type: String,
      required: [true, "Date is required"],
      trim: true,
    },
    dur: {
      type: Number,
      required: [true, "Duration is required"],
      min: [1, "Duration must be a positive number of minutes"],
      default: 60,
    },
    desc: {
      type: String,
      trim: true,
      required: [true, "Description is required"],
      default: "",
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ALLOWED_STATUSES,
        message: "{VALUE} is not a valid status",
      },
      default: "Pending",
      index: true,
    },
    start: {
      type: String,
      default: null,
    },
    doneDate: {
      type: String,
      default: null,
    },
    actual: {
      type: Number,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      uid: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

const MaintenanceRequest =
  mongoose.models.MaintenanceRequest ||
  mongoose.model("MaintenanceRequest", maintenanceRequestSchema);

export default MaintenanceRequest;
