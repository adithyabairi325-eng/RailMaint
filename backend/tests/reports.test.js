process.env.NODE_ENV = "test";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import reportRoutes from "../routes/reports.js";

describe("Reports & Analysis Backend API & Integration Tests", () => {
  let app;
  let server;
  let baseUrl;

  // Mock users
  const adminUser = {
    firebaseUid: "admin-uid-1",
    email: "admin@railmaint.com",
    role: "admin",
    status: "active",
  };

  const engineeringUser = {
    firebaseUid: "eng-uid-1",
    email: "engineer@railmaint.com",
    role: "engineering",
    department: "Engineering / Track",
    status: "active",
  };

  const mechanicalUser = {
    firebaseUid: "mech-uid-1",
    email: "mechanical@railmaint.com",
    role: "mechanical",
    department: "Mechanical",
    status: "active",
  };

  const passengerUser = {
    firebaseUid: "pass-uid-1",
    email: "passenger@railmaint.com",
    role: "passenger",
    status: "active",
  };

  const unsupportedUser = {
    firebaseUid: "unsupp-uid-1",
    email: "unsupported@railmaint.com",
    role: "consultant",
    status: "active",
  };

  function createMockRequest(data = {}) {
    return {
      _id: data._id || "6ada2d7624bc713348056701",
      id: data.id || "MR-1001",
      asset: data.asset || "TRK-101",
      dept: data.dept || "Engineering / Track",
      type: data.type || "Track Inspection",
      pri: data.pri || "Medium",
      date: data.date || "2026-04-10",
      dur: data.dur !== undefined ? data.dur : 60,
      desc: data.desc || "Track maintenance",
      status: data.status || "Pending",
      actual: data.actual !== undefined ? data.actual : null,
      doneDate: data.doneDate || null,
      createdBy: {
        uid: "eng-uid-1",
        email: "engineer@railmaint.com",
        role: "engineering",
      },
      ...data,
    };
  }

  function createMockAsset(data = {}) {
    return {
      _id: data._id || "6ada2d7624bc713348056702",
      assetId: data.assetId || "TRK-101",
      name: data.name || "Test Asset",
      category: data.category || "Track",
      department: data.department || "Engineering / Track",
      condition: data.condition || "Good",
      status: data.status || "Active",
      risk: data.risk !== undefined ? data.risk : 25,
      installationDate: data.installationDate || "2023-01-01",
      lastInspectionDate: data.lastInspectionDate || "2026-01-10",
      nextInspectionDate: data.nextInspectionDate || "2026-07-10",
      isDeleted: data.isDeleted || false,
      ...data,
    };
  }

  before(async () => {
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
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    global.__TEST_DOCS__ = {};
    global.__TEST_ASSETS__ = {};
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

  // 1. Date validation
  it("Case 1: Date validation rejects impossible calendar dates and inverted ranges with 400", async () => {
    // Impossible 'from' date (Feb 30)
    const resFeb30 = await getReport("overview", "?from=2026-02-30", adminUser);
    assert.equal(resFeb30.status, 400);
    assert.match(resFeb30.data.error, /invalid 'from' date/i);

    // Impossible 'to' month (month 13)
    const resMonth13 = await getReport("overview", "?to=2026-13-01", adminUser);
    assert.equal(resMonth13.status, 400);
    assert.match(resMonth13.data.error, /invalid 'to' date/i);

    // 'from' after 'to'
    const resInverted = await getReport("overview", "?from=2026-06-01&to=2026-01-01", adminUser);
    assert.equal(resInverted.status, 400);
    assert.match(resInverted.data.error, /cannot be after/i);
  });

  // 2. Department filter validation
  it("Case 2: Invalid department filter rejected with 400", async () => {
    const res = await getReport("overview", "?department=SpaceTravel", adminUser);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /invalid department filter/i);
  });

  // 3. Authentication and role permissions
  it("Case 3: Unauthenticated requests return 401, while passenger and unsupported roles are rejected with 403", async () => {
    const resNoAuth = await getReport("overview", "", null);
    assert.equal(resNoAuth.status, 401);

    const resPass = await getReport("overview", "", passengerUser);
    assert.equal(resPass.status, 403);
    assert.match(resPass.data.error, /passengers are not permitted/i);

    const resUnsupp = await getReport("overview", "", unsupportedUser);
    assert.equal(resUnsupp.status, 403);
    assert.match(resUnsupp.data.error, /not authorized/i);
  });

  // 4. Department scoping
  it("Case 4: Department users cannot view other departments and are restricted to their scope", async () => {
    // Mechanical user attempting to view Bridges
    const resOther = await getReport("overview", "?department=Bridges", mechanicalUser);
    assert.equal(resOther.status, 403);
    assert.match(resOther.data.error, /only authorized to view reports for Mechanical/i);

    // Mechanical user view overview without param -> automatically scoped to Mechanical
    global.__TEST_DOCS__["MR-MEC"] = createMockRequest({
      id: "MR-MEC",
      dept: "Mechanical",
      status: "Completed",
      actual: 50,
    });
    global.__TEST_DOCS__["MR-TRK"] = createMockRequest({
      id: "MR-TRK",
      dept: "Engineering / Track",
      status: "Completed",
      actual: 90,
    });

    const resScoped = await getReport("overview", "", mechanicalUser);
    assert.equal(resScoped.status, 200);
    assert.equal(resScoped.data.totalRequests, 1);
    assert.equal(resScoped.data.department, "Mechanical");
  });

  // 5. Admin cross-department access
  it("Case 5: Admin can access reports across all departments", async () => {
    global.__TEST_DOCS__["MR-1"] = createMockRequest({ id: "MR-1", dept: "Engineering / Track" });
    global.__TEST_DOCS__["MR-2"] = createMockRequest({ id: "MR-2", dept: "Mechanical" });
    global.__TEST_DOCS__["MR-3"] = createMockRequest({ id: "MR-3", dept: "Bridges" });

    const res = await getReport("overview", "", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.totalRequests, 3);
    assert.equal(res.data.department, null);
  });

  // 6. Empty results handling
  it("Case 6: Empty dataset handled gracefully with zero counts and null average duration", async () => {
    const res = await getReport("overview", "", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.totalRequests, 0);
    assert.equal(res.data.completedRequests, 0);
    assert.equal(res.data.overdueRequests, 0);
    assert.equal(res.data.completionRate, 0);
    assert.equal(res.data.avgActualDuration, null);
    assert.equal(res.data.statusBreakdown.Pending, 0);
    assert.equal(res.data.statusBreakdown.Completed, 0);
  });

  // 7. Status breakdown, overdue calculations, and completion rate
  it("Case 7: Status breakdown, overdue calculations, and completion rate calculated accurately", async () => {
    // 2 Completed requests
    global.__TEST_DOCS__["MR-C1"] = createMockRequest({
      id: "MR-C1",
      status: "Completed",
      date: "2026-01-10",
      actual: 40,
    });
    global.__TEST_DOCS__["MR-C2"] = createMockRequest({
      id: "MR-C2",
      status: "Completed",
      date: "2026-02-10",
      actual: 60,
    });
    // 1 In Progress overdue request (date in past: 2026-01-15)
    global.__TEST_DOCS__["MR-O1"] = createMockRequest({
      id: "MR-O1",
      status: "In Progress",
      date: "2026-01-15",
    });
    // 1 Pending overdue request (date in past: 2026-02-01)
    global.__TEST_DOCS__["MR-O2"] = createMockRequest({
      id: "MR-O2",
      status: "Pending",
      date: "2026-02-01",
    });
    // 1 Scheduled future request (date: 2099-12-01)
    global.__TEST_DOCS__["MR-F1"] = createMockRequest({
      id: "MR-F1",
      status: "Scheduled",
      date: "2099-12-01",
    });

    const res = await getReport("overview", "", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.totalRequests, 5);
    assert.equal(res.data.completedRequests, 2);
    assert.equal(res.data.overdueRequests, 2); // MR-O1 and MR-O2
    assert.equal(res.data.completionRate, 40.0); // 2/5 * 100
    assert.equal(res.data.statusBreakdown.Completed, 2);
    assert.equal(res.data.statusBreakdown["In Progress"], 1);
    assert.equal(res.data.statusBreakdown.Pending, 1);
    assert.equal(res.data.statusBreakdown.Scheduled, 1);
    assert.equal(res.data.statusBreakdown.Delayed, 0);
  });

  // 8. Missing actual duration does NOT substitute estimated duration
  it("Case 8: Actual duration metric strictly uses recorded actual duration and never substitutes estimated dur", async () => {
    // Completed request with actual recorded (30 min) and estimated dur 120
    global.__TEST_DOCS__["MR-ACT"] = createMockRequest({
      id: "MR-ACT",
      status: "Completed",
      dur: 120,
      actual: 30,
    });

    // Completed request WITHOUT actual recorded (null) and estimated dur 90
    global.__TEST_DOCS__["MR-NOACT"] = createMockRequest({
      id: "MR-NOACT",
      status: "Completed",
      dur: 90,
      actual: null,
    });

    const res = await getReport("overview", "", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.completedRequests, 2);
    assert.equal(res.data.recordedActualCount, 1);
    // Average actual duration must be 30 (NOT (30+90)/2 = 60)
    assert.equal(res.data.avgActualDuration, 30);
    // Estimated duration sum must be 120 + 90 = 210
    assert.equal(res.data.totalEstimatedDuration, 210);
  });

  // 9. Department report across all 5 departments
  it("Case 9: Departments report provides accurate metrics across all 5 departments", async () => {
    global.__TEST_DOCS__["MR-TRK"] = createMockRequest({
      id: "MR-TRK",
      dept: "Engineering / Track",
      status: "Completed",
      actual: 50,
    });
    global.__TEST_DOCS__["MR-SIG"] = createMockRequest({
      id: "MR-SIG",
      dept: "Signal & Telecom",
      status: "Pending",
      date: "2026-01-01", // overdue
    });

    const res = await getReport("departments", "", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.departments.length, 5);

    const track = res.data.departments.find((d) => d.department === "Engineering / Track");
    assert.equal(track.totalRequests, 1);
    assert.equal(track.completedRequests, 1);
    assert.equal(track.completionRate, 100);
    assert.equal(track.avgActualDuration, 50);

    const sig = res.data.departments.find((d) => d.department === "Signal & Telecom");
    assert.equal(sig.totalRequests, 1);
    assert.equal(sig.overdueRequests, 1);
    assert.equal(sig.completionRate, 0);

    const mech = res.data.departments.find((d) => d.department === "Mechanical");
    assert.equal(mech.totalRequests, 0);

    assert.equal(res.data.summary.totalRequests, 2);
    assert.equal(res.data.summary.completedRequests, 1);
    assert.equal(res.data.summary.overdueRequests, 1);
  });

  // 10. Trends report grouping by month
  it("Case 10: Trends report groups monthly completion and overdue counts properly", async () => {
    global.__TEST_DOCS__["MR-JAN"] = createMockRequest({
      id: "MR-JAN",
      date: "2026-01-15",
      status: "Completed",
      actual: 60,
    });
    global.__TEST_DOCS__["MR-FEB"] = createMockRequest({
      id: "MR-FEB",
      date: "2026-02-15",
      status: "In Progress", // overdue
    });

    const res = await getReport("trends", "?from=2026-01-01&to=2026-03-31", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.trends.length, 3); // Jan, Feb, Mar 2026

    const jan = res.data.trends.find((t) => t.month === "2026-01");
    assert.equal(jan.totalRequests, 1);
    assert.equal(jan.completedRequests, 1);
    assert.equal(jan.avgActualDuration, 60);

    const feb = res.data.trends.find((t) => t.month === "2026-02");
    assert.equal(feb.totalRequests, 1);
    assert.equal(feb.overdueRequests, 1);
    assert.equal(feb.completedRequests, 0);

    const mar = res.data.trends.find((t) => t.month === "2026-03");
    assert.equal(mar.totalRequests, 0);
  });

  // 11. Assets analysis report
  it("Case 11: Assets report analyzes category, condition, status, risk, and inspections", async () => {
    global.__TEST_ASSETS__["AST-1"] = createMockAsset({
      assetId: "AST-1",
      category: "Track",
      condition: "Good",
      status: "Active",
      risk: 80, // High risk
      lastInspectionDate: "2026-01-01",
      nextInspectionDate: "2026-01-20", // Overdue inspection
    });

    global.__TEST_ASSETS__["AST-2"] = createMockAsset({
      assetId: "AST-2",
      category: "Mechanical",
      condition: "Critical",
      status: "Under Maintenance",
      risk: 30, // Low risk
      lastInspectionDate: null, // Uninspected
      nextInspectionDate: "2099-12-31",
    });

    const res = await getReport("assets", "", adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.totalAssets, 2);

    // Risk overview
    assert.equal(res.data.riskOverview.highRiskCount, 1);
    assert.equal(res.data.riskOverview.lowRiskCount, 1);
    assert.equal(res.data.riskOverview.avgRisk, 55.0); // (80 + 30) / 2

    // Category breakdown
    const trackCat = res.data.byCategory.find((c) => c.category === "Track");
    assert.equal(trackCat.count, 1);
    assert.equal(trackCat.avgRisk, 80);

    // Inspections
    assert.equal(res.data.inspections.overdueCount, 1);
    assert.equal(res.data.inspections.uninspectedCount, 1);
  });
});
