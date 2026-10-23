import mongoose from "mongoose";
import { ALLOWED_DEPARTMENTS } from "./MaintenanceRequest.js";

export const ALLOWED_NOTIFICATION_KINDS = [
  "critical-risk",
  "predicted",
  "overdue",
  "conflict",
  "delayed",
  "completed",
  "request-created",
  "schedule-change",
];

const notificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, "Notification ID is required"],
      unique: true,
      trim: true,
    },
    kind: {
      type: String,
      required: [true, "Notification kind is required"],
      enum: {
        values: ALLOWED_NOTIFICATION_KINDS,
        message: "{VALUE} is not a valid notification kind",
      },
      default: "request-created",
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
    },
    desc: {
      type: String,
      trim: true,
      default: "",
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    ref: {
      id: { type: String, required: true },
      t: {
        type: String,
        enum: ["request", "asset", "schedule"],
        default: "request",
      },
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    time: {
      type: String,
      default: () => "Just now",
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ department: 1, read: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
