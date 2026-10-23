import mongoose from "mongoose";

export const ROLES = [
  "admin",
  "engineering",
  "traction",
  "electrical",
  "signal",
  "mechanical",
  "bridges",
  "passenger",
];
export const STATUSES = ["active", "inactive"];

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, "firebaseUid is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "email is required"],
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: [true, "role is required"],
      enum: {
        values: ROLES,
        message: "{VALUE} is not a valid role. Allowed roles: admin, engineering, traction, electrical, signal, mechanical, bridges, passenger",
      },
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      required: [true, "status is required"],
      enum: {
        values: STATUSES,
        message: "{VALUE} is not a valid status. Allowed statuses: active, inactive",
      },
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
