import { TODAY, DEPTS, SHORT } from '../lib/constants';
import { fmtD } from '../lib/format';
import { pill } from '../lib/domain';
import { opts, stat, ic } from '../lib/dom';
import { barChart } from '../lib/charts';
import { fetchReportsData, isFetchingReports } from '../lib/api';

export const monthsBetween = (f, t) => {
  const o = [];
  let [y, m] = f.slice(0, 7).split('-').map(Number);
  const [ty, tmo] = t.slice(0, 7).split('-').map(Number);
  while ((y < ty || (y === ty && m <= tmo)) && o.length < 12) {
    o.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return o;
};

export function repRows(S) {
  const { from, to, dept } = S.ui.rp;
  return S.requests
    .filter((r) => {
      const d = r.doneDate || r.date;
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (dept && r.dept !== dept) return false;
      return r.status === 'Completed' || (r.date < TODAY);
    })
    .map((r) => ({
      id: r.id,
      asset: r.asset,
      dept: r.dept,
      date: r.status === 'Completed' ? (r.doneDate || r.date) : r.date,
      dur: r.status === 'Completed' ? (r.actual ?? r.dur) : r.dur,
      done: r.status === 'Completed',
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function render(ctx) {
  const S = ctx.state;
  const f = S.ui.rp;
  if (!S.rpData && !isFetchingReports) {
    fetchReportsData(ctx);
  }

  const rows = repRows(S);
  const doneRows = rows.filter((r) => r.done);
  const overRows = rows.filter((r) => !r.done);

  // Prefer real API overview if available, fallback to local dataset
  const completedCount = S.rpData?.overview?.completedRequests ?? doneRows.length;
  const overdueCount = S.rpData?.overview?.overdueRequests ?? overRows.length;
  const avgDurationStr = S.rpData?.overview?.avgActualDuration != null
    ? `${S.rpData.overview.avgActualDuration} min`
    : (doneRows.length ? `${Math.round(doneRows.reduce((s, r) => s + (r.dur || 0), 0) / doneRows.length)} min` : '—');

  // Trends data from real API
  const trendItems = S.rpData?.trends?.trends || [];
  const trLabels = trendItems.map((t) => t.monthLabel.split(' ')[0]);
  const trCompleted = trendItems.map((t) => t.completedRequests);
  const trOverdue = trendItems.map((t) => t.overdueRequests);

  // Department performance from real API
  const deptItems = S.rpData?.departments?.departments || DEPTS.map((d) => {
    const dd = rows.filter((r) => r.dept === d);
    const c = dd.filter((r) => r.done).length;
    return {
      department: d,
      totalRequests: dd.length,
      completedRequests: c,
      completionRate: dd.length ? Math.round((c / dd.length) * 100) : 0,
    };
  });

  return `<div class="ph-row">
        <h1>Reports &amp; Analytics</h1>
      </div>
      <div class="toolbar">
        <input type="date" id="rp-f" value="${f.from}" aria-label="From date">
        <input type="date" id="rp-t" value="${f.to}" aria-label="To date">
        <select id="rp-d" aria-label="Department">${opts(DEPTS, f.dept, 'All departments')}</select>
      </div>
      <div class="stats three">
        ${stat('Completed Tasks', completedCount)}
        ${stat('Average Completion Time', avgDurationStr)}
        ${stat('Overdue Tasks', overdueCount)}
      </div>
      ${(trendItems.length || rows.length) ? `<div class="cols even gap" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
        <section class="card">
          <h2>Maintenance Completion Trends</h2>
          ${trendItems.length ? barChart(trLabels, trCompleted) : '<div class="empty small">No completion data</div>'}
        </section>
        <section class="card">
          <h2>Overdue Work Trends</h2>
          ${trendItems.length ? barChart(trLabels, trOverdue) : '<div class="empty small">No overdue trends</div>'}
        </section>
        <section class="card">
          <h2>Department Performance</h2>
          <div class="hb">
            ${deptItems.map((d) => {
              const name = SHORT[d.department] || d.department;
              const rate = d.completionRate;
              const isZero = d.totalRequests === 0;
              return `<div class="r">
                <b>${name}</b>
                <span>${isZero ? 'No tasks' : `${rate}% (${d.completedRequests}/${d.totalRequests})`}</span>
                <div class="meter"><i style="width:${isZero ? 0 : rate}%"></i></div>
              </div>`;
            }).join('')}
          </div>
        </section>
      </div>` : `<div class="card gap empty">No records found for the selected range.</div>`}
      <section class="card flush gap">
        <div class="ph-row" style="padding:18px 20px 0">
          <h2 style="margin:0">Completed and Overdue Work</h2>
          <button class="btn sm" id="rp-csv">${ic('download', 16)}Export CSV</button>
        </div>
        <div class="tbl-wrap" style="margin-top:12px">
          <table style="min-width:680px">
            <thead><tr><th>Request ID</th><th>Asset</th><th>Department</th><th>Completion Date</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              ${rows.length ? rows.slice(0, 40).map((r) => `<tr>
                <td class="id">${r.id}</td>
                <td>${r.asset}</td>
                <td>${r.dept}</td>
                <td class="num">${r.done ? fmtD(r.date) : '—'}</td>
                <td class="num">${r.done ? (r.dur ? r.dur + ' min' : '—') : '—'}</td>
                <td>${pill(r.done ? 'Completed' : 'Overdue')}</td>
              </tr>`).join('') : `<tr><td colspan="6" class="empty">No work in this range.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
}

export function mount(ctx) {
  const { root, state: S, toast } = ctx;
  const $ = (s, r = root) => r.querySelector(s);

  const f = S.ui.rp;
  const rpf = $('#rp-f');
  if (rpf) {
    const updateFrom = (e) => {
      if (e.target.value && e.target.value !== f.from) {
        f.from = e.target.value;
        S.rpData = null;
        fetchReportsData(ctx);
      }
    };
    rpf.onchange = updateFrom;
    rpf.oninput = updateFrom;
  }
  const rpt = $('#rp-t');
  if (rpt) {
    const updateTo = (e) => {
      if (e.target.value && e.target.value !== f.to) {
        f.to = e.target.value;
        S.rpData = null;
        fetchReportsData(ctx);
      }
    };
    rpt.onchange = updateTo;
    rpt.oninput = updateTo;
  }
  const rpd = $('#rp-d');
  if (rpd) {
    rpd.onchange = (e) => {
      f.dept = e.target.value;
      S.rpData = null;
      fetchReportsData(ctx);
    };
  }
  const rpCsv = $('#rp-csv');
  if (rpCsv) {
    rpCsv.onclick = () => {
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [['Request ID', 'Asset', 'Department', 'Completion Date', 'Duration (min)', 'Status'].map(q).join(',')].concat(
        repRows(S).map((r) => [r.id, r.asset, r.dept, r.done ? fmtD(r.date) : '', r.done ? r.dur : '', r.done ? 'Completed' : 'Overdue'].map(q).join(','))
      ).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'railmaint-report.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('Report exported to CSV');
    };
  }
}
