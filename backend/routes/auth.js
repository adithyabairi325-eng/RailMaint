import { Router } from "express";
import { getAuth } from "firebase-admin/auth";

const router = Router();

router.get("/me", async (req, res) => {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return res.status(401).json({ error: "Sign in is required." });
  }

  try {
    const user = await getAuth().verifyIdToken(token);
    return res.json({
      uid: user.uid,
      email: user.email ?? null,
    });
  } catch (error) {
    if ([
      "auth/argument-error",
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/user-disabled",
    ].includes(error.code)) {
      return res.status(401).json({ error: "Your sign-in is invalid or has expired." });
    }

    console.error("Firebase ID-token verification failed:", error);
    return res.status(500).json({ error: "Unable to verify your sign-in." });
  }
});

export default router;