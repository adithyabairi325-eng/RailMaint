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

---

---

## 🔄 How the Authentication & Role Workflow Works

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
| **`backend/.env`** | Private environment variables (`MONGODB_URI`, `FIREBASE_PROJECT_ID`). Ignored by git for security. |
| **`backend/.env.example`** | Public template showing required environment variable names without secrets. |
| **`backend/index.js`** | Main entry point for the Express backend. Loads `.env`, initializes Firebase Admin SDK, connects to MongoDB Atlas, and mounts API routes. |
| **`backend/db.js`** | Database connection manager. Uses Mongoose to connect directly to MongoDB Atlas. |
| **`backend/routes/auth.js`** | The `/api/auth/me` endpoint. Contains the User schema, verifies Firebase ID tokens, queries MongoDB Atlas for the user's role, and returns the authorized profile. |
| **`backend/routes/schedules.js`** | REST API endpoint for managing maintenance schedules and block requests across railway departments. |

---

### Frontend (`/frontend`)

| File | Purpose |
| :--- | :--- |
| **`frontend/src/firebase/firebaseConfig.js`** | Initializes the Firebase client app and exports `auth` for client-side email/password authentication. |
| **`frontend/src/pages/Login.jsx`** | The login interface. Collects credentials, calls `signInWithEmailAndPassword`, sends the token to `/api/auth/me`, and handles error states. |
| **`frontend/src/App.jsx`** | Top-level state and routing. When login succeeds, receives the MongoDB-verified role and displays the matching dashboard. |
| **`frontend/src/pages/AdminDashboard.jsx`** | Cross-department maintenance scheduling, conflict detection, and timetable optimization for railway administrators. |
| **`frontend/src/pages/EngineeringDashboard.jsx`** | Track maintenance, speed restriction planning, and structural inspection dashboard. |
| **`frontend/src/pages/TractionDashboard.jsx`** | Overhead equipment (OHE), power isolations, and catenary maintenance coordination. |
| **`frontend/src/pages/SignalDashboard.jsx`** | Interlocking, track circuit telemetry, point machine testing, and signal maintenance. |
| **`frontend/src/pages/PassengerDashboard.jsx`** | Passenger disruption alerts, platform alterations, and journey advisory view. |
| **`frontend/vite.config.js`** | Vite configuration with `/api` reverse proxy forwarding requests to `http://localhost:3000`. |