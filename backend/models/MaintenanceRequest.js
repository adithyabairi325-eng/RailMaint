import mongoose from "mongoose";

const maintenanceRequestSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    asset: {
      type: String,
      required: true,
      trim: true,
    },
    dept: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    pri: {
      type: String,
      required: true,
      trim: true,
      default: "Medium",
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    dur: {
      type: Number,
      required: true,
      default: 60,
    },
    desc: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      required: true,
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
      uid: { type: String, default: "" },
      email: { type: String, default: "" },
      role: { type: String, default: "" },
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
