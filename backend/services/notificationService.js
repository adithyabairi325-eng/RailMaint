import Notification, { ALLOWED_NOTIFICATION_KINDS } from "../models/Notification.js";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import { getTodayDateString } from "./reportService.js";

function isTestMockMode() {
  return process.env.NODE_ENV === "test" && process.env.IS_INTEGRATION_TEST !== "true";
}

/**
 * Generate a unique notification ID (e.g. N1714001234abcd)
 */
export function generateNotificationId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  return `N${ts}${rand}`;
}

/**
 * Format relative or short time string
 */
export function formatTimeAgo(dateObj) {
  if (!dateObj) return "Just now";
  const now = new Date();
  const diffSec = Math.floor((now - new Date(dateObj)) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Create a persistent notification in MongoDB Atlas (or test mock)
 */
export async function createNotification({
  kind = "request-created",
  title,
  desc = "",
  department,
  ref = { id: "", t: "request" },
}) {
  if (!title || !department) {
    throw new Error("Notification title and department are required.");
  }

  const id = generateNotificationId();
  const now = new Date();

  const doc = {
    id,
    kind,
    title: String(title).trim(),
    desc: String(desc || "").trim(),
    department: String(department).trim(),
    ref: {
      id: String(ref?.id || "").trim(),
      t: ref?.t === "asset" || ref?.t === "schedule" ? ref.t : "request",
    },
    read: false,
    time: "Just now",
    createdAt: now,
    updatedAt: now,
  };

  if (isTestMockMode()) {
    if (!global.__TEST_NOTIFS__) {
      global.__TEST_NOTIFS__ = {};
    }
    const mockDoc = {
      ...doc,
      async save() {
        if (global.__TEST_NOTIFS__) {
          global.__TEST_NOTIFS__[this.id] = this;
        }
        return this;
      },
    };
    global.__TEST_NOTIFS__[id] = mockDoc;
    return mockDoc;
  }

  const created = await Notification.create(doc);
  return created.toObject ? created.toObject() : created;
}

/**
 * Retrieve notifications filtered by department and read state
 */
export async function getNotifications({ department = null, unreadOnly = false, limit = 50 }) {
  if (isTestMockMode()) {
    const all = Object.values(global.__TEST_NOTIFS__ || {});
    let filtered = all.filter((n) => {
      if (department && n.department !== department) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const unreadCount = all.filter((n) => {
      if (department && n.department !== department) return false;
      return !n.read;
    }).length;

    return {
      notifications: filtered.slice(0, limit),
      unreadCount,
    };
  }

  const query = {};
  if (department) {
    query.department = department;
  }
  if (unreadOnly) {
    query.read = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Notification.countDocuments({
      ...(department ? { department } : {}),
      read: false,
    }),
  ]);

  const formatted = notifications.map((n) => ({
    ...n,
    time: formatTimeAgo(n.createdAt),
  }));

  return {
    notifications: formatted,
    unreadCount,
  };
}

/**
 * Retrieve quick unread count for user scope
 */
export async function getUnreadCount({ department = null }) {
  if (isTestMockMode()) {
    const all = Object.values(global.__TEST_NOTIFS__ || {});
    return all.filter((n) => {
      if (department && n.department !== department) return false;
      return !n.read;
    }).length;
  }

  const query = { read: false };
  if (department) {
    query.department = department;
  }
  return await Notification.countDocuments(query);
}

/**
 * Mark a specific notification as read with department authorization checks
 */
export async function markNotificationAsRead(id, { userDepartment = null, isAdmin = false }) {
  if (!id) {
    throw new Error("Notification ID is required.");
  }

  if (isTestMockMode()) {
    const notif = global.__TEST_NOTIFS__?.[id];
    if (!notif) {
      return { error: "Notification not found.", status: 404 };
    }
    if (!isAdmin && userDepartment && notif.department !== userDepartment) {
      return {
        error: `Access Denied: You do not have permission to mark notifications for ${notif.department}.`,
        status: 403,
      };
    }
    notif.read = true;
    notif.updatedAt = new Date();
    return { notification: notif };
  }

  const notif = await Notification.findOne({ id });
  if (!notif) {
    return { error: "Notification not found.", status: 404 };
  }

  if (!isAdmin && userDepartment && notif.department !== userDepartment) {
    return {
      error: `Access Denied: You do not have permission to mark notifications for ${notif.department}.`,
      status: 403,
    };
  }

  notif.read = true;
  await notif.save();
  return { notification: notif.toObject ? notif.toObject() : notif };
}

/**
 * Mark all notifications as read within user's department scope
 */
export async function markAllNotificationsAsRead({ userDepartment = null, isAdmin = false }) {
  if (!isAdmin && !userDepartment) {
    return { error: "Access Denied: Unauthorized department scope.", status: 403 };
  }

  if (isTestMockMode()) {
    const all = Object.values(global.__TEST_NOTIFS__ || {});
    let count = 0;
    all.forEach((n) => {
      if (!n.read && (isAdmin || !userDepartment || n.department === userDepartment)) {
        n.read = true;
        n.updatedAt = new Date();
        count++;
      }
    });
    return { count };
  }

  const query = { read: false };
  if (!isAdmin && userDepartment) {
    query.department = userDepartment;
  }

  const result = await Notification.updateMany(query, {
    $set: { read: true, updatedAt: new Date() },
  });

  return { count: result.modifiedCount || 0 };
}

/**
 * Check for overdue maintenance requests and generate notifications if not already notified
 */
export async function checkAndGenerateOverdueNotifications(todayStr = getTodayDateString()) {
  try {
    let overdueRequests = [];
    if (isTestMockMode()) {
      const all = Object.values(global.__TEST_DOCS__ || {});
      overdueRequests = all.filter((r) => r.status !== "Completed" && r.date && r.date < todayStr);
    } else {
      overdueRequests = await MaintenanceRequest.find({
        status: { $ne: "Completed" },
        date: { $lt: todayStr },
      }).lean();
    }

    let createdCount = 0;
    for (const req of overdueRequests) {
      // Check if overdue notification already exists for this request
      let exists = false;
      if (isTestMockMode()) {
        const notifs = Object.values(global.__TEST_NOTIFS__ || {});
        exists = notifs.some((n) => n.ref?.id === req.id && n.kind === "overdue");
      } else {
        exists = await Notification.exists({ "ref.id": req.id, kind: "overdue" });
      }

      if (!exists) {
        await createNotification({
          kind: "overdue",
          title: `Overdue Work: ${req.id}`,
          desc: `Task for ${req.asset} scheduled for ${req.date} is overdue.`,
          department: req.dept,
          ref: { id: req.id, t: "request" },
        });
        createdCount++;
      }
    }
    return createdCount;
  } catch (err) {
    console.warn("Overdue notifications check error:", err.message);
    return 0;
  }
}
