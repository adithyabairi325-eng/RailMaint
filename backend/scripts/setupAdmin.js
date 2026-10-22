import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import User from "../models/User.js";
import { connectDB, disconnectDB } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env first, then fallback to project root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      parsed.email = args[++i].trim();
    } else if (args[i] === "--uid" && args[i + 1]) {
      parsed.uid = args[++i].trim();
    }
  }
  return parsed;
}

async function setupAdmin() {
  console.log("=========================================");
  console.log(" RailMaint Initial Admin Setup (MongoDB Atlas)");
  console.log("=========================================\n");

  const cliArgs = parseArgs();
  const adminEmail = (cliArgs.email || process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  let adminUid = (cliArgs.uid || process.env.INITIAL_ADMIN_UID || "").trim();

  if (!adminEmail) {
    console.error("Error: INITIAL_ADMIN_EMAIL is required.");
    console.error("Please configure INITIAL_ADMIN_EMAIL in backend/.env or run:");
    console.error("  npm run setup:admin -- --email <admin-email> --uid <firebase-uid>\n");
    process.exit(1);
  }

  // 1. Initialize Firebase Admin SDK
  const projectId = process.env.FIREBASE_PROJECT_ID || "railmaint-a716b";
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

  // 2. Verify account with Firebase Authentication
  console.log(`Verifying Firebase account for ${adminEmail}...`);
  try {
    const auth = getAuth();
    if (adminUid) {
      try {
        const userByUid = await auth.getUser(adminUid);
        if (userByUid.email && userByUid.email.toLowerCase() !== adminEmail) {
          console.error(`Conflict: Firebase UID "${adminUid}" is registered to "${userByUid.email}", not "${adminEmail}".`);
          process.exit(1);
        }
        console.log(`Verified Firebase user by UID: ${userByUid.uid} (${userByUid.email})`);
      } catch (uidErr) {
        if (uidErr.code === "auth/user-not-found") {
          console.error(`Error: No Firebase user found with UID "${adminUid}".`);
          process.exit(1);
        }
        console.log(`Firebase Admin notice: ${uidErr.message}`);
        console.log(`Proceeding with configured UID: ${adminUid}`);
      }
    } else {
      try {
        const userByEmail = await auth.getUserByEmail(adminEmail);
        adminUid = userByEmail.uid;
        console.log(`Found Firebase user: UID ${adminUid} (${userByEmail.email})`);
      } catch (emailErr) {
        if (emailErr.code === "auth/user-not-found") {
          console.error(`Error: Firebase account for "${adminEmail}" was not found.`);
          console.error("Please create the account in Firebase Authentication first before assigning the Admin role.");
          process.exit(1);
        }
        console.error(`\nNotice: Could not query Firebase Admin API directly (${emailErr.message}).`);
        console.error("When running without a service account key file, please provide the Firebase UID explicitly:");
        console.error("  1. Copy the UID for ${adminEmail} from Firebase Console -> Authentication -> Users");
        console.error("  2. Set INITIAL_ADMIN_UID in backend/.env OR run:");
        console.error(`     npm run setup:admin -- --email ${adminEmail} --uid <firebase-uid>\n`);
        process.exit(1);
      }
    }
  } catch (fbErr) {
    console.error("Firebase verification error:", fbErr.message);
    process.exit(1);
  }

  if (!adminUid) {
    console.error("Error: Could not determine Firebase UID for admin account.");
    process.exit(1);
  }

  // 3. Connect to MongoDB Atlas
  console.log("\nConnecting to MongoDB Atlas...");
  await connectDB();

  // 4. Check for existing profile in MongoDB Atlas
  console.log("Checking for existing profile in MongoDB Atlas...");
  const existingByUid = await User.findOne({ firebaseUid: adminUid });
  const existingByEmail = await User.findOne({ email: adminEmail });
  const existing = existingByUid || existingByEmail;

  if (existing) {
    if (existing.role === "admin" && existing.status === "active" && existing.firebaseUid === adminUid) {
      console.log("\n[OK] Admin profile already exists in MongoDB Atlas and is active:");
      console.log(`  MongoDB ID:   ${existing._id}`);
      console.log(`  Email:        ${existing.email}`);
      console.log(`  Firebase UID: ${existing.firebaseUid}`);
      console.log(`  Role:         ${existing.role}`);
      console.log(`  Status:       ${existing.status}`);
      await disconnectDB();
      process.exit(0);
    }

    console.error("\n[Conflict] A user profile already exists in MongoDB Atlas with conflicting information:");
    console.error(`  MongoDB ID:   ${existing._id}`);
    console.error(`  Email:        ${existing.email}`);
    console.error(`  Firebase UID: ${existing.firebaseUid}`);
    console.error(`  Current Role: ${existing.role}`);
    console.error(`  Current Status: ${existing.status}`);
    console.error("\nSafety Rule: Existing profiles are not silently overwritten.");
    console.error("To modify this existing user's role or status, update the document directly in MongoDB Atlas.");
    await disconnectDB();
    process.exit(1);
  }

  // 5. Create new Admin profile in MongoDB Atlas
  console.log(`Creating initial Admin profile in MongoDB Atlas for ${adminEmail}...`);
  const newAdmin = await User.create({
    firebaseUid: adminUid,
    email: adminEmail,
    role: "admin",
    department: null,
    status: "active",
  });

  console.log("\n[Success] Initial Admin profile created in MongoDB Atlas:");
  console.log(`  MongoDB ID:   ${newAdmin._id}`);
  console.log(`  Email:        ${newAdmin.email}`);
  console.log(`  Firebase UID: ${newAdmin.firebaseUid}`);
  console.log(`  Role:         ${newAdmin.role}`);
  console.log(`  Status:       ${newAdmin.status}`);
  console.log("\nThe Admin can now sign in at the login page to access the Admin Dashboard.\n");

  await disconnectDB();
  process.exit(0);
}

setupAdmin().catch(async (err) => {
  console.error("\n[Setup Admin Error]:", err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
