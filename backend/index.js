import express from "express";
import { initializeApp } from "firebase-admin/app";
import authRoutes from "./routes/auth.js";
import scheduleRoutes from "./routes/schedules.js";

const projectId = process.env.FIREBASE_PROJECT_ID || "railmaint-a716b";

if (!projectId) {
  throw new Error("Set FIREBASE_PROJECT_ID before starting the backend.");
}

initializeApp({ projectId });

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/schedules", scheduleRoutes);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
