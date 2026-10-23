process.env.NODE_ENV = "test";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import notificationRoutes from "../routes/notifications.js";
import maintenanceRequestRoutes from "../routes/maintenanceRequests.js";
import assetRoutes from "../routes/assets.js";
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  checkAndGenerateOverdueNotifications,
} from "../services/notificationService.js";

describe("Notifications Backend API & Unit Tests", () => {
  let app;
  let server;
  let baseUrl;

  // Mock test users
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

  before(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/maintenance-requests", maintenanceRequestRoutes);
    app.use("/api/assets", assetRoutes);

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
    global.__TEST_NOTIFS__ = {};
    global.__TEST_DOCS__ = {};
    global.__TEST_ASSETS__ = {};
  });

  async function api(path, options = {}, user = null) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (user) {
      headers["x-test-user"] = JSON.stringify(user);
      headers["authorization"] = "Bearer mock-token";
    }
    const res = await fetch(`${baseUrl}/api${path}`, {
      ...options,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 1. Authentication and Authorization
  it("Case 1: Unauthenticated requests return 401, while passenger and unsupported roles are rejected with 403", async () => {
    const resNoAuth = await api("/notifications", { method: "GET" }, null);
    assert.equal(resNoAuth.status, 401);

    const resPass = await api("/notifications", { method: "GET" }, passengerUser);
    assert.equal(resPass.status, 403);
    assert.match(resPass.data.error, /passengers are not permitted/i);

    const resUnsupp = await api("/notifications", { method: "GET" }, unsupportedUser);
    assert.equal(resUnsupp.status, 403);
    assert.match(resUnsupp.data.error, /not authorized/i);
  });

  // 2. Department Scoping and Isolation
  it("Case 2: Department users are restricted strictly to their department and cannot view cross-department notifications", async () => {
    // Seed 1 Mechanical and 1 Engineering notification
    await createNotification({
      kind: "request-created",
      title: "Mechanical Check",
      desc: "Engine maintenance",
      department: "Mechanical",
      ref: { id: "MR-MEC", t: "request" },
    });
    await createNotification({
      kind: "request-created",
      title: "Track Inspection",
      desc: "Fastener inspection",
      department: "Engineering / Track",
      ref: { id: "MR-TRK", t: "request" },
    });

    // Mechanical user request without query param -> strictly scoped to Mechanical
    const resMech = await api("/notifications", { method: "GET" }, mechanicalUser);
    assert.equal(resMech.status, 200);
    assert.equal(resMech.data.notifications.length, 1);
    assert.equal(resMech.data.notifications[0].department, "Mechanical");
    assert.equal(resMech.data.unreadCount, 1);

    // Mechanical user attempting to view Engineering notifications explicitly -> 403
    const resCross = await api("/notifications?department=Engineering / Track", { method: "GET" }, mechanicalUser);
    assert.equal(resCross.status, 403);
    assert.match(resCross.data.error, /only authorized to view notifications for Mechanical/i);
  });

  // 3. Admin Cross-Department Access
  it("Case 3: Admin can view notifications across all departments or filter by a specific department", async () => {
    await createNotification({
      kind: "request-created",
      title: "Mechanical Task",
      department: "Mechanical",
      ref: { id: "MR-M1", t: "request" },
    });
    await createNotification({
      kind: "request-created",
      title: "Track Task",
      department: "Engineering / Track",
      ref: { id: "MR-T1", t: "request" },
    });

    // Admin view all
    const resAll = await api("/notifications", { method: "GET" }, adminUser);
    assert.equal(resAll.status, 200);
    assert.equal(resAll.data.notifications.length, 2);
    assert.equal(resAll.data.unreadCount, 2);

    // Admin view filtered by department
    const resFiltered = await api("/notifications?department=Mechanical", { method: "GET" }, adminUser);
    assert.equal(resFiltered.status, 200);
    assert.equal(resFiltered.data.notifications.length, 1);
    assert.equal(resFiltered.data.notifications[0].department, "Mechanical");

    // Invalid department filter rejected with 400
    const resInvalid = await api("/notifications?department=NonExistentDept", { method: "GET" }, adminUser);
    assert.equal(resInvalid.status, 400);
    assert.match(resInvalid.data.error, /invalid department filter/i);
  });

  // 4. Unread-Only Filtering & Unread Count Endpoint
  it("Case 4: Can filter notifications by unread status and retrieve quick unread count", async () => {
    const n1 = await createNotification({
      kind: "request-created",
      title: "Notif 1",
      department: "Mechanical",
      ref: { id: "MR-1", t: "request" },
    });
    const n2 = await createNotification({
      kind: "completed",
      title: "Notif 2",
      department: "Mechanical",
      ref: { id: "MR-2", t: "request" },
    });

    // Mark n1 as read
    global.__TEST_NOTIFS__[n1.id].read = true;

    // Retrieve unread only
    const resUnread = await api("/notifications?unreadOnly=true", { method: "GET" }, mechanicalUser);
    assert.equal(resUnread.status, 200);
    assert.equal(resUnread.data.notifications.length, 1);
    assert.equal(resUnread.data.notifications[0].id, n2.id);
    assert.equal(resUnread.data.unreadCount, 1);

    // Quick unread count endpoint
    const resCount = await api("/notifications/unread-count", { method: "GET" }, mechanicalUser);
    assert.equal(resCount.status, 200);
    assert.equal(resCount.data.unreadCount, 1);
  });

  // 5. Marking an Individual Notification as Read
  it("Case 5: Marking individual notification as read enforces department authorization", async () => {
    const notifMech = await createNotification({
      kind: "request-created",
      title: "Engine Service",
      department: "Mechanical",
      ref: { id: "MR-M3", t: "request" },
    });

    // Engineering user attempting to mark Mechanical notification as read -> 403
    const resForbidden = await api(`/notifications/${notifMech.id}/read`, { method: "PATCH" }, engineeringUser);
    assert.equal(resForbidden.status, 403);
    assert.match(resForbidden.data.error, /do not have permission/i);

    // Mechanical user marking own notification as read -> 200
    const resSuccess = await api(`/notifications/${notifMech.id}/read`, { method: "PATCH" }, mechanicalUser);
    assert.equal(resSuccess.status, 200);
    assert.equal(resSuccess.data.notification.read, true);
    assert.equal(global.__TEST_NOTIFS__[notifMech.id].read, true);

    // Non-existent notification -> 404
    const resNotFound = await api("/notifications/N99999999/read", { method: "PATCH" }, adminUser);
    assert.equal(resNotFound.status, 404);
  });

  // 6. Marking All Notifications as Read
  it("Case 6: Mark all notifications as read updates only within authorized department scope", async () => {
    await createNotification({
      kind: "request-created",
      title: "Mech 1",
      department: "Mechanical",
      ref: { id: "MR-1", t: "request" },
    });
    await createNotification({
      kind: "request-created",
      title: "Mech 2",
      department: "Mechanical",
      ref: { id: "MR-2", t: "request" },
    });
    const notifEng = await createNotification({
      kind: "request-created",
      title: "Eng 1",
      department: "Engineering / Track",
      ref: { id: "MR-3", t: "request" },
    });

    // Mechanical user marks all read -> marks only the 2 Mechanical notifications
    const resMech = await api("/notifications/mark-all-read", { method: "POST" }, mechanicalUser);
    assert.equal(resMech.status, 200);
    assert.equal(resMech.data.count, 2);

    // Engineering notification remains unread
    assert.equal(global.__TEST_NOTIFS__[notifEng.id].read, false);

    // Admin user marks all read -> marks the remaining Engineering notification
    const resAdmin = await api("/notifications/mark-all-read", { method: "POST" }, adminUser);
    assert.equal(resAdmin.status, 200);
    assert.equal(resAdmin.data.count, 1);
    assert.equal(global.__TEST_NOTIFS__[notifEng.id].read, true);
  });

  // 7. Event Trigger: Maintenance Request Creation creates Notification
  it("Case 7: Creating a maintenance request automatically creates an integrated notification", async () => {
    global.__TEST_ASSETS__["AST-101"] = {
      assetId: "AST-101",
      name: "Track North",
      category: "Track",
      department: "Engineering / Track",
      status: "Active",
      isDeleted: false,
    };

    const newReqPayload = {
      asset: "AST-101",
      dept: "Engineering / Track",
      type: "Joint Inspection",
      pri: "High",
      date: "2026-05-10",
      dur: 60,
      desc: "Routine inspection",
    };

    const res = await api("/maintenance-requests", {
      method: "POST",
      body: JSON.stringify(newReqPayload),
    }, engineeringUser);

    assert.equal(res.status, 201);
    const createdReqId = res.data.request.id;

    // Verify notification was created
    const notifs = Object.values(global.__TEST_NOTIFS__ || {});
    const match = notifs.find((n) => n.ref?.id === createdReqId);
    assert.ok(match, "Expected notification to be created for new request");
    assert.equal(match.kind, "request-created");
    assert.equal(match.department, "Engineering / Track");
    assert.match(match.title, new RegExp(createdReqId));
  });

  // 8. Event Trigger: Status Completion and Scheduling create Notifications
  it("Case 8: Completing a request or scheduling window automatically triggers notifications", async () => {
    global.__TEST_DOCS__["MR-2001"] = {
      id: "MR-2001",
      asset: "AST-101",
      dept: "Engineering / Track",
      status: "In Progress",
      date: "2026-04-10",
      dur: 60,
      createdBy: { uid: engineeringUser.firebaseUid, role: "engineering" },
      saveCallCount: 1,
      async save() {
        return this;
      },
    };

    // Complete request
    const resComplete = await api("/maintenance-requests/MR-2001/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "Completed", doneDate: "2026-04-10", actual: 55 }),
    }, engineeringUser);

    assert.equal(resComplete.status, 200);

    const notifs = Object.values(global.__TEST_NOTIFS__ || {});
    const completedNotif = notifs.find((n) => n.ref?.id === "MR-2001" && n.kind === "completed");
    assert.ok(completedNotif, "Expected completed notification to be generated");
    assert.equal(completedNotif.department, "Engineering / Track");

    // Schedule window (admin)
    global.__TEST_DOCS__["MR-2002"] = {
      id: "MR-2002",
      asset: "AST-101",
      dept: "Engineering / Track",
      status: "Scheduled",
      date: "2026-04-12",
      dur: 60,
      createdBy: { uid: adminUser.firebaseUid, role: "admin" },
      saveCallCount: 1,
      async save() {
        return this;
      },
    };

    const resSched = await api("/maintenance-requests/MR-2002/status", {
      method: "PATCH",
      body: JSON.stringify({ start: "14:30" }),
    }, adminUser);

    assert.equal(resSched.status, 200);
    const schedNotif = Object.values(global.__TEST_NOTIFS__ || {}).find(
      (n) => n.ref?.id === "MR-2002" && n.kind === "schedule-change"
    );
    assert.ok(schedNotif, "Expected schedule change notification to be generated");
  });

  // 9. Event Trigger: Critical Asset Risk alerts
  it("Case 9: Creating or updating an asset with critical risk (>= 80%) creates a critical risk notification", async () => {
    // Create asset with critical risk (85%)
    const assetPayload = {
      name: "Loco Traction Motor A",
      category: "Mechanical",
      location: "Maintenance Shed 4, Bay 2",
      condition: "Critical",
      risk: 85,
    };

    const res = await api("/assets", {
      method: "POST",
      body: JSON.stringify(assetPayload),
    }, mechanicalUser);

    assert.equal(res.status, 201);
    const createdAssetId = res.data.asset.assetId;

    const notifs = Object.values(global.__TEST_NOTIFS__ || {});
    const riskNotif = notifs.find((n) => n.ref?.id === createdAssetId && n.kind === "critical-risk");
    assert.ok(riskNotif, "Expected critical-risk notification to be created on asset creation");
    assert.equal(riskNotif.department, "Mechanical");

    // Also verify updating existing asset to critical risk creates a notification
    global.__TEST_ASSETS__["AST-MEC-LOW"] = {
      assetId: "AST-MEC-LOW",
      id: "AST-MEC-LOW",
      name: "Loco Motor B",
      category: "Mechanical",
      department: "Mechanical",
      condition: "Good",
      risk: 20,
      isDeleted: false,
      saveCallCount: 0,
      async save() {
        this.saveCallCount++;
        return this;
      },
    };

    const resUpdate = await api("/assets/AST-MEC-LOW", {
      method: "PATCH",
      body: JSON.stringify({ risk: 90 }),
    }, mechanicalUser);

    assert.equal(resUpdate.status, 200);
    const updatedNotifs = Object.values(global.__TEST_NOTIFS__ || {});
    const updateRiskNotif = updatedNotifs.find((n) => n.ref?.id === "AST-MEC-LOW" && n.kind === "critical-risk");
    assert.ok(updateRiskNotif, "Expected critical-risk notification to be created on asset update");
    assert.equal(updateRiskNotif.department, "Mechanical");
  });

  // 10. Event Trigger: Overdue tasks generate overdue notifications
  it("Case 10: Overdue tasks automatically generate overdue notifications without duplicates", async () => {
    global.__TEST_DOCS__["MR-OVER"] = {
      id: "MR-OVER",
      asset: "AST-101",
      dept: "Mechanical",
      status: "In Progress",
      date: "2020-01-01", // Long past => Overdue
    };

    const count1 = await checkAndGenerateOverdueNotifications("2026-04-23");
    assert.equal(count1, 1);

    const notifs = Object.values(global.__TEST_NOTIFS__ || {});
    const overdueNotif = notifs.find((n) => n.ref?.id === "MR-OVER" && n.kind === "overdue");
    assert.ok(overdueNotif);
    assert.equal(overdueNotif.department, "Mechanical");

    // Second check does not duplicate
    const count2 = await checkAndGenerateOverdueNotifications("2026-04-23");
    assert.equal(count2, 0);
  });
});
