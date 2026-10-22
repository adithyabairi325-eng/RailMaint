import { Router } from "express";

const router = Router();

// GET /api/schedules - list current maintenance schedules
router.get("/", (req, res) => {
  res.json({
    schedules: [],
    message: "Schedule service ready.",
  });
});

export default router;
