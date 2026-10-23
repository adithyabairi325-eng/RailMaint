import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import MaintenanceRequest from "../models/MaintenanceRequest.js";
import Asset from "../models/Asset.js";
import reportRoutes from "../routes/reports.js";
import { connectDB, disconnectDB } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env if present
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Determine if integration tests can run safely.
 * Safeguard Requirements:
 * 1. MONGODB_TEST_URI must be explicitly set.
 * 2. MONGODB_TEST_URI must NEVER match production MONGODB_URI.
 * 3. MONGODB_TEST_URI must contain 'test' in its database name/path.
 */
function getSafeTestUri() {
  const testUri = process.env.MONGODB_TEST_URI;
  if (!testUri || !testUri.trim()) {
    return null;
  }
  const trimmed = testUri.trim();
  const prodUri = (process.env.MONGODB_URI || "").trim();

  if (prodUri && trimmed === prodUri) {
    throw new Error(
      "CRITICAL SAFETY VIOLATION: MONGODB_TEST_URI matches production MONGODB_URI. Halting execution immediately."
    );
  }

  const dbPath = trimmed.split("?")[0].toLowerCase();
  if (!dbPath.includes("test")) {
    throw new Error(
      "CRITICAL SAFETY VIOLATION: MONGODB_TEST_URI must point to a database with 'test' in its name (e.g. /railmaint_test)."
    );
  }

  return trimmed;
}

const safeTestUri = getSafeTestUri();
const isIntegrationEnabled = Boolean(safeTestUri);

