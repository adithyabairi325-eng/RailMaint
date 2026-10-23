import MaintenanceRequest, {
  ALLOWED_DEPARTMENTS,
  ALLOWED_STATUSES,
} from "../models/MaintenanceRequest.js";
import Asset, {
  ALLOWED_CATEGORIES,
  ALLOWED_CONDITIONS,
  ALLOWED_ASSET_STATUSES,
} from "../models/Asset.js";

/**
 * Format a Date object to YYYY-MM-DD in UTC
 */
export function getTodayDateString() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a YYYY-MM-DD date string
 */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const rY = dt.getUTCFullYear();
  const rM = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const rD = String(dt.getUTCDate()).padStart(2, "0");
  return `${rY}-${rM}-${rD}`;
}

/**
 * Generate monthly buckets between from and to (inclusive)
 * e.g. from="2026-01-01", to="2026-04-15" => ["2026-01", "2026-02", "2026-03", "2026-04"]
 */
export function generateMonthBuckets(fromDateStr, toDateStr) {
  const months = [];
  let [y, m] = fromDateStr.slice(0, 7).split("-").map(Number);
  const [endY, endM] = toDateStr.slice(0, 7).split("-").map(Number);

  while (y < endY || (y === endY && m <= endM)) {
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    months.push(monthKey);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    // Cap to 36 months to prevent infinite loop on bad input
    if (months.length > 36) break;
  }
  return months;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function getMonthLabel(monthKey) {
  const [yStr, mStr] = monthKey.split("-");
  const mIdx = parseInt(mStr, 10) - 1;
  const name = MONTH_NAMES[mIdx] || mStr;
  return `${name} ${yStr}`;
}

/**
 * Helper to fetch maintenance requests based on filters (handles test mock & real MongoDB)
 */
async function fetchMaintenanceRequests(filter = {}) {
  if (process.env.NODE_ENV === "test" && process.env.IS_INTEGRATION_TEST !== "true") {
    const all = Object.values(global.__TEST_DOCS__ || {});
    return all.filter((r) => {
      if (filter.dept && r.dept !== filter.dept) return false;
      if (filter.from && r.date < filter.from) return false;
      if (filter.to && r.date > filter.to) return false;
      return true;
    });
  }

  const query = {};
  if (filter.dept) {
    query.dept = filter.dept;
  }
  if (filter.from || filter.to) {
    query.date = {};
    if (filter.from) query.date.$gte = filter.from;
    if (filter.to) query.date.$lte = filter.to;
  }

  return await MaintenanceRequest.find(query).lean();
}

/**
 * Helper to fetch assets based on filters (handles test mock & real MongoDB)
 */
async function fetchAssets(filter = {}) {
  if (process.env.NODE_ENV === "test" && process.env.IS_INTEGRATION_TEST !== "true") {
    const all = Object.values(global.__TEST_ASSETS__ || {});
    return all.filter((a) => {
      if (filter.excludeDeleted && a.isDeleted) return false;
      if (filter.dept && a.department !== filter.dept) return false;
      return true;
    });
  }

  const query = {};
  if (filter.excludeDeleted) {
    query.isDeleted = { $ne: true };
  }
  if (filter.dept) {
    query.department = filter.dept;
  }

  return await Asset.find(query).lean();
}

/**
 * 1. Overview Report: Total requests, status breakdown, overdue requests,
 * completion rate, and average actual completion duration.
 */
export async function getOverviewReport({ from, to, department, todayStr = getTodayDateString() }) {
  const requests = await fetchMaintenanceRequests({ from, to, dept: department });

  const totalRequests = requests.length;

  // Initialize status breakdown for all allowed statuses
  const statusBreakdown = {};
  ALLOWED_STATUSES.forEach((s) => {
    statusBreakdown[s] = 0;
  });

  let completedCount = 0;
  let overdueCount = 0;
  let actualDurationSum = 0;
  let recordedActualCount = 0;
  let estimatedDurationSum = 0;

  for (const r of requests) {
    // Count status
    if (statusBreakdown[r.status] !== undefined) {
      statusBreakdown[r.status]++;
    } else {
      statusBreakdown[r.status] = 1;
    }

    if (r.status === "Completed") {
      completedCount++;
      // Average actual duration strictly uses actual field when recorded and > 0
      if (typeof r.actual === "number" && !isNaN(r.actual) && r.actual > 0) {
        actualDurationSum += r.actual;
        recordedActualCount++;
      }
    } else if (r.date && r.date < todayStr) {
      // Overdue: not completed and target date is in the past
      overdueCount++;
    }

    if (typeof r.dur === "number" && !isNaN(r.dur) && r.dur > 0) {
      estimatedDurationSum += r.dur;
    }
  }

  const completionRate =
    totalRequests > 0 ? Number(((completedCount / totalRequests) * 100).toFixed(1)) : 0;

  const avgActualDuration =
    recordedActualCount > 0 ? Number((actualDurationSum / recordedActualCount).toFixed(1)) : null;

  return {
    totalRequests,
    completedRequests: completedCount,
    overdueRequests: overdueCount,
    completionRate,
    statusBreakdown,
    avgActualDuration,
    recordedActualCount,
    totalEstimatedDuration: estimatedDurationSum,
    dateRange: {
      from: from || null,
      to: to || null,
    },
    department: department || null,
  };
}

/**
 * 2. Departments Report: Request counts, completion, overdue work and duration metrics
 * across departments.
 */
export async function getDepartmentsReport({ from, to, department, todayStr = getTodayDateString() }) {
  const requests = await fetchMaintenanceRequests({ from, to, dept: department });

  // Departments to report
  const targetDepts = department ? [department] : ALLOWED_DEPARTMENTS;

  const deptMap = {};
  targetDepts.forEach((d) => {
    deptMap[d] = {
      department: d,
      totalRequests: 0,
      completedRequests: 0,
      completionRate: 0,
      overdueRequests: 0,
      statusBreakdown: ALLOWED_STATUSES.reduce((acc, s) => {
        acc[s] = 0;
        return acc;
      }, {}),
      avgActualDuration: null,
      recordedActualCount: 0,
      totalActualDuration: 0,
      totalEstimatedDuration: 0,
    };
  });

  for (const r of requests) {
    const dObj = deptMap[r.dept];
    if (!dObj) continue;

    dObj.totalRequests++;
    if (dObj.statusBreakdown[r.status] !== undefined) {
      dObj.statusBreakdown[r.status]++;
    }

    if (r.status === "Completed") {
      dObj.completedRequests++;
      if (typeof r.actual === "number" && !isNaN(r.actual) && r.actual > 0) {
        dObj.totalActualDuration += r.actual;
        dObj.recordedActualCount++;
      }
    } else if (r.date && r.date < todayStr) {
      dObj.overdueRequests++;
    }

    if (typeof r.dur === "number" && !isNaN(r.dur) && r.dur > 0) {
      dObj.totalEstimatedDuration += r.dur;
    }
  }

  // Compute rates and averages
  const departments = targetDepts.map((d) => {
    const item = deptMap[d];
    item.completionRate =
      item.totalRequests > 0
        ? Number(((item.completedRequests / item.totalRequests) * 100).toFixed(1))
        : 0;
    item.avgActualDuration =
      item.recordedActualCount > 0
        ? Number((item.totalActualDuration / item.recordedActualCount).toFixed(1))
        : null;
    return item;
  });

  // Calculate summary across reported departments
  const summaryTotal = departments.reduce((acc, d) => acc + d.totalRequests, 0);
  const summaryCompleted = departments.reduce((acc, d) => acc + d.completedRequests, 0);
  const summaryOverdue = departments.reduce((acc, d) => acc + d.overdueRequests, 0);
  const summaryRecordedActualCount = departments.reduce((acc, d) => acc + d.recordedActualCount, 0);
  const summaryActualDurationSum = departments.reduce((acc, d) => acc + d.totalActualDuration, 0);

  const summary = {
    totalRequests: summaryTotal,
    completedRequests: summaryCompleted,
    overdueRequests: summaryOverdue,
    completionRate:
      summaryTotal > 0 ? Number(((summaryCompleted / summaryTotal) * 100).toFixed(1)) : 0,
    avgActualDuration:
      summaryRecordedActualCount > 0
        ? Number((summaryActualDurationSum / summaryRecordedActualCount).toFixed(1))
        : null,
    recordedActualCount: summaryRecordedActualCount,
  };

  return {
    departments,
    summary,
    dateRange: {
      from: from || null,
      to: to || null,
    },
    departmentFilter: department || null,
  };
}

/**
 * 3. Trends Report: Date-range-based maintenance trends (grouped by month).
 */
export async function getTrendsReport({ from, to, department, todayStr = getTodayDateString() }) {
  // If dates are not provided, default to a 6-month window ending in the current month
  let effectiveFrom = from;
  let effectiveTo = to;

  if (!effectiveTo) {
    effectiveTo = todayStr;
  }
  if (!effectiveFrom) {
    // 6 months window
    const [tY, tM] = effectiveTo.split("-").map(Number);
    let startY = tY;
    let startM = tM - 5;
    if (startM < 1) {
      startM += 12;
      startY -= 1;
    }
    effectiveFrom = `${startY}-${String(startM).padStart(2, "0")}-01`;
  }

  const requests = await fetchMaintenanceRequests({
    from: effectiveFrom,
    to: effectiveTo,
    dept: department,
  });

  const monthKeys = generateMonthBuckets(effectiveFrom, effectiveTo);

  const monthMap = {};
  monthKeys.forEach((m) => {
    monthMap[m] = {
      month: m,
      monthLabel: getMonthLabel(m),
      totalRequests: 0,
      completedRequests: 0,
      overdueRequests: 0,
      inProgressRequests: 0,
      pendingRequests: 0,
      avgActualDuration: null,
      _actualSum: 0,
      _recordedActualCount: 0,
    };
  });

  for (const r of requests) {
    if (!r.date) continue;
    const m = r.date.slice(0, 7);
    if (!monthMap[m]) continue;

    monthMap[m].totalRequests++;

    if (r.status === "Completed") {
      monthMap[m].completedRequests++;
      if (typeof r.actual === "number" && !isNaN(r.actual) && r.actual > 0) {
        monthMap[m]._actualSum += r.actual;
        monthMap[m]._recordedActualCount++;
      }
    } else {
      if (r.status === "In Progress") {
        monthMap[m].inProgressRequests++;
      } else if (r.status === "Pending") {
        monthMap[m].pendingRequests++;
      }
      if (r.date < todayStr) {
        monthMap[m].overdueRequests++;
      }
    }
  }

  const trends = monthKeys.map((m) => {
    const item = monthMap[m];
    const avg =
      item._recordedActualCount > 0
        ? Number((item._actualSum / item._recordedActualCount).toFixed(1))
        : null;
    return {
      month: item.month,
      monthLabel: item.monthLabel,
      totalRequests: item.totalRequests,
      completedRequests: item.completedRequests,
      overdueRequests: item.overdueRequests,
      inProgressRequests: item.inProgressRequests,
      pendingRequests: item.pendingRequests,
      avgActualDuration: avg,
    };
  });

  return {
    trends,
    dateRange: {
      from: effectiveFrom,
      to: effectiveTo,
    },
    department: department || null,
  };
}

/**
 * 4. Assets Analysis Report: Category, condition, status, risk, and inspection-date analysis
 * using fields that actually exist in the schema.
 */
export async function getAssetsReport({ department, todayStr = getTodayDateString() }) {
  const assets = await fetchAssets({ dept: department, excludeDeleted: true });

  const totalAssets = assets.length;

  // Breakdown by category
  const categoryMap = {};
  ALLOWED_CATEGORIES.forEach((c) => {
    categoryMap[c] = { category: c, count: 0, riskSum: 0 };
  });

  // Breakdown by condition
  const conditionMap = {};
  ALLOWED_CONDITIONS.forEach((c) => {
    conditionMap[c] = { condition: c, count: 0 };
  });

  // Breakdown by status
  const statusMap = {};
  ALLOWED_ASSET_STATUSES.forEach((s) => {
    statusMap[s] = { status: s, count: 0 };
  });

  let totalRiskSum = 0;
  let highRiskCount = 0; // >= 70
  let mediumRiskCount = 0; // 40 - 69
  let lowRiskCount = 0; // < 40

  let overdueInspectionCount = 0;
  let upcomingInspectionCount = 0; // next 30 days
  let uninspectedCount = 0;

  const in30DaysStr = addDays(todayStr, 30);

  for (const a of assets) {
    // Category
    if (categoryMap[a.category]) {
      categoryMap[a.category].count++;
      categoryMap[a.category].riskSum += Number(a.risk) || 0;
    }

    // Condition
    if (conditionMap[a.condition]) {
      conditionMap[a.condition].count++;
    }

    // Status
    if (statusMap[a.status]) {
      statusMap[a.status].count++;
    }

    // Risk
    const rScore = Number(a.risk) || 0;
    totalRiskSum += rScore;
    if (rScore >= 70) {
      highRiskCount++;
    } else if (rScore >= 40) {
      mediumRiskCount++;
    } else {
      lowRiskCount++;
    }

    // Inspections
    if (!a.lastInspectionDate) {
      uninspectedCount++;
    }
    if (a.nextInspectionDate) {
      if (a.nextInspectionDate < todayStr) {
        overdueInspectionCount++;
      } else if (a.nextInspectionDate <= in30DaysStr) {
        upcomingInspectionCount++;
      }
    }
  }

  const byCategory = ALLOWED_CATEGORIES.map((cat) => {
    const item = categoryMap[cat];
    return {
      category: item.category,
      count: item.count,
      avgRisk: item.count > 0 ? Number((item.riskSum / item.count).toFixed(1)) : 0,
    };
  });

  const byCondition = ALLOWED_CONDITIONS.map((c) => ({
    condition: c,
    count: conditionMap[c]?.count || 0,
  }));

  const byStatus = ALLOWED_ASSET_STATUSES.map((s) => ({
    status: s,
    count: statusMap[s]?.count || 0,
  }));

  const avgRisk = totalAssets > 0 ? Number((totalRiskSum / totalAssets).toFixed(1)) : 0;

  return {
    totalAssets,
    byCategory,
    byCondition,
    byStatus,
    riskOverview: {
      avgRisk,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    },
    inspections: {
      overdueCount: overdueInspectionCount,
      upcomingCount: upcomingInspectionCount,
      uninspectedCount,
    },
    department: department || null,
  };
}
