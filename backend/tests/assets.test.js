process.env.NODE_ENV = "test";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import assetRoutes from "../routes/assets.js";
import maintenanceRequestRoutes from "../routes/maintenanceRequests.js";

describe("Asset Management Backend API & Integration Tests", () => {
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

  function createMockAssetDoc(data = {}) {
    const assetId = (data.assetId || "TRK-101").toUpperCase();
    const doc = {
      _id: data._id || "6ada2d7624bc713348056701",
      assetId,
      id: assetId,
      name: data.name || "Main Line Track Section 1",
      category: data.category || "Track",
      assetType: data.assetType || "rails",
      type: data.type || data.category || "Track",
      location: data.location || "North Junction, KM 12.4",
      department: data.department || "Engineering / Track",
      condition: data.condition || "Good",
      status: data.status || "Active",
      risk: data.risk !== undefined ? data.risk : 25,
      age: data.age !== undefined ? data.age : 3,
      installationDate: data.installationDate || "2023-01-15",
      lastInspectionDate: data.lastInspectionDate || "2026-03-10",
      nextInspectionDate: data.nextInspectionDate || "2026-06-10",
      last: data.lastInspectionDate || "2026-03-10",
      description: data.description || "Continuous welded rail section",
      isDeleted: data.isDeleted || false,
      createdBy: data.createdBy || {
        uid: "eng-uid-1",
        email: "engineer@railmaint.com",
        role: "engineering",
      },
      saveCallCount: 0,
      async save() {
        this.saveCallCount++;
        this.id = this.assetId;
        this.type = this.category;
        if (this.lastInspectionDate) this.last = this.lastInspectionDate;
        if (global.__TEST_ASSETS__) {
          global.__TEST_ASSETS__[this.assetId] = this;
        }
        return { ...this };
      },
      ...data,
    };
    return doc;
  }

  function createMockRequestDoc(data = {}) {
    const doc = {
      _id: data._id || "6ada2d7624bc713348056799",
      id: data.id || "MR-1001",
      asset: data.asset || "TRK-101",
      assetRef: data.assetRef || null,
      dept: data.dept || "Engineering / Track",
      type: data.type || "Track Inspection",
      pri: data.pri || "High",
      date: data.date || "2026-04-18",
      dur: data.dur || 60,
      desc: data.desc || "Inspect track railhead",
      status: data.status || "Pending",
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
        if (global.__TEST_DOCS__) {
          global.__TEST_DOCS__[this.id] = this;
        }
        return { ...this };
      },
      ...data,
    };
    return doc;
  }

  before(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/assets", assetRoutes);
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
    global.__TEST_ASSETS__ = {};
    global.__TEST_DOCS__ = {};
  });

  async function apiCall(endpoint, method = "GET", body = null, user = null) {
    const headers = { "Content-Type": "application/json" };
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const opts = { method, headers };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${endpoint}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 1. Successful asset creation
  it("Case 1: Successful asset creation by department engineer", async () => {
    const payload = {
      assetId: "TRK-101",
      name: "Main Line Segment 1",
      category: "Track",
      assetType: "rails",
      location: "Platform 1 North",
      condition: "Good",
      status: "Active",
      risk: 20,
      age: 2,
    };

    const res = await apiCall("/api/assets", "POST", payload, engineeringUser);
    assert.equal(res.status, 201);
    assert.equal(res.data.asset.assetId, "TRK-101");
    assert.equal(res.data.asset.department, "Engineering / Track");
    assert.equal(res.data.asset.type, "Track");
  });

  // 2. Missing required fields
  it("Case 2: Missing required fields rejected with 400", async () => {
    // Missing name
    const resNoName = await apiCall(
      "/api/assets",
      "POST",
      { category: "Track", location: "Loc 1" },
      engineeringUser
    );
    assert.equal(resNoName.status, 400);
    assert.match(resNoName.data.error, /name is required/i);

    // Missing category
    const resNoCat = await apiCall(
      "/api/assets",
      "POST",
      { name: "Asset Name", location: "Loc 1" },
      engineeringUser
    );
    assert.equal(resNoCat.status, 400);
    assert.match(resNoCat.data.error, /category is required/i);

    // Missing location
    const resNoLoc = await apiCall(
      "/api/assets",
      "POST",
      { name: "Asset Name", category: "Track" },
      engineeringUser
    );
    assert.equal(resNoLoc.status, 400);
    assert.match(resNoLoc.data.error, /location is required/i);
  });

  // 3. Duplicate asset ID
  it("Case 3: Duplicate asset ID rejected with 400", async () => {
    const existing = createMockAssetDoc({ assetId: "TRK-101" });
    global.__TEST_ASSETS__["TRK-101"] = existing;

    const payload = {
      assetId: "TRK-101",
      name: "Duplicate Track",
      category: "Track",
      location: "Platform 2",
    };

    const res = await apiCall("/api/assets", "POST", payload, engineeringUser);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /already exists/i);
  });

  // 4. Listing and filtering assets
  it("Case 4: Listing and filtering assets by category, department, and search", async () => {
    global.__TEST_ASSETS__["TRK-101"] = createMockAssetDoc({
      assetId: "TRK-101",
      name: "North Track Line",
      category: "Track",
      department: "Engineering / Track",
      condition: "Good",
    });
    global.__TEST_ASSETS__["ELE-301"] = createMockAssetDoc({
      assetId: "ELE-301",
      name: "Traction Substation 1",
      category: "Electrical & Power",
      department: "Electrical / Traction",
      condition: "At Risk",
    });

    // Filter by category
    const resCat = await apiCall("/api/assets?category=Track", "GET", null, adminUser);
    assert.equal(resCat.status, 200);
    assert.equal(resCat.data.assets.length, 1);
    assert.equal(resCat.data.assets[0].assetId, "TRK-101");

    // Search by text
    const resSearch = await apiCall("/api/assets?search=Substation", "GET", null, adminUser);
    assert.equal(resSearch.status, 200);
    assert.equal(resSearch.data.assets.length, 1);
    assert.equal(resSearch.data.assets[0].assetId, "ELE-301");
  });

  // 5. Pagination
  it("Case 5: Pagination works correctly with page and limit", async () => {
    for (let i = 1; i <= 5; i++) {
      const id = `TRK-10${i}`;
      global.__TEST_ASSETS__[id] = createMockAssetDoc({
        assetId: id,
        name: `Track Section ${i}`,
        category: "Track",
      });
    }

    const res = await apiCall("/api/assets?page=1&limit=2", "GET", null, adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.assets.length, 2);
    assert.equal(res.data.total, 5);
    assert.equal(res.data.page, 1);
    assert.equal(res.data.limit, 2);
    assert.equal(res.data.totalPages, 3);
  });

  // 6. Retrieving an existing asset
  it("Case 6: Retrieving an existing asset by ID", async () => {
    global.__TEST_ASSETS__["TRK-101"] = createMockAssetDoc({
      assetId: "TRK-101",
      name: "North Track Line",
    });

    const res = await apiCall("/api/assets/TRK-101", "GET", null, engineeringUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.asset.assetId, "TRK-101");
    assert.equal(res.data.asset.name, "North Track Line");
  });

  // 7. Handling an invalid ID and a nonexistent asset
  it("Case 7: Nonexistent or malformed asset ID returns 404 safely", async () => {
    const resNonExistent = await apiCall(
      "/api/assets/NONEXISTENT-999",
      "GET",
      null,
      adminUser
    );
    assert.equal(resNonExistent.status, 404);
    assert.match(resNonExistent.data.error, /not found/i);
  });

  // 8. Updating valid fields
  it("Case 8: Updating valid fields successfully", async () => {
    const doc = createMockAssetDoc({
      assetId: "TRK-101",
      name: "Old Name",
      risk: 20,
      condition: "Good",
    });
    global.__TEST_ASSETS__["TRK-101"] = doc;

    const res = await apiCall(
      "/api/assets/TRK-101",
      "PATCH",
      {
        name: "Upgraded Main Line Track",
        condition: "Fair",
        risk: 45,
        location: "KM 15.0 Junction",
      },
      engineeringUser
    );

    assert.equal(res.status, 200);
    assert.equal(doc.name, "Upgraded Main Line Track");
    assert.equal(doc.condition, "Fair");
    assert.equal(doc.risk, 45);
    assert.equal(doc.location, "KM 15.0 Junction");
  });

  // 9. Rejecting invalid updates
  it("Case 9: Rejecting updates to immutable fields or invalid values", async () => {
    const doc = createMockAssetDoc({ assetId: "TRK-101" });
    global.__TEST_ASSETS__["TRK-101"] = doc;

    // Immutable field assetId
    const resImm = await apiCall(
      "/api/assets/TRK-101",
      "PATCH",
      { assetId: "HACKED-999" },
      adminUser
    );
    assert.equal(resImm.status, 400);
    assert.match(resImm.data.error, /cannot modify immutable field/i);

    // Invalid condition
    const resCond = await apiCall(
      "/api/assets/TRK-101",
      "PATCH",
      { condition: "SuperRuined" },
      adminUser
    );
    assert.equal(resCond.status, 400);
    assert.match(resCond.data.error, /invalid condition/i);

    // Invalid negative risk
    const resRisk = await apiCall(
      "/api/assets/TRK-101",
      "PATCH",
      { risk: -50 },
      adminUser
    );
    assert.equal(resRisk.status, 400);
    assert.match(resRisk.data.error, /risk score must be a number/i);
  });

  // 10. Authentication and role permissions
  it("Case 10: Authentication and role permissions enforced on all endpoints", async () => {
    const doc = createMockAssetDoc({
      assetId: "ELE-301",
      department: "Electrical / Traction",
    });
    global.__TEST_ASSETS__["ELE-301"] = doc;

    // Unauthenticated request
    const resNoAuth = await apiCall("/api/assets/ELE-301", "GET", null, null);
    assert.equal(resNoAuth.status, 401);

    // Passenger attempting modification
    const resPass = await apiCall(
      "/api/assets/ELE-301",
      "PATCH",
      { name: "Hacked by Passenger" },
      passengerUser
    );
    assert.equal(resPass.status, 403);

    // Engineering user trying to update an Electrical asset
    const resWrongDept = await apiCall(
      "/api/assets/ELE-301",
      "PATCH",
      { name: "Wrong Dept Update" },
      engineeringUser
    );
    assert.equal(resWrongDept.status, 403);
    assert.match(resWrongDept.data.error, /access denied/i);

    // Admin allowed to update any asset
    const resAdmin = await apiCall(
      "/api/assets/ELE-301",
      "PATCH",
      { name: "Admin Verified Substation" },
      adminUser
    );
    assert.equal(resAdmin.status, 200);
  });

  // 11. Safe deletion or deactivation
  it("Case 11: Safe deletion and deactivation based on maintenance history", async () => {
    // 11a: Asset with NO maintenance history
    const doc1 = createMockAssetDoc({ assetId: "TRK-101" });
    global.__TEST_ASSETS__["TRK-101"] = doc1;

    const resDelete = await apiCall("/api/assets/TRK-101", "DELETE", null, adminUser);
    assert.equal(resDelete.status, 200);
    assert.equal(doc1.isDeleted, true);
    assert.equal(doc1.status, "Decommissioned");
    assert.equal(resDelete.data.deleted, true);

    // 11b: Asset WITH linked maintenance history
    const doc2 = createMockAssetDoc({ assetId: "TRK-102" });
    global.__TEST_ASSETS__["TRK-102"] = doc2;
    global.__TEST_DOCS__["MR-2001"] = createMockRequestDoc({
      id: "MR-2001",
      asset: "TRK-102",
      status: "Completed",
    });

    const resDeact = await apiCall("/api/assets/TRK-102", "DELETE", null, adminUser);
    assert.equal(resDeact.status, 200);
    assert.equal(doc2.isDeleted, true);
    assert.equal(doc2.status, "Decommissioned");
    assert.equal(resDeact.data.deactivated, true);
    assert.equal(resDeact.data.linkedRequests, 1);
  });

  // 12. Retrieving maintenance history
  it("Case 12: Retrieving maintenance history for an asset", async () => {
    const doc = createMockAssetDoc({ assetId: "TRK-103" });
    global.__TEST_ASSETS__["TRK-103"] = doc;

    global.__TEST_DOCS__["MR-3001"] = createMockRequestDoc({
      id: "MR-3001",
      asset: "TRK-103",
      type: "Rail Ultrasonic Test",
      status: "Completed",
    });
    global.__TEST_DOCS__["MR-3002"] = createMockRequestDoc({
      id: "MR-3002",
      asset: "TRK-103",
      type: "Fastener Replacement",
      status: "In Progress",
    });

    const res = await apiCall(
      "/api/assets/TRK-103/maintenance-history",
      "GET",
      null,
      engineeringUser
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.assetId, "TRK-103");
    assert.equal(res.data.count, 2);
    assert.equal(res.data.maintenanceHistory.length, 2);
  });

  // 13. Validating asset references in maintenance requests
  it("Case 13: Validating asset references when creating maintenance requests", async () => {
    // Registered active track asset
    global.__TEST_ASSETS__["TRK-104"] = createMockAssetDoc({
      assetId: "TRK-104",
      department: "Engineering / Track",
      status: "Active",
      isDeleted: false,
    });

    // Registered decommissioned asset
    global.__TEST_ASSETS__["TRK-DEAD"] = createMockAssetDoc({
      assetId: "TRK-DEAD",
      department: "Engineering / Track",
      status: "Decommissioned",
      isDeleted: true,
    });

    // 13a: Attempting to create request on inactive asset -> 400
    const resInactive = await apiCall(
      "/api/maintenance-requests",
      "POST",
      {
        asset: "TRK-DEAD",
        dept: "Engineering / Track",
        type: "Rail Grinding",
        pri: "High",
        date: "2026-05-01",
        dur: 60,
        desc: "Attempt on inactive asset",
      },
      engineeringUser
    );
    assert.equal(resInactive.status, 400);
    assert.match(resInactive.data.error, /inactive or decommissioned/i);

    // 13b: Attempting to create request with mismatched department -> 400
    const resMismatch = await apiCall(
      "/api/maintenance-requests",
      "POST",
      {
        asset: "TRK-104",
        dept: "Electrical / Traction",
        type: "Transformer service",
        pri: "High",
        date: "2026-05-01",
        dur: 60,
        desc: "Department mismatch test",
      },
      adminUser
    );
    assert.equal(resMismatch.status, 400);
    assert.match(resMismatch.data.error, /does not match request department/i);
  });

  // 14. Ensuring existing maintenance request tests still pass
  it("Case 14: Ensuring existing maintenance request update tests continue to pass", async () => {
    const doc = createMockRequestDoc({ id: "MR-5001", status: "Pending" });
    global.__TEST_DOCS__["MR-5001"] = doc;

    const res = await apiCall(
      "/api/maintenance-requests/MR-5001/status",
      "PATCH",
      { status: "In Progress" },
      engineeringUser
    );
    assert.equal(res.status, 200);
    assert.equal(doc.status, "In Progress");
  });

  // 15. Category and department consistency on creation
  it("Case 15: Category and department consistency on asset creation", async () => {
    // Inconsistent category & department -> 400
    const resInconsistent = await apiCall(
      "/api/assets",
      "POST",
      {
        name: "Conflicted Asset",
        category: "Track",
        department: "Electrical / Traction",
        location: "Platform 1",
      },
      adminUser
    );
    assert.equal(resInconsistent.status, 400);
    assert.match(resInconsistent.data.error, /not compatible with department/i);

    // Consistent Mechanical asset -> 201
    const resMech = await apiCall(
      "/api/assets",
      "POST",
      {
        name: "Wheel Lathe 1",
        category: "Mechanical",
        department: "Mechanical",
        location: "Depot Bay 4",
      },
      adminUser
    );
    assert.equal(resMech.status, 201);
    assert.equal(resMech.data.asset.department, "Mechanical");

    // Consistent Bridges asset -> 201
    const resBrg = await apiCall(
      "/api/assets",
      "POST",
      {
        name: "Ganga Rail Bridge Pier 5",
        category: "Bridges",
        department: "Bridges",
        location: "KM 42.0",
      },
      adminUser
    );
    assert.equal(resBrg.status, 201);
    assert.equal(resBrg.data.asset.department, "Bridges");
  });

  // 16. Category and department consistency on updates (partial updates)
  it("Case 16: Category and department consistency on partial updates", async () => {
    const doc = createMockAssetDoc({
      assetId: "TRK-201",
      name: "Track Switch Point",
      category: "Track",
      department: "Engineering / Track",
    });
    global.__TEST_ASSETS__["TRK-201"] = doc;

    // Partial update: updating department to incompatible value leaves asset inconsistent -> 400
    const resIncompDept = await apiCall(
      "/api/assets/TRK-201",
      "PATCH",
      { department: "Signal & Telecom" },
      adminUser
    );
    assert.equal(resIncompDept.status, 400);
    assert.match(resIncompDept.data.error, /not compatible with department/i);
    assert.equal(doc.department, "Engineering / Track");

    // Partial update: updating category to incompatible value leaves asset inconsistent -> 400
    const resIncompCat = await apiCall(
      "/api/assets/TRK-201",
      "PATCH",
      { category: "Mechanical" },
      adminUser
    );
    assert.equal(resIncompCat.status, 400);
    assert.match(resIncompCat.data.error, /not compatible with department/i);
    assert.equal(doc.category, "Track");

    // Full consistent update: both category and department updated together -> 200
    const resCompBoth = await apiCall(
      "/api/assets/TRK-201",
      "PATCH",
      {
        category: "Signals & Communication",
        department: "Signal & Telecom",
      },
      adminUser
    );
    assert.equal(resCompBoth.status, 200);
    assert.equal(doc.category, "Signals & Communication");
    assert.equal(doc.department, "Signal & Telecom");
  });

  // 17. Strict date validation on asset creation and updates
  it("Case 17: Strict date validation on asset creation and update rejects impossible and malformed dates", async () => {
    const baseCreate = {
      name: "Date Test Asset",
      category: "Track",
      location: "Main Line",
    };

    // Impossible calendar date: Feb 30
    const resFeb30 = await apiCall(
      "/api/assets",
      "POST",
      { ...baseCreate, installationDate: "2026-02-30" },
      adminUser
    );
    assert.equal(resFeb30.status, 400);
    assert.match(resFeb30.data.error, /invalid installationDate/i);

    // Impossible month: 13
    const resMonth13 = await apiCall(
      "/api/assets",
      "POST",
      { ...baseCreate, lastInspectionDate: "2026-13-01" },
      adminUser
    );
    assert.equal(resMonth13.status, 400);
    assert.match(resMonth13.data.error, /invalid lastInspectionDate/i);

    // Malformed string
    const resBadFormat = await apiCall(
      "/api/assets",
      "POST",
      { ...baseCreate, nextInspectionDate: "2026/06/10" },
      adminUser
    );
    assert.equal(resBadFormat.status, 400);
    assert.match(resBadFormat.data.error, /invalid nextInspectionDate/i);

    // Valid dates create successfully
    const resValid = await apiCall(
      "/api/assets",
      "POST",
      {
        ...baseCreate,
        installationDate: "2024-02-29", // Valid leap year
        lastInspectionDate: "2026-01-15",
        nextInspectionDate: "2026-06-15",
      },
      adminUser
    );
    assert.equal(resValid.status, 201);

    // Test invalid date update on existing asset -> 400
    const doc = createMockAssetDoc({ assetId: "TRK-DATE-1" });
    global.__TEST_ASSETS__["TRK-DATE-1"] = doc;

    const resPatchBadDate = await apiCall(
      "/api/assets/TRK-DATE-1",
      "PATCH",
      { lastInspectionDate: "2025-02-29" }, // 2025 is not a leap year!
      adminUser
    );
    assert.equal(resPatchBadDate.status, 400);
    assert.match(resPatchBadDate.data.error, /invalid lastInspectionDate/i);
  });

  // 18. Search and location filters with regex character escaping and empty results
  it("Case 18: Search and location filters handle special regex characters safely and return empty results when not matched", async () => {
    global.__TEST_ASSETS__["TRK-LOC-1"] = createMockAssetDoc({
      assetId: "TRK-LOC-1",
      name: "Main Line [Section A]",
      location: "Platform (North)",
      department: "Engineering / Track",
    });

    // Location query matching
    const resLoc = await apiCall(
      "/api/assets?location=Platform (North)",
      "GET",
      null,
      adminUser
    );
    assert.equal(resLoc.status, 200);
    assert.equal(resLoc.data.assets.length, 1);
    assert.equal(resLoc.data.assets[0].assetId, "TRK-LOC-1");

    // Search query with regex special chars `[` and `]`
    const resSearch = await apiCall(
      "/api/assets?search=[Section A]",
      "GET",
      null,
      adminUser
    );
    assert.equal(resSearch.status, 200);
    assert.equal(resSearch.data.assets.length, 1);
    assert.equal(resSearch.data.assets[0].assetId, "TRK-LOC-1");

    // Empty search results
    const resEmpty = await apiCall(
      "/api/assets?search=NonExistentQueryXYZ999",
      "GET",
      null,
      adminUser
    );
    assert.equal(resEmpty.status, 200);
    assert.equal(resEmpty.data.assets.length, 0);
    assert.equal(resEmpty.data.total, 0);
  });

  // 19. Department filtering on asset list
  it("Case 19: Department filtering on asset list", async () => {
    global.__TEST_ASSETS__["MEC-1"] = createMockAssetDoc({
      assetId: "MEC-1",
      department: "Mechanical",
      category: "Mechanical",
    });
    global.__TEST_ASSETS__["BRG-1"] = createMockAssetDoc({
      assetId: "BRG-1",
      department: "Bridges",
      category: "Bridges",
    });

    const resDept = await apiCall(
      "/api/assets?department=Mechanical",
      "GET",
      null,
      adminUser
    );
    assert.equal(resDept.status, 200);
    assert.equal(resDept.data.assets.length, 1);
    assert.equal(resDept.data.assets[0].assetId, "MEC-1");
  });

  // 20. Asset ID collision handled safely via bounded retry
  it("Case 20: Asset ID collision handled safely with bounded retry", async () => {
    global.__TEST_FORCE_ASSET_COLLISION__ = true;

    const payload = {
      name: "Collision Track",
      category: "Track",
      location: "Main Line KM 10",
    };

    const res = await apiCall("/api/assets", "POST", payload, adminUser);
    assert.equal(res.status, 201);
    assert.ok(res.data.asset.assetId);
  });

  // 21. Admin cross-department visibility across all asset departments
  it("Case 21: Admin has cross-department visibility across all departments", async () => {
    global.__TEST_ASSETS__["TRK-A"] = createMockAssetDoc({
      assetId: "TRK-A",
      department: "Engineering / Track",
      category: "Track",
    });
    global.__TEST_ASSETS__["ELE-A"] = createMockAssetDoc({
      assetId: "ELE-A",
      department: "Electrical / Traction",
      category: "Electrical & Power",
    });
    global.__TEST_ASSETS__["SIG-A"] = createMockAssetDoc({
      assetId: "SIG-A",
      department: "Signal & Telecom",
      category: "Signals & Communication",
    });
    global.__TEST_ASSETS__["MEC-A"] = createMockAssetDoc({
      assetId: "MEC-A",
      department: "Mechanical",
      category: "Mechanical",
    });
    global.__TEST_ASSETS__["BRG-A"] = createMockAssetDoc({
      assetId: "BRG-A",
      department: "Bridges",
      category: "Bridges",
    });

    const res = await apiCall("/api/assets", "GET", null, adminUser);
    assert.equal(res.status, 200);
    assert.equal(res.data.total, 5);
    const depts = res.data.assets.map((a) => a.department);
    assert.ok(depts.includes("Engineering / Track"));
    assert.ok(depts.includes("Electrical / Traction"));
    assert.ok(depts.includes("Signal & Telecom"));
    assert.ok(depts.includes("Mechanical"));
    assert.ok(depts.includes("Bridges"));
  });
});
