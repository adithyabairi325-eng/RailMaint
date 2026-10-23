import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import authRoutes from "./routes/auth.js";
import scheduleRoutes from "./routes/schedules.js";
import maintenanceRequestRoutes from "./routes/maintenanceRequests.js";
import assetRoutes from "./routes/assets.js";
import reportRoutes from "./routes/reports.js";
import notificationRoutes from "./routes/notifications.js";
import { connectDB } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicitly load backend/.env first, then fallback to project root .env
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || "railmaint-a716b";

if (!projectId) {
  throw new Error("Set FIREBASE_PROJECT_ID before starting the backend.");
}

if (getApps().length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId,
      });
    } catch {
      initializeApp({ projectId });
    }
  } else {
    initializeApp({ projectId });
  }
}

// Connect to MongoDB Atlas
connectDB().catch((err) => {
  console.error("[MongoDB Atlas Error]:", err.message);
});

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/maintenance-requests", maintenanceRequestRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`RailMaint backend listening on port ${port}`);
});
