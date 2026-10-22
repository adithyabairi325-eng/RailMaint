import { Router } from "express";

const router = Router();

// GET /api/schedules - list current maintenance schedules
router.get("/", async (req, res) => {
  return res.json({
    schedules: [],
    message: "Schedule service ready."
  });
});

export default router;
