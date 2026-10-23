process.env.NODE_ENV = "test";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import maintenanceRequestRoutes, {
  ALLOWED_UPDATE_FIELDS,
  getDepartmentForRole,
} from "../routes/maintenanceRequests.js";

describe("Maintenance Request Status & Authorization Security Tests", () => {
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

  const tractionUser = {
    firebaseUid: "trac-uid-1",
    email: "traction@railmaint.com",
    role: "traction",
    department: "Electrical / Traction",
    status: "active",
  };

  const passengerUser = {
    firebaseUid: "pass-uid-1",
    email: "passenger@railmaint.com",
    role: "passenger",
    status: "active",
  };

  const mechanicalUser = {
    firebaseUid: "mech-uid-1",
    email: "mechanical@railmaint.com",
    role: "mechanical",
    department: "Mechanical",
    status: "active",
  };

  const bridgesUser = {
    firebaseUid: "brg-uid-1",
    email: "bridges@railmaint.com",
    role: "bridges",
    department: "Bridges",
    status: "active",
  };

  const electricalUser = {
    firebaseUid: "ele-uid-1",
    email: "electrical@railmaint.com",
    role: "electrical",
    department: "Electrical / Traction",
    status: "active",
  };

  const unsupportedUser = {
    firebaseUid: "unsupp-uid-1",
    email: "unsupported@railmaint.com",
    role: "auditor",
    status: "active",
  };

  function createMockAsset(data = {}) {
    const assetId = (data.assetId || "TRK-001").toUpperCase();
    return {
      _id: data._id || "6ada2d7624bc713348056701",
      assetId,
      id: assetId,
      name: data.name || "Test Asset",
      category: data.category || "Track",
      department: data.department || "Engineering / Track",
      status: data.status || "Active",
      isDeleted: data.isDeleted || false,
      ...data,
    };
  }

  function createMockDoc(overrides = {}) {
    const doc = {
      _id: "6ada2d7624bc713348056799",
      id: "MR-1001",
      asset: "TRK-001",
      dept: "Engineering / Track",
      type: "Track Inspection",
      pri: "High",
      date: "2026-04-18",
      dur: 60,
      desc: "Inspect main line track segment",
      status: "Pending",
      start: null,
      doneDate: null,
      actual: null,
      note: "",
      createdBy: {
        uid: "eng-uid-1",
        email: "engineer@railmaint.com",
        role: "engineering",
      },
      saveCallCount: 0,
      async save() {
        this.saveCallCount++;
        return { ...this };
      },
      ...overrides,
    };
    return doc;
  }

  before(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/maintenance-requests", maintenanceRequestRoutes);

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

  async function postReq(body, user) {
    const headers = { "Content-Type": "application/json" };
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api/maintenance-requests`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function patchReq(id, body, user) {
    const headers = { "Content-Type": "application/json" };
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api/maintenance-requests/${id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function getReq(id, user) {
    const headers = {};
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api/maintenance-requests/${id}`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function getRequestsList(queryParams = "", user = null) {
    const headers = {};
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api/maintenance-requests${queryParams}`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function deleteReq(id, user) {
    const headers = {};
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api/maintenance-requests/${id}`, {
      method: "DELETE",
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 1. Admin updates a request status successfully.
  it("Case 1: Admin updates a request status successfully", async () => {
    const doc = createMockDoc({ status: "Pending" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    const res = await patchReq("MR-1001", { status: "Delayed" }, adminUser);
    assert.equal(res.status, 200);
    assert.equal(doc.status, "Delayed");
    assert.equal(doc.saveCallCount, 1);
    assert.equal(res.data.request.status, "Delayed");
  });

  // 2. Admin schedules a request successfully.
  it("Case 2: Admin schedules a request successfully", async () => {
    const doc = createMockDoc({ status: "Pending", start: null });
    global.__TEST_DOCS__["MR-1001"] = doc;

    const res = await patchReq(
      "MR-1001",
      { start: "09:30", status: "Scheduled" },
      adminUser
    );
    assert.equal(res.status, 200);
    assert.equal(doc.start, "09:30");
    assert.equal(doc.status, "Scheduled");
    assert.equal(doc.saveCallCount, 1);
  });

  // 3. Department user performs an allowed status transition.
  it("Case 3: Department user performs allowed status transitions (Pending -> In Progress -> Completed)", async () => {
    const doc = createMockDoc({ status: "Pending" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Transition: Pending -> In Progress
    const resProgress = await patchReq(
      "MR-1001",
      { status: "In Progress" },
      engineeringUser
    );
    assert.equal(resProgress.status, 200);
    assert.equal(doc.status, "In Progress");

    // Transition: In Progress -> Completed with completion details
    const resComplete = await patchReq(
      "MR-1001",
      {
        status: "Completed",
        doneDate: "2026-04-18",
        actual: 45,
        note: "Track inspection completed with minor repairs.",
      },
      engineeringUser
    );
    assert.equal(resComplete.status, 200);
    assert.equal(doc.status, "Completed");
    assert.equal(doc.doneDate, "2026-04-18");
    assert.equal(doc.actual, 45);
    assert.equal(doc.note, "Track inspection completed with minor repairs.");
  });

  // 4. Department user attempts an unauthorized status transition.
  it("Case 4: Department user attempts unauthorized status transitions", async () => {
    const doc = createMockDoc({ status: "Pending" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Attempt: Pending directly to Completed (must be In Progress first)
    const resDirectComplete = await patchReq(
      "MR-1001",
      { status: "Completed" },
      engineeringUser
    );
    assert.equal(resDirectComplete.status, 403);
    assert.equal(doc.status, "Pending");

    // Attempt: Department user setting status to Delayed (Admin only)
    const resDelayed = await patchReq(
      "MR-1001",
      { status: "Delayed" },
      engineeringUser
    );
    assert.equal(resDelayed.status, 403);

    // Attempt: Department user setting status to Scheduled (Admin only)
    const resScheduled = await patchReq(
      "MR-1001",
      { status: "Scheduled" },
      engineeringUser
    );
    assert.equal(resScheduled.status, 403);
  });

  // 5. Department user attempts to modify start.
  it("Case 5: Department user attempts to modify start scheduling field", async () => {
    const doc = createMockDoc({ status: "Pending" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    const res = await patchReq("MR-1001", { start: "11:00" }, engineeringUser);
    assert.equal(res.status, 403);
    assert.match(res.data.error, /Only administrators can schedule time windows/i);
    assert.equal(doc.start, null);
  });

  // 6. Unauthorized user attempts to update note without providing status.
  it("Case 6: Unauthorized or non-admin user attempts to update note without providing status", async () => {
    const doc = createMockDoc({ status: "Pending", note: "" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Department user attempting to modify note outside completion
    const resDept = await patchReq(
      "MR-1001",
      { note: "Unauthorized note" },
      engineeringUser
    );
    assert.equal(resDept.status, 403);
    assert.equal(doc.note, "");

    // User from different department (traction) attempting to update note
    const resOtherDept = await patchReq(
      "MR-1001",
      { note: "Malicious note" },
      tractionUser
    );
    assert.equal(resOtherDept.status, 403);
    assert.equal(doc.note, "");
  });

  // 7. Unauthorized user attempts to update doneDate or actual without providing status.
  it("Case 7: Unauthorized user attempts to update doneDate or actual without providing status", async () => {
    const doc = createMockDoc({ status: "Pending", doneDate: null, actual: null });
    global.__TEST_DOCS__["MR-1001"] = doc;

    const res = await patchReq(
      "MR-1001",
      { doneDate: "2026-04-18", actual: 50 },
      engineeringUser
    );
    assert.equal(res.status, 403);
    assert.equal(doc.doneDate, null);
    assert.equal(doc.actual, null);
  });

  // 8. User attempts to change protected fields such as createdBy, dept, or pri.
  it("Case 8: User attempts to change protected fields such as createdBy, dept, or pri", async () => {
    const doc = createMockDoc();
    global.__TEST_DOCS__["MR-1001"] = doc;

    const res = await patchReq(
      "MR-1001",
      {
        dept: "Electrical / Traction",
        pri: "Critical",
        createdBy: { uid: "attacker", role: "admin" },
      },
      adminUser
    );
    assert.equal(res.status, 400);
    assert.match(res.data.error, /Cannot modify field\(s\):/i);
    assert.equal(doc.dept, "Engineering / Track");
    assert.equal(doc.pri, "High");
  });

  // 9. Invalid duration, date, status, and malformed payloads are rejected.
  it("Case 9: Invalid duration, date, status, and malformed payloads are rejected with 400", async () => {
    const doc = createMockDoc({ status: "In Progress" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Malformed non-object payload
    const resArray = await patchReq("MR-1001", ["status", "Completed"], adminUser);
    assert.equal(resArray.status, 400);

    // Empty object payload
    const resEmpty = await patchReq("MR-1001", {}, adminUser);
    assert.equal(resEmpty.status, 400);

    // Invalid status string
    const resInvalidStatus = await patchReq(
      "MR-1001",
      { status: "BogusStatus" },
      adminUser
    );
    assert.equal(resInvalidStatus.status, 400);

    // Invalid negative actual duration
    const resNegDur = await patchReq(
      "MR-1001",
      { status: "Completed", actual: -20, doneDate: "2026-04-18" },
      adminUser
    );
    assert.equal(resNegDur.status, 400);

    // Invalid date format
    const resBadDate = await patchReq(
      "MR-1001",
      { status: "Completed", doneDate: "invalid-date" },
      adminUser
    );
    assert.equal(resBadDate.status, 400);

    // Invalid start time format
    const resBadStart = await patchReq(
      "MR-1001",
      { start: "29:99" },
      adminUser
    );
    assert.equal(resBadStart.status, 400);

    // Note exceeding maximum limit
    const resHugeNote = await patchReq(
      "MR-1001",
      { note: "x".repeat(2005) },
      adminUser
    );
    assert.equal(resHugeNote.status, 400);
  });

  // 10. Failed updates do not modify the MongoDB document.
  it("Case 10: Failed updates do not modify the MongoDB document", async () => {
    const doc = createMockDoc({
      status: "Pending",
      start: null,
      doneDate: null,
      actual: null,
      note: "Initial note",
    });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Trigger failure due to unauthorized role attempt on status
    const res1 = await patchReq(
      "MR-1001",
      { status: "Scheduled" },
      engineeringUser
    );
    assert.equal(res1.status, 403);
    assert.equal(doc.status, "Pending");
    assert.equal(doc.saveCallCount, 0);

    // Trigger failure due to invalid payload
    const res2 = await patchReq("MR-1001", { actual: "invalid" }, adminUser);
    assert.equal(res2.status, 400);
    assert.equal(doc.actual, null);
    assert.equal(doc.saveCallCount, 0);
  });

  // 11. Existing Admin dashboard status updates still work.
  it("Case 11: Existing Admin dashboard status updates still work smoothly", async () => {
    const doc = createMockDoc({ status: "In Progress", dur: 60 });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Admin dashboard markCompleted call payload
    const adminDashboardPayload = {
      status: "Completed",
      doneDate: "2026-04-18",
      actual: 60,
      note: "Completed via Admin Modal",
    };

    const res = await patchReq("MR-1001", adminDashboardPayload, adminUser);
    assert.equal(res.status, 200);
    assert.equal(doc.status, "Completed");
    assert.equal(doc.doneDate, "2026-04-18");
    assert.equal(doc.actual, 60);
    assert.equal(doc.note, "Completed via Admin Modal");
    assert.equal(doc.saveCallCount, 1);
  });

  // 12. A successful update remains correct after refreshing the dashboard.
  it("Case 12: Successful update remains correct upon querying GET endpoint", async () => {
    const doc = createMockDoc({ status: "Pending" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    // Step 1: Update via PATCH
    const patchRes = await patchReq(
      "MR-1001",
      { status: "In Progress" },
      engineeringUser
    );
    assert.equal(patchRes.status, 200);

    // Step 2: Fetch via GET (simulating dashboard refresh / reload)
    const getRes = await getReq("MR-1001", engineeringUser);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.request.status, "In Progress");
  });

  // 13. Delete a maintenance request successfully
  it("Case 13: Delete maintenance request successfully", async () => {
    const doc = createMockDoc({ id: "MR-1001", status: "Pending" });
    global.__TEST_DOCS__["MR-1001"] = doc;

    const res = await deleteReq("MR-1001", engineeringUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.deleted, true);
    assert.equal(global.__TEST_DOCS__["MR-1001"], undefined);
  });

  // 14. Reject creation when asset does not exist (404)
  it("Case 14: Reject maintenance request creation for nonexistent asset with 404", async () => {
    const payload = {
      asset: "NONEXISTENT-999",
      dept: "Engineering / Track",
      type: "Track Inspection",
      pri: "High",
      date: "2026-05-10",
      dur: 60,
      desc: "Inspection for ghost asset",
    };

    const res = await postReq(payload, engineeringUser);
    assert.equal(res.status, 404);
    assert.match(res.data.error, /not found/i);
    assert.equal(Object.keys(global.__TEST_DOCS__).length, 0);
  });

  // 15. Reject creation when asset is inactive or decommissioned (400)
  it("Case 15: Reject maintenance request creation for inactive or decommissioned asset with 400", async () => {
    global.__TEST_ASSETS__["TRK-DECOM"] = createMockAsset({
      assetId: "TRK-DECOM",
      department: "Engineering / Track",
      status: "Decommissioned",
      isDeleted: true,
    });

    const payload = {
      asset: "TRK-DECOM",
      dept: "Engineering / Track",
      type: "Track Inspection",
      pri: "Medium",
      date: "2026-05-10",
      dur: 60,
      desc: "Attempt on decommissioned asset",
    };

    const res = await postReq(payload, engineeringUser);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /inactive or decommissioned/i);
  });

  // 16. Reject creation when asset department does not match request department (400)
  it("Case 16: Reject maintenance request when asset department does not match request department with 400", async () => {
    global.__TEST_ASSETS__["TRK-001"] = createMockAsset({
      assetId: "TRK-001",
      department: "Engineering / Track",
      status: "Active",
    });

    const payload = {
      asset: "TRK-001",
      dept: "Electrical / Traction",
      type: "Overhead Wire Check",
      pri: "High",
      date: "2026-05-10",
      dur: 60,
      desc: "Mismatched department request",
    };

    const res = await postReq(payload, adminUser);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /does not match request department/i);
  });

  // 17. Role-to-department authorization supports mechanical, bridges, and electrical roles
  it("Case 17: Department roles (Mechanical, Bridges, Electrical) can create requests in their department", async () => {
    // Mechanical asset & request
    global.__TEST_ASSETS__["MEC-401"] = createMockAsset({
      assetId: "MEC-401",
      department: "Mechanical",
      category: "Mechanical",
      status: "Active",
    });

    const mechPayload = {
      asset: "MEC-401",
      dept: "Mechanical",
      type: "Brake Overhaul",
      pri: "High",
      date: "2026-05-12",
      dur: 120,
      desc: "Inspect and replace bogie brakes",
    };
    const mechRes = await postReq(mechPayload, mechanicalUser);
    assert.equal(mechRes.status, 201);
    assert.equal(mechRes.data.request.dept, "Mechanical");

    // Bridges asset & request
    global.__TEST_ASSETS__["BRG-501"] = createMockAsset({
      assetId: "BRG-501",
      department: "Bridges",
      category: "Bridges",
      status: "Active",
    });

    const brgPayload = {
      asset: "BRG-501",
      dept: "Bridges",
      type: "Girder Stress Test",
      pri: "Medium",
      date: "2026-05-14",
      dur: 90,
      desc: "Ultrasonic girder testing",
    };
    const brgRes = await postReq(brgPayload, bridgesUser);
    assert.equal(brgRes.status, 201);
    assert.equal(brgRes.data.request.dept, "Bridges");

    // Electrical alias role creating Electrical / Traction
    global.__TEST_ASSETS__["ELE-301"] = createMockAsset({
      assetId: "ELE-301",
      department: "Electrical / Traction",
      category: "Electrical & Power",
      status: "Active",
    });

    const elePayload = {
      asset: "ELE-301",
      dept: "Electrical / Traction",
      type: "Catenary Maintenance",
      pri: "High",
      date: "2026-05-15",
      dur: 60,
      desc: "Overhead wire calibration",
    };
    const eleRes = await postReq(elePayload, electricalUser);
    assert.equal(eleRes.status, 201);
    assert.equal(eleRes.data.request.dept, "Electrical / Traction");
  });

  // 18. Passenger and unsupported roles fail closed
  it("Case 18: Passenger and unsupported roles fail closed on create, patch, and delete", async () => {
    global.__TEST_ASSETS__["TRK-001"] = createMockAsset({
      assetId: "TRK-001",
      department: "Engineering / Track",
      status: "Active",
    });

    const payload = {
      asset: "TRK-001",
      dept: "Engineering / Track",
      type: "Track Inspection",
      pri: "Medium",
      date: "2026-05-10",
      dur: 60,
      desc: "Test unauthorized create",
    };

    // Passenger cannot create
    const passCreate = await postReq(payload, passengerUser);
    assert.equal(passCreate.status, 403);
    assert.match(passCreate.data.error, /passengers are not permitted/i);

    // Unsupported role cannot create (fails closed)
    const unsuppCreate = await postReq(payload, unsupportedUser);
    assert.equal(unsuppCreate.status, 403);
    assert.match(unsuppCreate.data.error, /not authorized/i);

    // Passenger cannot patch status
    const doc = createMockDoc({ id: "MR-9001", status: "Pending" });
    global.__TEST_DOCS__["MR-9001"] = doc;

    const passPatch = await patchReq("MR-9001", { status: "In Progress" }, passengerUser);
    assert.equal(passPatch.status, 403);
    assert.match(passPatch.data.error, /passengers are not permitted/i);

    // Passenger cannot delete
    const passDelete = await deleteReq("MR-9001", passengerUser);
    assert.equal(passDelete.status, 403);
    assert.match(passDelete.data.error, /passengers are not permitted/i);
  });

  // 19. Strict date validation on create rejects impossible and malformed dates
  it("Case 19: Strict date validation on create rejects impossible calendar dates and malformed strings", async () => {
    global.__TEST_ASSETS__["TRK-001"] = createMockAsset({
      assetId: "TRK-001",
      department: "Engineering / Track",
      status: "Active",
    });

    const basePayload = {
      asset: "TRK-001",
      dept: "Engineering / Track",
      type: "Track Inspection",
      pri: "Medium",
      dur: 60,
      desc: "Date validation test",
    };

    // Impossible calendar date: Feb 30
    const resFeb30 = await postReq({ ...basePayload, date: "2026-02-30" }, engineeringUser);
    assert.equal(resFeb30.status, 400);
    assert.match(resFeb30.data.error, /valid target date/i);

    // Impossible calendar date: Non-leap year Feb 29
    const resNonLeap = await postReq({ ...basePayload, date: "2025-02-29" }, engineeringUser);
    assert.equal(resNonLeap.status, 400);
    assert.match(resNonLeap.data.error, /valid target date/i);

    // Impossible month: 13
    const resMonth13 = await postReq({ ...basePayload, date: "2026-13-01" }, engineeringUser);
    assert.equal(resMonth13.status, 400);

    // Malformed string format (slashes instead of dashes)
    const resSlash = await postReq({ ...basePayload, date: "2026/04/18" }, engineeringUser);
    assert.equal(resSlash.status, 400);

    // Valid leap year Feb 29 accepted
    const resLeap = await postReq({ ...basePayload, date: "2024-02-29" }, engineeringUser);
    assert.equal(resLeap.status, 201);
  });

  // 20. Concurrent request ID collision is handled safely via bounded retry
  it("Case 20: Concurrent request ID collision handled safely with bounded retry", async () => {
    global.__TEST_ASSETS__["TRK-001"] = createMockAsset({
      assetId: "TRK-001",
      department: "Engineering / Track",
      status: "Active",
    });

    const payload = {
      asset: "TRK-001",
      dept: "Engineering / Track",
      type: "Track Inspection",
      pri: "Medium",
      date: "2026-05-18",
      dur: 60,
      desc: "Collision retry test",
    };

    // Simulate collision on first attempt
    global.__TEST_FORCE_MR_COLLISION__ = true;

    const res = await postReq(payload, engineeringUser);
    assert.equal(res.status, 201);
    assert.ok(res.data.request.id);
  });

  // 21. Cross-department access for Admin and department-specific filtering
  it("Case 21: Admin can access requests across all departments, and department filtering works", async () => {
    global.__TEST_DOCS__["MR-TRACK"] = createMockDoc({
      id: "MR-TRACK",
      dept: "Engineering / Track",
    });
    global.__TEST_DOCS__["MR-MECH"] = createMockDoc({
      id: "MR-MECH",
      dept: "Mechanical",
    });
    global.__TEST_DOCS__["MR-BRG"] = createMockDoc({
      id: "MR-BRG",
      dept: "Bridges",
    });

    // Admin sees all 3 requests
    const resAdmin = await getRequestsList("", adminUser);
    assert.equal(resAdmin.status, 200);
    assert.equal(resAdmin.data.count, 3);

    // Mechanical user only sees Mechanical requests (and any they created)
    const resMech = await getRequestsList("", mechanicalUser);
    assert.equal(resMech.status, 200);
    assert.equal(resMech.data.count, 1);
    assert.equal(resMech.data.requests[0].dept, "Mechanical");

    // Filter by department query
    const resFilter = await getRequestsList("?dept=Bridges", adminUser);
    assert.equal(resFilter.status, 200);
    assert.equal(resFilter.data.count, 1);
    assert.equal(resFilter.data.requests[0].dept, "Bridges");

    // Filter yielding empty results
    const resEmpty = await getRequestsList("?dept=NonexistentDept", adminUser);
    assert.equal(resEmpty.status, 200);
    assert.equal(resEmpty.data.count, 0);
  });
});
