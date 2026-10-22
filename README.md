# RailMaint — Railway Maintenance Coordination System

A full-stack railway maintenance coordination platform built with **React + Vite**, **Express.js**, **Firebase Authentication**, and **MongoDB Atlas**.

---

## 🚀 Quick Start Commands

Open two separate terminals in the `RailMaint` root folder:

### Terminal 1: Start Backend Server
```powershell
npm run dev:backend
```
> Runs Express on [http://localhost:3000](http://localhost:3000) and connects to MongoDB Atlas.

### Terminal 2: Start Frontend Application
```powershell
npm run dev
```
> Runs Vite dev server on [http://localhost:5173](http://localhost:5173).

### Optional: Initial Admin Provisioning (One-Time Setup)
```powershell
npm run setup:admin
```
*(Or specify parameters directly via CLI)*:
```powershell
npm run setup:admin -- --email adhi123@gmail.com --uid 0lR65ji0uwWZ1mM0sCmzg6x0Xdo1
```

---

## 🛡️ Recent Backend Audit & Safety Fixes

1. **Destructive Startup Code Removed (`backend/index.js`)**:
   - Completely deleted `fs.rmSync()` startup deletion mechanisms and unused `fs` imports. Starting the backend will never delete source files, folders, models, scripts, or routes.
2. **Dedicated User Model (`backend/models/User.js`)**:
   - Mongoose User schema moved to a dedicated model file.
   - Enforces strict single-role validation (`admin`, `engineering`, `traction`, `signal`, `passenger`).
   - Requires unique indexed `firebaseUid`.
   - Never stores passwords in MongoDB; Firebase Authentication handles all password verification.
3. **Strict Read-Only Login Verification (`backend/routes/auth.js`)**:
   - Fully removed all login-time upsert logic (`User.findOneAndUpdate(..., { upsert: true })`).
   - Never automatically creates profiles or overwrites roles/statuses during sign-in.
   - Strictly validates tokens via Firebase Admin SDK and looks up existing profiles in MongoDB Atlas.
   - Returns `401 Unauthorized` for missing, expired, or invalid tokens.
   - Returns `403 Forbidden` for unregistered or inactive accounts.
   - Frontend role selections cannot grant permissions; the database role alone determines access.
4. **Complete Firebase & App Logout (`frontend/src/App.jsx`)**:
   - Updated `handleLogout` to execute `await signOut(auth)` from `firebase/auth` alongside clearing React application state, terminating both client and Firebase sessions.
5. **Controlled Admin Provisioning (`backend/scripts/setupAdmin.js`)**:
   - Created a safe, non-destructive script that verifies the Firebase account, connects to MongoDB Atlas, and checks for existing profiles.
   - Refuses to overwrite any profile that already exists with conflicting roles or statuses.
6. **Strict MongoDB Atlas Enforcement (`backend/db.js`)**:
   - Uses `MONGODB_URI` from `backend/.env`.
   - Rejects local MongoDB and localhost URIs.
   - If the database fails to connect, Express halts with explicit error reporting rather than silently pretending connectivity succeeded.

---

## 🔄 Authentication & Role Workflow

```
+---------------------------------------------------------------------------------------+
|                                     FRONTEND                                          |
|                                                                                       |
|  1. User enters Email & Password at Login Page (http://localhost:5173)                |
|  2. Firebase Client SDK (signInWithEmailAndPassword) verifies credentials            |
|  3. Firebase returns a signed ID Token and verified UID                              |
|  4. Frontend sends ID Token via: GET /api/auth/me with header Authorization: Bearer   |
+------------------------------------------+--------------------------------------------+
                                           |
                                           | HTTP Request + Token
                                           v
+---------------------------------------------------------------------------------------+
|                                  EXPRESS BACKEND                                      |
|                                                                                       |
|  5. Express route (/api/auth/me) extracts the Bearer token                            |
|  6. Firebase Admin SDK (verifyIdToken) cryptographically verifies the token           |
|  7. Express connects to MongoDB Atlas and queries: User.findOne({ firebaseUid: uid })  |
|  8. Access Control Checks:                                                            |
|     * If user profile not found in MongoDB Atlas  --> Returns 403 Forbidden           |
|     * If user status is not "active"              --> Returns 403 Forbidden           |
|  9. Returns verified profile: { uid, email, role, department, status }                 |
+------------------------------------------+--------------------------------------------+
                                           |
                                           | Verified Database Role
                                           v
+---------------------------------------------------------------------------------------+
|                                FRONTEND DASHBOARD ROUTING                             |
|                                                                                       |
|  10. Frontend receives verified role from MongoDB (e.g., "admin")                     |
|  11. App.jsx conditionally renders the matching dashboard:                            |
|      - admin        --> <AdminDashboard />                                            |
|      - engineering  --> <EngineeringDashboard />                                      |
|      - traction     --> <TractionDashboard />                                         |
|      - signal       --> <SignalDashboard />                                           |
|      - passenger    --> <PassengerDashboard />                                        |
+---------------------------------------------------------------------------------------+
```

---

## 📁 File Structure & Responsibilities

### Backend (`/backend`)

| File | Purpose |
| :--- | :--- |
| **`backend/.env`** | Private environment variables (`MONGODB_URI`, `FIREBASE_PROJECT_ID`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_UID`). Ignored by git for security. |
| **`backend/.env.example`** | Public template showing required environment variable names without secrets. |
| **`backend/index.js`** | Main entry point for the Express backend. Loads `.env`, initializes Firebase Admin SDK, connects to MongoDB Atlas, and mounts API routes. Contains no destructive file deletion code. |
| **`backend/db.js`** | Database connection manager. Uses Mongoose to connect directly to MongoDB Atlas. Validates that `MONGODB_URI` is present and does not allow localhost fallback. |
| **`backend/models/User.js`** | Mongoose User model schema. Enforces required fields (`firebaseUid`, `email`, single `role`, `status`). Passwords are never stored here. |
| **`backend/routes/auth.js`** | The `/api/auth/me` endpoint. Verifies incoming Firebase tokens, queries MongoDB Atlas for the user's role, and returns the authorized profile. Strictly read-only at login time. |
| **`backend/routes/schedules.js`** | REST API endpoint for managing maintenance schedules and block requests across railway departments. |
| **`backend/scripts/setupAdmin.js`** | Controlled provisioning script. Safely creates or checks the initial `admin` role in MongoDB Atlas for your verified Firebase UID without exposing passwords or overwriting existing records. |

---

### Frontend (`/frontend`)

| File | Purpose |
| :--- | :--- |
| **`frontend/src/firebase/firebaseConfig.js`** | Initializes the Firebase client app and exports `auth` for client-side email/password authentication. |
| **`frontend/src/pages/Login.jsx`** | The login interface. Collects credentials, calls `signInWithEmailAndPassword`, sends the token to `/api/auth/me`, and handles error states. Does not send role override headers. |
| **`frontend/src/App.jsx`** | Top-level state and routing. When login succeeds, receives the MongoDB-verified role and displays the matching dashboard. On logout, clears application state and executes `signOut(auth)`. |
| **`frontend/src/pages/AdminDashboard.jsx`** | Cross-department maintenance scheduling, conflict detection, and timetable optimization for railway administrators. |
| **`frontend/src/pages/EngineeringDashboard.jsx`** | Track maintenance, speed restriction planning, and structural inspection dashboard. |
| **`frontend/src/pages/TractionDashboard.jsx`** | Overhead equipment (OHE), power isolations, and catenary maintenance coordination. |
| **`frontend/src/pages/SignalDashboard.jsx`** | Interlocking, track circuit telemetry, point machine testing, and signal maintenance. |
| **`frontend/src/pages/PassengerDashboard.jsx`** | Passenger disruption alerts, platform alterations, and journey advisory view. |
| **`frontend/vite.config.js`** | Vite configuration with `/api` reverse proxy forwarding requests to `http://localhost:3000`. |

---

## 🧪 Testing Authentication & Edge Cases

| Test Case | Scenario / Action | Expected Result |
| :--- | :--- | :--- |
| **Valid Admin Login** | Sign in at `http://localhost:5173` with `adhi123@gmail.com` / `12345678`. | Firebase authenticates, MongoDB Atlas returns `role: "admin"`, and **Admin Dashboard** opens. |
| **Missing Token** | Call `GET http://localhost:3000/api/auth/me` with no Authorization header. | Express returns `401 Unauthorized` (`No authorization token provided`). |
| **Invalid Token** | Call `/api/auth/me` with `Authorization: Bearer invalid-token`. | Express returns `401 Unauthorized` (`Invalid or expired session`). |
| **Unregistered User** | Sign in with a valid Firebase account that has no MongoDB Atlas document. | Express returns `403 Forbidden` (`Access Denied: Your account is not registered`). No profile is created. |
| **Inactive Account** | Set `status: "inactive"` on a MongoDB user document and attempt login. | Express returns `403 Forbidden` (`Access Denied: Your account is inactive`). |
| **Logout Verification** | Click "Sign Out" from the dashboard. | `signOut(auth)` executes, app state resets, and user returns to login form. |
| **Build & Lint Checks** | Run `npm run lint` and `npm run build`. | Verifies zero syntax errors and builds frontend production assets cleanly. |