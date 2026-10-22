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

---

## 🔄 Authentication & Role-Consistency Workflow

```
+---------------------------------------------------------------------------------------+
|                                     FRONTEND                                          |
|                                                                                       |
|  1. User selects Role from dropdown (e.g., "Engineering")                             |
|  2. User enters Email & Password at Login Page (http://localhost:5173)                |
|  3. Firebase Client SDK (signInWithEmailAndPassword) verifies credentials            |
|  4. Firebase returns a signed ID Token and verified UID                              |
|  5. Frontend sends ID Token + Selected Role via:                                      |
|     GET /api/auth/me                                                                  |
|     Headers: Authorization: Bearer <idToken>                                          |
|              x-selected-role: <selectedRole>                                          |
+------------------------------------------+--------------------------------------------+
                                           |
                                           | HTTP Request + Token + Selected Role
                                           v
+---------------------------------------------------------------------------------------+
|                                  EXPRESS BACKEND                                      |
|                                                                                       |
|  6. Express middleware (authenticateToken) extracts and validates Bearer token       |
|  7. Firebase Admin SDK (verifyIdToken) independently verifies token and extracts UID  |
|  8. Express connects to MongoDB Atlas and queries: User.findOne({ firebaseUid: uid })  |
|  9. Access & Role Consistency Checks:                                                 |
|     * If user profile not found in MongoDB Atlas  --> Returns 403 Forbidden           |
|     * If user status is not "active"              --> Returns 403 Forbidden           |
|     * If selected role != user.role in MongoDB    --> Returns 403 Forbidden:          |
|       "The selected role does not match your assigned role. Please select the         |
|        correct role."                                                                 |
| 10. If roles match, returns verified profile: { uid, email, role, department, status }|
+------------------------------------------+--------------------------------------------+
                                           |
                                           | Verified Database Role
                                           v
+---------------------------------------------------------------------------------------+
|                                FRONTEND DASHBOARD ROUTING                             |
|                                                                                       |
|  11. Frontend receives verified role from MongoDB Atlas (e.g., "admin")               |
|  12. App.jsx conditionally renders the matching dashboard:                            |
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
| **`backend/models/MaintenanceRequest.js`** | Mongoose schema and model for maintenance requests. Tracks asset category, location, department, issue type, description, priority, estimated duration, resources, preferred date/time, status, creator identity, and status history. |
| **`backend/middleware/auth.js`** | Express middleware providing `authenticateToken` (verifies Firebase ID token & loads MongoDB user) and `requireRole` (restricts endpoints to authorized roles like `admin`). |
| **`backend/routes/auth.js`** | The `/api/auth/me` endpoint. Verifies incoming Firebase tokens, queries MongoDB Atlas for the user's role, enforces role consistency with `x-selected-role`, and returns the authorized profile. Also provides `/api/auth/admin-only` for route authorization testing. |
| **`backend/routes/maintenanceRequests.js`** | REST endpoints (`POST /api/maintenance-requests`, `GET /api/maintenance-requests`, `GET /:id`, `PATCH /:id/status`) with token verification, department scoping, input validation, and role-based status transition enforcement. |
| **`backend/routes/schedules.js`** | Protected REST API endpoint for maintenance schedules. Requires valid authentication for `/` and admin privileges for `/admin`. |
| **`backend/scripts/setupAdmin.js`** | Controlled provisioning script. Safely creates or checks the initial `admin` role in MongoDB Atlas for your verified Firebase UID without exposing passwords or overwriting existing records. |

---

### Frontend (`/frontend`)

| File | Purpose |
| :--- | :--- |
| **`frontend/src/firebase/firebaseConfig.js`** | Initializes the Firebase client app and exports `auth` for client-side email/password authentication. |
| **`frontend/src/pages/Login.jsx`** | The login interface. Collects credentials and role selection, calls `signInWithEmailAndPassword`, sends the token and `x-selected-role` to `/api/auth/me`, and displays clear error messages if role mismatch or unauthorized. Performs clean `signOut(auth)` on rejection. |
| **`frontend/src/App.jsx`** | Top-level state and routing. When login succeeds, receives the MongoDB-verified role and displays the matching dashboard. On logout, clears application state and executes `signOut(auth)`. |
| **`frontend/src/pages/AdminDashboard.jsx`** | Cross-department maintenance scheduling, conflict detection, asset management, and timetable optimization for railway administrators. Maintenance requests are persisted directly to MongoDB Atlas via Express backend. |
| **`frontend/src/pages/EngineeringDashboard.jsx`** | Track maintenance, speed restriction planning, and structural inspection dashboard. |
| **`frontend/src/pages/TractionDashboard.jsx`** | Overhead equipment (OHE), power isolations, and catenary maintenance coordination. |
| **`frontend/src/pages/SignalDashboard.jsx`** | Interlocking, track circuit telemetry, point machine testing, and signal maintenance. |
| **`frontend/src/pages/PassengerDashboard.jsx`** | Passenger disruption alerts, platform alterations, and journey advisory view. |
| **`frontend/vite.config.js`** | Vite configuration with `/api` reverse proxy forwarding requests to `http://localhost:3000`. |

---

## 🧪 Verification & Role Test Cases

| # | Test Scenario | Inputs / Action | Expected Result & Status |
| :-: | :--- | :--- | :--- |
| **1** | **Engineering Match** | User with MongoDB role `engineering` selects `engineering` | Login succeeds; redirected to Engineering Dashboard. (HTTP 200) |
| **2** | **Engineering selecting Admin** | User with MongoDB role `engineering` selects `admin` | Login rejected: *"The selected role does not match your assigned role. Please select the correct role."* (HTTP 403) |
| **3** | **Admin selecting Engineering** | User with MongoDB role `admin` selects `engineering` | Login rejected: *"The selected role does not match your assigned role. Please select the correct role."* (HTTP 403) |
| **4** | **Unregistered Firebase User** | User exists in Firebase but has no MongoDB Atlas document | Access denied: *"Access Denied: Your account is not registered in RailMaint."* (HTTP 403) |
| **5** | **Inactive Profile** | User document in MongoDB has `status: "inactive"` | Access denied: *"Access Denied: Your account is inactive. Contact an administrator."* (HTTP 403) |
| **6** | **Invalid / Expired Token** | Request with missing, expired, or corrupted Bearer token | Access denied: *"Your sign-in session is invalid or has expired."* (HTTP 401) |
| **7** | **Tampered Frontend Role** | User modifies frontend state or headers to impersonate another role | Backend authorization relies solely on MongoDB Atlas profile; permissions cannot be escalated. |
| **8** | **Non-Admin API Access** | Engineering user requests admin endpoint (`GET /api/schedules/admin` or `GET /api/auth/admin-only`) | Access denied: *"Access Denied: You do not have permission to access this resource."* (HTTP 403) |
| **9** | **Admin Match** | User with MongoDB role `admin` selects `admin` | Login succeeds; redirected to Admin Dashboard. (HTTP 200) |