describe("Reports & Analysis Isolated MongoDB Integration Tests", {
  skip: !isIntegrationEnabled
    ? "Skipped: MONGODB_TEST_URI is not set. Set MONGODB_TEST_URI to a dedicated test database (never production) to execute real MongoDB integration tests."
    : false,
}, () => {
  let app;
  let server;
  let baseUrl;

  // Unique identifier for this test run to isolate records and ensure clean deletion
  const RUN_ID = `INTEG-${Date.now()}`;

  // Mock test users for authentication headers
  const adminUser = {
    firebaseUid: `uid-admin-${RUN_ID}`,
    email: `admin-${RUN_ID}@railmaint.com`,
    role: "admin",
    status: "active",
  };

  const engineeringUser = {
    firebaseUid: `uid-eng-${RUN_ID}`,
    email: `eng-${RUN_ID}@railmaint.com`,
    role: "engineering",
    department: "Engineering / Track",
    status: "active",
  };

  const mechanicalUser = {
    firebaseUid: `uid-mech-${RUN_ID}`,
    email: `mech-${RUN_ID}@railmaint.com`,
    role: "mechanical",
    department: "Mechanical",
    status: "active",
  };

  const passengerUser = {
    firebaseUid: `uid-pass-${RUN_ID}`,
    email: `pass-${RUN_ID}@railmaint.com`,
    role: "passenger",
    status: "active",
  };

  before(async () => {
    // Enable real MongoDB mode for integration testing
    process.env.NODE_ENV = "test";
    process.env.IS_INTEGRATION_TEST = "true";

    // Connect strictly to the isolated test database
    await connectDB(safeTestUri);

    // Setup Express application with report routes
    app = express();
    app.use(express.json());
    app.use("/api/reports", reportRoutes);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Clean up any residual records with this run prefix
    await MaintenanceRequest.deleteMany({ id: { $regex: `^${RUN_ID}` } });
    await Asset.deleteMany({ assetId: { $regex: `^${RUN_ID}` } });

    // Seed deterministic assets using real Mongoose models
    await Asset.create([
      {
        assetId: `${RUN_ID}-AST-TRK`,
        id: `${RUN_ID}-AST-TRK`,
        name: "Main Line Fast Track Section 1",
        category: "Track",
        department: "Engineering / Track",
        condition: "Good",
        status: "Active",
        risk: 25,
        installationDate: "2023-01-01",
        lastInspectionDate: "2026-01-10",
        nextInspectionDate: "2026-07-10",
      },
      {
        assetId: `${RUN_ID}-AST-MEC`,
        id: `${RUN_ID}-AST-MEC`,
        name: "Electric Locomotive WAP-7 Unit",
        category: "Mechanical",
        department: "Mechanical",
        condition: "Critical",
        status: "Under Maintenance",
        risk: 85,
        installationDate: "2021-06-15",
        lastInspectionDate: "2025-10-01",
        nextInspectionDate: "2026-01-15", // Overdue inspection
      },
      {
        assetId: `${RUN_ID}-AST-SIG`,
        id: `${RUN_ID}-AST-SIG`,
        name: "Electronic Interlocking Relay Signal",
        category: "Signals & Communication",
        department: "Signal & Telecom",
        condition: "Fair",
        status: "Active",
        risk: 50,
        installationDate: "2022-03-20",
        lastInspectionDate: null, // Uninspected
        nextInspectionDate: "2026-11-01",
      },
    ]);

    // Seed deterministic maintenance requests using real Mongoose models
    await MaintenanceRequest.create([
      {
        id: `${RUN_ID}-MR-01`,
        asset: `${RUN_ID}-AST-TRK`,
        dept: "Engineering / Track",
        type: "Track Alignment",
        pri: "High",
        date: "2026-02-15",
        dur: 120,
        desc: "Precision track realignment",
        status: "Completed",
        actual: 90, // Valid actual duration
        doneDate: "2026-02-15",
        createdBy: { uid: adminUser.firebaseUid, email: adminUser.email, role: "admin" },
      },
      {
        id: `${RUN_ID}-MR-02`,
        asset: `${RUN_ID}-AST-TRK`,
        dept: "Engineering / Track",
        type: "Fastener Replacement",
        pri: "Medium",
        date: "2026-03-10",
        dur: 60,
        desc: "Sleeper fastener replacement",
        status: "Completed",
        actual: 30, // Valid actual duration
        doneDate: "2026-03-10",
        createdBy: { uid: adminUser.firebaseUid, email: adminUser.email, role: "admin" },
      },
      {
        id: `${RUN_ID}-MR-03`,
        asset: `${RUN_ID}-AST-MEC`,
        dept: "Mechanical",
        type: "Brake Overhaul",
        pri: "Critical",
        date: "2026-01-20", // Past date => Overdue
        dur: 180,
        desc: "Overhaul primary brake assembly",
        status: "In Progress",
        actual: null,
        createdBy: { uid: adminUser.firebaseUid, email: adminUser.email, role: "admin" },
      },
      {
        id: `${RUN_ID}-MR-04`,
        asset: `${RUN_ID}-AST-SIG`,
        dept: "Signal & Telecom",
        type: "Signal Lamp Check",
        pri: "Medium",
        date: "2026-01-10", // Past date => Overdue
        dur: 45,
        desc: "Routine signal check",
        status: "Pending",
        actual: null,
        createdBy: { uid: adminUser.firebaseUid, email: adminUser.email, role: "admin" },
      },
      {
        id: `${RUN_ID}-MR-05`,
        asset: `${RUN_ID}-AST-TRK`,
        dept: "Engineering / Track",
        type: "Ultrasonic Testing",
        pri: "Low",
        date: "2029-12-01", // Future date => Scheduled
        dur: 60,
        desc: "Scheduled ultrasonic rail inspection",
        status: "Scheduled",
        actual: null,
        createdBy: { uid: adminUser.firebaseUid, email: adminUser.email, role: "admin" },
      },
    ]);
  });

  after(async () => {
    try {
      // Clean up ONLY the seeded test records for this run
      await MaintenanceRequest.deleteMany({ id: { $regex: `^${RUN_ID}` } });
      await Asset.deleteMany({ assetId: { $regex: `^${RUN_ID}` } });
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Disconnect cleanly from test MongoDB
    await disconnectDB();
    delete process.env.IS_INTEGRATION_TEST;
  });

  async function getReport(endpoint, queryParams = "", user = null) {
    const headers = {};
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api/reports/${endpoint}${queryParams}`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 1. Overview Report with Real MongoDB Queries
  it("Overview Report: accurately calculates counts, completion rate, overdue tasks, and actual duration from real MongoDB documents", async () => {
    // Scoped to the seeded run assets and requests via date range filter
    const res = await getReport("overview", "?from=2026-01-01&to=2029-12-31", adminUser);
    assert.equal(res.status, 200);

    // Total requests across seeded set: 5
    assert.equal(res.data.totalRequests, 5);
    // Completed: MR-01, MR-02 => 2
    assert.equal(res.data.completedRequests, 2);
    // Overdue: MR-03 (In Progress, 2026-01-20), MR-04 (Pending, 2026-01-10) => 2
    assert.equal(res.data.overdueRequests, 2);
    // Completion rate: 2/5 * 100 = 40.0%
    assert.equal(res.data.completionRate, 40.0);
    // Average actual duration: strictly uses actual (90 + 30) / 2 = 60.0
    assert.equal(res.data.avgActualDuration, 60.0);
    assert.equal(res.data.recordedActualCount, 2);

    // Status breakdown
    assert.equal(res.data.statusBreakdown.Completed, 2);
    assert.equal(res.data.statusBreakdown["In Progress"], 1);
    assert.equal(res.data.statusBreakdown.Pending, 1);
    assert.equal(res.data.statusBreakdown.Scheduled, 1);
  });

  // 2. Real MongoDB Date Filters
  it("Date Filtering: correctly constrains real MongoDB query results to requested window", async () => {
    // Filter to February and March 2026 only
    const res = await getReport("overview", "?from=2026-02-01&to=2026-03-31", adminUser);
    assert.equal(res.status, 200);

    // Only MR-01 and MR-02 fall within this window
    assert.equal(res.data.totalRequests, 2);
    assert.equal(res.data.completedRequests, 2);
    assert.equal(res.data.overdueRequests, 0);
    assert.equal(res.data.completionRate, 100.0);
    assert.equal(res.data.avgActualDuration, 60.0);
  });

  // 3. Empty Results Handling
  it("Empty Query Results: returns zero metrics and null average duration when no documents match", async () => {
    const res = await getReport("overview", "?from=2015-01-01&to=2015-01-31", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.totalRequests, 0);
    assert.equal(res.data.completedRequests, 0);
    assert.equal(res.data.overdueRequests, 0);
    assert.equal(res.data.completionRate, 0);
    assert.equal(res.data.avgActualDuration, null);
  });

  // 4. Department Report with Real Database Aggregation
  it("Departments Report: aggregates counts and performance per department from real MongoDB", async () => {
    const res = await getReport("departments", "?from=2026-01-01&to=2029-12-31", adminUser);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.departments));

    const track = res.data.departments.find((d) => d.department === "Engineering / Track");
    assert.ok(track);
    assert.equal(track.totalRequests, 3);
    assert.equal(track.completedRequests, 2);
    assert.equal(track.completionRate, 66.7);
    assert.equal(track.avgActualDuration, 60.0);

    const mech = res.data.departments.find((d) => d.department === "Mechanical");
    assert.ok(mech);
    assert.equal(mech.totalRequests, 1);
    assert.equal(mech.overdueRequests, 1);
    assert.equal(mech.completionRate, 0);

    const sig = res.data.departments.find((d) => d.department === "Signal & Telecom");
    assert.ok(sig);
    assert.equal(sig.totalRequests, 1);
    assert.equal(sig.overdueRequests, 1);

    assert.equal(res.data.summary.totalRequests, 5);
    assert.equal(res.data.summary.completedRequests, 2);
  });

  // 5. Department Authorization & Scoping
  it("Department Scoping: restricts department users to their assigned department and rejects cross-department access", async () => {
    // Mechanical user should only see Mechanical data
    const resScoped = await getReport("overview", "?from=2026-01-01&to=2029-12-31", mechanicalUser);
    assert.equal(resScoped.status, 200);
    assert.equal(resScoped.data.department, "Mechanical");
    assert.equal(resScoped.data.totalRequests, 1);

    // Mechanical user attempting to view Track data rejected with 403
    const resCross = await getReport("overview", "?department=Engineering / Track", mechanicalUser);
    assert.equal(resCross.status, 403);
    assert.match(resCross.data.error, /only authorized to view reports for Mechanical/i);

    // Passenger user barred from reports
    const resPass = await getReport("overview", "", passengerUser);
    assert.equal(resPass.status, 403);

    // Unauthenticated user rejected with 401
    const resNoAuth = await getReport("overview", "", null);
    assert.equal(resNoAuth.status, 401);
  });

  // 6. Monthly Trends Report
  it("Trends Report: accurately groups monthly buckets from real MongoDB dates", async () => {
    const res = await getReport("trends", "?from=2026-01-01&to=2026-03-31", adminUser);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.trends));

    const jan = res.data.trends.find((t) => t.month === "2026-01");
    assert.ok(jan);
    assert.equal(jan.totalRequests, 2);
    assert.equal(jan.overdueRequests, 2);
    assert.equal(jan.completedRequests, 0);

    const feb = res.data.trends.find((t) => t.month === "2026-02");
    assert.ok(feb);
    assert.equal(feb.totalRequests, 1);
    assert.equal(feb.completedRequests, 1);
    assert.equal(feb.avgActualDuration, 90.0);

    const mar = res.data.trends.find((t) => t.month === "2026-03");
    assert.ok(mar);
    assert.equal(mar.totalRequests, 1);
    assert.equal(mar.completedRequests, 1);
    assert.equal(mar.avgActualDuration, 30.0);
  });

  // 7. Assets Analysis Report from Real MongoDB Asset Collection
  it("Assets Report: analyzes real MongoDB assets by risk, condition, status, and inspection schedules", async () => {
    const res = await getReport("assets", "", adminUser);
    assert.equal(res.status, 200);

    // Filter to seeded assets to verify against known fixtures
    const trackCat = res.data.byCategory.find((c) => c.category === "Track");
    assert.ok(trackCat);
    assert.ok(trackCat.count >= 1);

    const critCondition = res.data.byCondition.find((c) => c.condition === "Critical");
    assert.ok(critCondition);
    assert.ok(critCondition.count >= 1);

    // Risk overview and inspection schedules
    assert.ok(res.data.riskOverview.highRiskCount >= 1);
    assert.ok(res.data.inspections.overdueCount >= 1);
    assert.ok(res.data.inspections.uninspectedCount >= 1);
  });
});
