import React, { useEffect, useRef } from 'react';
import './AdminDashboard.css';
import { auth } from '../../firebase/firebaseConfig';
import {
  getToday,
  TODAY,
  DEPTS,
  CATS,
  CAT_DEPT,
  SHORT,
  PREFIX,
  WORK,
  PRI,
  RANK,
  MON,
  DEPT_TAG_CLASS,
  STORAGE_KEY,
  NAV,
} from './lib/constants';
import {
  fmtD,
  dm,
  tm,
  mt,
  to12,
  mt12,
  timeRange12,
  fmtDur,
  addDays,
  daysBetween,
  hash,
  clamp,
  esc,
} from './lib/format';
import {
  initDom,
  $,
  ic,
  dl,
  opts,
  fld,
  kpi,
  stat,
  toast,
  openPanel,
  openModal,
  closeLayers,
} from './lib/dom';
import {
  riskClass,
  cond,
  TONE,
  pill,
  GCOL,
  daysSince,
  prob,
  compat,
  sched,
  endOf,
  overlap,
  isDelayedTask,
  getRequestStatus,
  conflictPairs,
  blocksOf,
  assess,
  series,
  whatIfCalc as domainWhatIfCalc,
} from './lib/domain';
import {
  initCharts,
  gauge,
  animGauge,
  factorsHTML,
  lineChart,
  barChart,
} from './lib/charts';
import {
  DEFAULT_ASSETS,
  createInitialState,
  persist as persistStore,
  seed as seedStore,
  assetById as assetByIdStore,
  reqById as reqByIdStore,
  reportRows as reportRowsStore,
} from './lib/store';
import {
  fetchReportsData as fetchReportsDataApi,
  isFetchingReports,
  syncMaintenanceRequests,
  syncAssets,
  syncNotifications as syncNotificationsApi,
} from './lib/api';
import { pageModules } from './pages';

export default function AdminDashboard({ onLogout, user }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    initDom(root);
    initCharts(root);

    /* ---------- constants ---------- */

    /* ---------- helpers ---------- */

    /* ---------- domain rules (Single Location) ---------- */

    /* ---------- persistent JS data store (NO Location, Clean User Data) ---------- */
    const S = createInitialState();
    const persist = () => persistStore(S);
    const assetById = (id) => assetByIdStore(S, id);
    const reqById = (id) => reqByIdStore(S, id);
    const reportRows = () => reportRowsStore(S);

    function seed() {
      seedStore(S, persist);
      syncMaintenanceRequests({ auth, state: S, persist, render });
      syncAssets({ auth, state: S, persist, render, constants: { TODAY } });
      syncNotificationsApi({ auth, state: S, persist, render, helpers: { updateBell, getCurrentRoute: () => currentRoute } });
    }

    /* ---------- UI helpers ---------- */
    const V = $('#view');

    function addNotif(kind, title, desc, ref) {
      S.notifs.unshift({ id: 'N' + Date.now() + Math.random().toString(36).slice(2, 5), kind, title, desc, time: 'Just now', ref, read: false });
      persist();
      updateBell();
    }
    function updateBell() {
      const n = S.notifs.filter((x) => !x.read).length;
      const b = $('#bell');
      if (b) {
        b.setAttribute('aria-label', `Notifications, ${n} unread`);
        b.innerHTML = ic('bell') + (n ? `<span class="badge">${n}</span>` : '');
      }
      const navNf = root.querySelector('#nav a[data-k="notifications"] .lbl');
      if (navNf) {
        navNf.innerHTML = `Notifications${n ? ` <span style="display:inline-block;padding:1px 6px;font-size:11px;font-weight:800;border-radius:10px;background:var(--orange);color:#fff;margin-left:6px">${n}</span>` : ''}`;
      }
    }
    function sevIcon(kind) {
      const m = { 'critical-risk': ['alert', 'crit'], predicted: ['trend', 'high'], overdue: ['clock', 'high'], conflict: ['alert', 'med'], delayed: ['clock', 'med'], completed: ['check', 'low'] }[kind];
      return `<span class="sev ${m[1]}">${ic(m[0], 18)}</span>`;
    }
    function openRef(ref) {
      ref.t === 'request' ? openRequest(ref.id) : openAsset(ref.id);
    }

    function openRequest(id) {
      const r = reqById(id), a = assetById(r.asset);
      openPanel(
        r.id,
        dl([
          ['Asset', r.asset],
          ['Department', r.dept],
          ['Work type', esc(r.type)],
          ['Priority', pill(r.pri)],
          ['Date', fmtD(r.date)],
          ['Time', r.start ? `${timeRange12(r.start, r.dur)}` : 'Not scheduled yet'],
          ['Duration', fmtDur(r.dur)],
          ['Status', pill(getRequestStatus(r))],
          ['Asset risk', a ? a.risk + '%' : '—'],
          ...(r.status === 'Completed' ? [['Completed on', fmtD(r.doneDate || r.date)], ['Actual duration', (r.actual || r.dur) + ' min']] : []),
        ]) +
        `<h3>Description</h3><p>${esc(r.desc)}</p>` +
        (r.note ? `<h3>Completion note</h3><p>${esc(r.note)}</p>` : '') +
        `<div class="btn-row gap" style="margin-top:22px">
          ${r.status === 'Completed' ? '' : `<button class="btn primary" data-complete="${r.id}">Mark as Done</button>`}
          <button class="btn" data-open-asset="${r.asset}">View asset</button>
          <button class="btn danger-soft" data-delete-req="${r.id || r._id}">${ic('trash', 16)} Delete</button>
        </div>`
      );
    }

    async function markCompleted(r, doneDate = TODAY, actual = null, note = '') {
      if (!r) return;
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (token) {
          const res = await fetch(`/api/maintenance-requests/${r.id}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              status: 'Completed',
              doneDate: doneDate || TODAY,
              actual: actual ?? r.dur,
              note: note || '',
            }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error || `HTTP ${res.status}`);
          }
        }

        const a = assetById(r.asset);
        r.status = 'Completed';
        r.doneDate = doneDate || TODAY;
        r.actual = actual ?? r.dur;
        if (note) r.note = note;
        if (a) {
          a.last = r.doneDate;
          a.risk = Math.max(5, a.risk - 25);
        }
        addNotif('completed', `${r.id} completed`, `${r.type} on ${r.asset} finished.`, { t: 'request', id: r.id });
        persist();
        toast(`${r.id} completed and recorded in MongoDB.`);
        render(true);

        const modal = $('#modal');
        if (modal && $('#ml')?.classList.contains('open') && modal.querySelector('#sch-date-input')) {
          modal.innerHTML = buildScheduleHTML(currentSchDate, currentSchDept);
          wireScheduleEvents(modal);
        }
      } catch (err) {
        console.error('Failed to update status in MongoDB Atlas:', err);
        toast(`Error updating status: ${err.message}`);
      }
    }

    function openComplete(id) {
      const r = reqById(id);
      if (!r) return;
      openModal(
        `Mark ${r.id} as Completed`,
        `<form class="form" id="cf"><p class="muted">${esc(r.type)} on ${r.asset}</p>
          <div class="form-2">
            ${fld('Completion date', `<input type="date" id="cf-d" value="${TODAY}" required>`)}
            ${fld('Actual duration (minutes)', `<input type="number" id="cf-t" min="5" step="5" value="${r.dur}" required>`)}
          </div>
          ${fld('Work note (optional)', `<textarea id="cf-n" placeholder="What was done?"></textarea>`)}
          <div class="btn-row stretch" style="justify-content:flex-end">
            <button class="btn" type="button" data-close>Cancel</button>
            <button class="btn primary" type="submit">Confirm Completed</button>
          </div>
        </form>`
      );
      $('#cf').onsubmit = (e) => {
        e.preventDefault();
        closeLayers();
        markCompleted(r, $('#cf-d').value, +$('#cf-t').value, $('#cf-n').value.trim());
      };
    }

    function openAsset(id) {
      const a = assetById(id), c = cond(a.risk);
      const hist = reportRows().filter((x) => x.asset === id && x.done).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 4);
      const rel = S.requests.filter((r) => r.asset === id && r.status !== 'Completed');
      openPanel(
        a.id,
        `<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
          <span class="hero-num">${a.risk}%</span>
          <div>${pill(c)}<div class="muted small">Risk score</div></div>
        </div>` +
        dl([
          ['Asset type', a.type],
          ['Age', a.age + ' years'],
          ['Last maintenance', fmtD(a.last)],
        ]) +
        `<h3>Maintenance history</h3>` +
        (hist.length ? `<ul class="list">${hist.map((h) => `<li><span>${esc(h.type)}</span><span class="muted small">${fmtD(h.date)}, ${h.dur} min</span></li>`).join('')}</ul>` : '<p class="muted">No completed maintenance recorded.</p>') +
        `<h3>Related requests</h3>` +
        (rel.length ? `<ul class="list">${rel.map((r) => `<li class="click" data-open-req="${r.id}"><span><b>${r.id}</b> ${esc(r.type)}</span>${pill(r.status)}</li>`).join('')}</ul>` : '<p class="muted">No open requests.</p>') +
        `<div class="btn-row gap" style="margin-top:22px">
          <button class="btn danger-soft" data-delete-asset="${a.id || a.assetId || a._id}">${ic('trash', 16)} Delete Asset</button>
        </div>`
      );
    }

    function confirmDelete(title, message, onConfirm) {
      openModal(
        title,
        `<div style="display:grid;gap:16px;padding:6px 0">
          <p style="font-size:15px;color:var(--text);margin:0;line-height:1.5">${esc(message)}</p>
          <div class="btn-row" style="justify-content:flex-end;gap:10px;margin-top:14px">
            <button class="btn" type="button" id="cd-cancel">Cancel</button>
            <button class="btn danger" type="button" id="cd-confirm">Delete</button>
          </div>
        </div>`
      );
      $('#cd-cancel').onclick = closeLayers;
      $('#cd-confirm').onclick = () => {
        closeLayers();
        onConfirm();
      };
    }

    function deleteAsset(id) {
      if (!id) return;
      const a = assetById(id);
      const label = a ? `${a.id || a.assetId} (${a.type || a.category || 'Asset'})` : id;

      confirmDelete('Delete Asset', `Are you sure you want to delete asset ${label}? This action cannot be undone.`, async () => {
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (token) {
            const res = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok && res.status !== 404) {
              const errData = await res.json().catch(() => ({}));
              console.warn('Backend delete asset notice:', errData?.error);
            }
          }
        } catch (err) {
          console.warn('Backend delete asset notice:', err.message);
        }

        S.assets = S.assets.filter((item) => (item.id || item.assetId) !== id && item.assetId !== id && item.id !== id && String(item._id) !== id);
        persist();
        closeLayers();
        toast(`Asset ${id} deleted.`);
        render(true);
      });
    }

    function deleteRequest(id) {
      if (!id) return;
      const r = reqById(id);
      const label = r ? `${r.id} (${r.type || 'Request'} on ${r.asset || 'Asset'})` : id;

      confirmDelete('Delete Maintenance Request', `Are you sure you want to delete maintenance request ${label}? This action cannot be undone.`, async () => {
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (token) {
            const res = await fetch(`/api/maintenance-requests/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok && res.status !== 404) {
              const errData = await res.json().catch(() => ({}));
              console.warn('Backend delete request notice:', errData?.error);
            }
          }
        } catch (err) {
          console.warn('Backend delete request notice:', err.message);
        }

        S.requests = S.requests.filter((item) => item.id !== id && String(item._id) !== id);
        persist();
        closeLayers();
        toast(`Request ${id} deleted.`);
        render(true);
      });
    }

    /* block optimization */
    function optimize() {
      const before = conflictPairs(S.requests).length;
      let changed = 0;
      const groups = {};
      S.requests.filter((r) => r.status !== 'Completed').forEach((r) => {
        if (r.status === 'Delayed' && r.date < TODAY) r.date = TODAY;
        (groups[r.date] ??= []).push(r);
      });
      Object.values(groups).forEach((g) => {
        const placed = g.filter((r) => r.status === 'In Progress');
        g.filter((r) => r.status !== 'In Progress')
          .sort((a, b) => RANK[b.pri] - RANK[a.pri] || b.dur - a.dur)
          .forEach((r) => {
            const cand = [...new Set([540, ...placed.map(endOf)])].sort((a, b) => a - b);
            const ok = (s) => placed.every((p) => compat(p.dept, r.dept) || !(s < endOf(p) && tm(p.start) < s + r.dur));
            const s = cand.find(ok) ?? Math.max(...placed.map(endOf), 540);
            const ns = mt(s);
            if (r.start !== ns || r.status !== 'Scheduled') changed++;
            r.start = ns;
            r.status = 'Scheduled';
            placed.push(r);
          });
      });
      const after = conflictPairs(S.requests).length;
      const shared = blocksOf(S.requests).filter((b) => {
        const d = new Set(b.tasks.map((t) => t.dept));
        return d.size > 1 && b.tasks.some((t, i) => b.tasks.some((u, j) => i < j && overlap(t, u)));
      }).length;
      persist();
      toast(`Optimized: ${changed} tasks scheduled, ${shared} shared blocks, ${before - after} conflicts resolved.`);
    }

    const ctx = {
      root,
      state: S,
      persist,
      render: (p) => render(p),
      toast,
      openModal,
      openPanel,
      closeLayers,
      auth,
      constants: {
        TODAY,
        DEPTS,
        CATS,
        CAT_DEPT,
        SHORT,
        PREFIX,
        WORK,
        PRI,
        RANK,
        MON,
        DEPT_TAG_CLASS,
        STORAGE_KEY,
        NAV,
      },
      helpers: {
        assetById,
        reqById,
        reportRows,
        updateBell,
        openRef,
        optimize,
        buildScheduleHTML,
        wireScheduleEvents,
        openSchedule,
        openRequest,
        openNewRequest,
        openComplete,
        openAsset,
        confirmDelete,
        markCompleted,
        deleteRequest,
        deleteAsset,
        addNotif,
      },
      modals: {
        openRequest,
        openNewRequest,
        openComplete,
        openSchedule,
        openAsset,
        confirmDelete,
        markCompleted,
        deleteRequest,
        deleteAsset,
      },
    };

    /* ---------- pages ---------- */
    const pages = {};
    const mounts = {};
    for (const [k, mod] of Object.entries(pageModules)) {
      pages[k] = () => mod.render(ctx);
      mounts[k] = () => mod.mount(ctx);
    }

    function runOptimize() {
      const todo = S.requests.filter((r) => r.status === 'Pending' || r.status === 'Delayed').length, cf = conflictPairs(S.requests).length;
      if (!todo && !cf) {
        toast('The schedule is already optimized.');
        return;
      }
      optimize();
      render(true);
      openSchedule();
    }

    let currentSchDate = null;
    let currentSchDept = '';

    function buildScheduleHTML(activeDate, activeDept) {
      const R = S.requests;
      const sc = R.filter((r) => r.start).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '').localeCompare(b.start || ''));
      const wait = R.filter((r) => !r.start && r.status !== 'Completed').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const cf = conflictPairs(S.requests);
      const cids = new Set(cf.flat().map((r) => r.id));

      let targetDate = (typeof activeDate === 'string' && activeDate) ? activeDate : currentSchDate;
      if (!targetDate || typeof targetDate !== 'string') {
        const scDays = [...new Set(sc.map((r) => r.date).filter(Boolean))].sort();
        const allReqDays = [...new Set(S.requests.map((r) => r.date).filter(Boolean))].sort();
        if (scDays.includes(TODAY)) targetDate = TODAY;
        else if (scDays.length) targetDate = scDays[0];
        else if (allReqDays.includes(TODAY)) targetDate = TODAY;
        else if (allReqDays.length) targetDate = allReqDays[0];
        else targetDate = TODAY;
      }
      currentSchDate = targetDate;

      const dateFiltered = sc.filter((r) => r.date === targetDate && (!activeDept || r.dept === activeDept));
      const waitFiltered = wait.filter((r) => (!activeDept || r.dept === activeDept));
      const conflictsCount = cf.filter(([a, b]) => a.date === targetDate || b.date === targetDate).length;
      const scheduledCount = dateFiltered.filter((r) => getRequestStatus(r) === 'Scheduled').length;
      const inProgCount = dateFiltered.filter((r) => getRequestStatus(r) === 'In Progress').length;
      const doneCount = dateFiltered.filter((r) => getRequestStatus(r) === 'Completed').length;
      const delayedCount = dateFiltered.filter((r) => getRequestStatus(r) === 'Delayed').length;

      /* tasks table rows */
      const taskRows = dateFiltered.length
        ? dateFiltered.map((r) => {
            const st = getRequestStatus(r);

            let statusHTML = '';
            if (st === 'Completed') {
              statusHTML = '<span class="pill low">Completed</span>';
            } else if (st === 'Delayed') {
              statusHTML = '<span class="pill crit">Delayed</span>';
            } else if (st === 'In Progress') {
              statusHTML = '<span class="pill orange">In Progress</span>';
            } else {
              statusHTML = '<span class="pill info">Scheduled</span>';
            }

            return `
              <tr class="clickable" data-open-req="${r.id}">
                <td class="sch-time-cell">
                  <b>${timeRange12(r.start, r.dur)}</b>
                  <span>⏱ ${fmtDur(r.dur)}</span>
                </td>
                <td>
                  <div class="sch-task-title">${esc(r.type)}</div>
                  <div class="sch-task-sub">
                    <span class="id">${r.id}</span>
                    <span>•</span>
                    <span>Asset: <strong>${r.asset}</strong></span>
                  </div>
                </td>
                <td><span class="sch-dept-tag ${DEPT_TAG_CLASS[r.dept] || ''}">${SHORT[r.dept] || r.dept}</span></td>
                <td>${pill(r.pri)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    ${statusHTML}
                    ${cids.has(r.id) ? '<span class="pill crit" title="Conflict">⚠</span>' : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="5" class="empty">No tasks scheduled for ${fmtD(targetDate)}.</td></tr>`;

      /* waiting section */
      const waitHTML = waitFiltered.length ? `
        <div class="sch-waiting-section" style="margin-top:20px">
          <h3 style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span>Tasks Waiting to be Scheduled (${waitFiltered.length})</span>
            <button class="btn sm primary" id="sch-wait-opt">Optimize All to Schedule</button>
          </h3>
          <div class="tbl-wrap">
            <table class="sch-tasks-table">
              <thead>
                <tr><th>ID</th><th>Task</th><th>Department</th><th>Asset</th><th>Duration</th><th>Target Date</th><th>Priority</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${waitFiltered.map((r) => `
                  <tr class="clickable" data-open-req="${r.id}">
                    <td class="id">${r.id}</td>
                    <td><strong>${esc(r.type)}</strong></td>
                    <td><span class="sch-dept-tag ${DEPT_TAG_CLASS[r.dept] || ''}">${SHORT[r.dept] || r.dept}</span></td>
                    <td>${r.asset}</td>
                    <td>${fmtDur(r.dur)}</td>
                    <td>${fmtD(r.date)}</td>
                    <td>${pill(r.pri)}</td>
                    <td>${pill(r.status)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : '';

      const emptyHTML = !dateFiltered.length && !waitFiltered.length ? `
        <div class="sch-empty-box" style="margin-top:12px">
          ${ic('clock', 36)}
          <h3>No Tasks for ${fmtD(targetDate)}</h3>
          <p>Create a maintenance request then run Optimization to schedule it.</p>
          <div class="btn-row" style="justify-content:center;margin-top:12px">
            <button class="btn primary" id="sch-quick-new">+ Create Request</button>
            <button class="btn" id="sch-quick-opt">Run Optimization</button>
          </div>
        </div>` : '';

      return `
        <div class="sch-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <label style="font-weight:800;font-size:13px;color:var(--muted);white-space:nowrap">Select Date:</label>
            <input type="date" id="sch-date-input" value="${targetDate}" style="min-height:38px;padding:4px 12px;font-size:13px;width:auto;min-width:160px">
            <select id="sch-dept-filter" aria-label="Department Filter" style="min-height:38px;padding:4px 12px;font-size:13px;width:auto">
              ${opts(DEPTS, activeDept, 'All Departments')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px">
              <span style="font-size:12px;font-weight:800;color:var(--muted)">SCHEDULED</span>
              <b style="font-size:18px;font-weight:800">${scheduledCount}</b>
            </div>
            ${inProgCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--orange)">IN PROGRESS</span><b style="font-size:18px;font-weight:800;color:var(--orange)">${inProgCount}</b></div>` : ''}
            ${doneCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--low)">COMPLETED</span><b style="font-size:18px;font-weight:800;color:var(--low)">${doneCount}</b></div>` : ''}
            ${delayedCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--crit)">DELAYED</span><b style="font-size:18px;font-weight:800;color:var(--crit)">${delayedCount}</b></div>` : ''}
            ${conflictsCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--crit)">CONFLICTS</span><b style="font-size:18px;font-weight:800;color:var(--crit)">${conflictsCount}</b></div>` : ''}
          </div>
        </div>

        ${dateFiltered.length ? `
        <div class="sch-block-card" style="margin-bottom:18px">
          <div class="tbl-wrap">
            <table class="sch-tasks-table">
              <thead>
                <tr>
                  <th style="width:200px">Time Slot (AM/PM)</th>
                  <th>Task & Asset</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th style="width:140px">Status</th>
                </tr>
              </thead>
              <tbody>${taskRows}</tbody>
            </table>
          </div>
        </div>` : emptyHTML}

        ${waitHTML}

        <div class="btn-row" style="justify-content:space-between;margin-top:18px;border-top:1px solid var(--line2);padding-top:14px">
          <div class="btn-row">
            <button class="btn primary" id="sch-btn-opt">Optimize Schedule</button>
            <button class="btn" id="sch-btn-timeline">Open Timeline View</button>
          </div>
          <button class="btn" type="button" data-close>Close</button>
        </div>
      `;
    }

    function wireScheduleEvents(container) {
      const dateInp = container.querySelector('#sch-date-input');
      if (dateInp) {
        const handleDate = (e) => {
          if (e.target.value && e.target.value !== currentSchDate) {
            openSchedule(e.target.value, currentSchDept);
          }
        };
        dateInp.onchange = handleDate;
        dateInp.oninput = handleDate;
      }
      const deptSel = container.querySelector('#sch-dept-filter');
      if (deptSel) {
        deptSel.onchange = (e) => openSchedule(currentSchDate, e.target.value);
      }

      const optBtn = container.querySelector('#sch-btn-opt');
      if (optBtn) {
        optBtn.onclick = () => { runOptimize(); render(true); openSchedule(currentSchDate, currentSchDept); };
      }
      const quickOpt = container.querySelector('#sch-quick-opt');
      if (quickOpt) {
        quickOpt.onclick = () => { runOptimize(); render(true); openSchedule(currentSchDate, currentSchDept); };
      }
      const waitOpt = container.querySelector('#sch-wait-opt');
      if (waitOpt) {
        waitOpt.onclick = () => { runOptimize(); render(true); openSchedule(currentSchDate, currentSchDept); };
      }
      const quickNew = container.querySelector('#sch-quick-new');
      if (quickNew) {
        quickNew.onclick = () => { closeLayers(); openNewRequest(); };
      }
      const tlBtn = container.querySelector('#sch-btn-timeline');
      if (tlBtn) {
        tlBtn.onclick = () => {
          closeLayers();
          S.ui.bd = currentSchDate || TODAY;
          window.location.hash = '#blocks';
        };
      }
      container.querySelectorAll('tr[data-open-req]').forEach((tr) => {
        tr.onclick = (e) => {
          if (e.target.closest('select') || e.target.closest('button')) return;
          openRequest(tr.dataset.openReq);
        };
      });
    }

    function openSchedule(activeDate = null, activeDept = null) {
      if (typeof activeDate === 'string' && activeDate) {
        currentSchDate = activeDate;
      } else {
        currentSchDate = null;
      }
      if (typeof activeDept === 'string') {
        currentSchDept = activeDept;
      }

      const sc = S.requests.filter((r) => r.start);
      const scDays = [...new Set(sc.map((r) => r.date).filter(Boolean))].sort();
      const allReqDays = [...new Set(S.requests.map((r) => r.date).filter(Boolean))].sort();

      if (!currentSchDate || typeof currentSchDate !== 'string') {
        if (scDays.includes(TODAY)) currentSchDate = TODAY;
        else if (scDays.length) currentSchDate = scDays[0];
        else if (allReqDays.includes(TODAY)) currentSchDate = TODAY;
        else if (allReqDays.length) currentSchDate = allReqDays[0];
        else currentSchDate = TODAY;
      }

      const modalHTML = buildScheduleHTML(currentSchDate, currentSchDept);
      openModal('Maintenance Schedule', modalHTML, true);
      wireScheduleEvents($('#modal'));
    }

    function openNewRequest() {
      if (!S.assets.length) {
        openModal(
          'New Request',
          `<div class="empty" style="padding:24px 12px;text-align:center">
            <h3 style="margin-top:0;font-size:17px;font-weight:800">No Assets Registered</h3>
            <p class="muted" style="margin:10px 0 22px">You must add an asset first in Asset Management before creating a maintenance request.</p>
            <div class="btn-row stretch" style="justify-content:center">
              <button class="btn" type="button" data-close>Close</button>
              <button class="btn primary" type="button" id="go-add-asset">+ Add Asset First</button>
            </div>
          </div>`
        );
        $('#go-add-asset').onclick = () => {
          closeLayers();
          window.location.hash = '#assets';
          setTimeout(() => $('#newAsset')?.click(), 100);
        };
        return;
      }
      const a0 = S.assets[0];
      const d0 = CAT_DEPT[a0.type] || DEPTS[0];
      openModal(
        'New Request',
        `<form class="form" id="nrf">
          <div class="form-2">
            ${fld('Asset', `<select id="nr-a">${opts(S.assets.map((a) => [a.id, `${a.id} (${a.type})`]), a0.id)}</select>`)}
            ${fld('Department', `<select id="nr-d">${opts(DEPTS, d0)}</select>`)}
          </div>
          <div class="form-2">
            ${fld('Work Type', `<select id="nr-w">${opts(WORK[d0])}</select>`)}
            ${fld('Priority', `<select id="nr-p">${opts(PRI, riskClass(a0.risk))}</select>`)}
          </div>
          <div class="form-2">
            ${fld('Date', `<input type="date" id="nr-dt" value="${TODAY}" required>`)}
            ${fld('Duration (minutes)', `<input type="number" id="nr-du" min="10" step="5" value="60" required>`)}
          </div>
          ${fld('Description', `<textarea id="nr-ds" required placeholder="What needs to be done?"></textarea>`)}
          <div class="btn-row stretch" style="justify-content:flex-end">
            <button class="btn" type="button" data-close>Cancel</button>
            <button class="btn primary" type="submit">Create Request</button>
          </div>
        </form>`
      );
      const fillWork = () => { $('#nr-w').innerHTML = opts(WORK[$('#nr-d').value]); };
      $('#nr-a').onchange = (e) => {
        const a = assetById(e.target.value);
        if (a) {
          $('#nr-d').value = CAT_DEPT[a.type];
          fillWork();
          $('#nr-p').value = riskClass(a.risk);
        }
      };
      $('#nr-d').onchange = fillWork;
      $('#nrf').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = $('#nrf button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.textContent : 'Create Request';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving...';
        }

        const payload = {
          asset: $('#nr-a').value,
          dept: $('#nr-d').value,
          type: $('#nr-w').value,
          pri: $('#nr-p').value,
          date: $('#nr-dt').value,
          dur: +$('#nr-du').value,
          desc: $('#nr-ds').value.trim(),
        };

        try {
          const token = await auth?.currentUser?.getIdToken();
          if (!token) throw new Error('Authentication required. Please log in.');

          const res = await fetch('/api/maintenance-requests', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          const result = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(result?.error || `Server error (HTTP ${res.status})`);
          }

          const savedReq = result.request;
          S.requests.unshift(savedReq);
          persist();
          closeLayers();
          toast(`${savedReq.id} created and saved to MongoDB.`);
          render(true);
        } catch (err) {
          console.error('Failed to save request to MongoDB Atlas:', err);
          toast(`Failed to save request: ${err.message}`);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = origBtnText;
          }
        }
      };
    }

    /* ---------- shell ---------- */

    const appEl = $('#app');
    $('#logo').textContent = 'R';
    $('#menuBtn').innerHTML = ic('menu');
    $('#logoutBtn').innerHTML = ic('logout', 18);
    $('#logoutBtn').onclick = () => {
      if (onLogout) onLogout();
    };

    $('#nav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}" data-k="${k}" title="${l}">${ic(i)}<span class="lbl">${l}</span></a>`).join('');

    let currentRoute = 'dashboard';
    const route = () => {
      const k = window.location.hash.slice(1);
      return pages[k] ? k : 'dashboard';
    };

    function render(keepScroll) {
      const k = route();
      currentRoute = k;
      root.querySelectorAll('#nav a').forEach((a) => {
        const on = a.dataset.k === k;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      V.innerHTML = pages[k]();
      mounts[k]?.();
      updateBell();
      if (keepScroll !== true) {
        window.scrollTo(0, 0);
        appEl.classList.remove('nav-open');
      }
    }

    const mobile = () => matchMedia('(max-width:900px)').matches;
    $('#menuBtn').onclick = () => {
      if (mobile()) appEl.classList.toggle('nav-open');
      else appEl.classList.toggle('collapsed');
      $('#menuBtn').setAttribute('aria-expanded', String(mobile() ? appEl.classList.contains('nav-open') : !appEl.classList.contains('collapsed')));
    };
    $('#scrim').onclick = () => appEl.classList.remove('nav-open');

    const handleHash = () => render();
    window.addEventListener('hashchange', handleHash);

    const handleClick = (e) => {
      if (e.target.closest('[data-close]') || e.target.id === 'pl' || e.target.id === 'ml') {
        closeLayers();
        return;
      }
      const delAsset = e.target.closest('[data-delete-asset]');
      if (delAsset) {
        e.preventDefault();
        e.stopPropagation();
        deleteAsset(delAsset.getAttribute('data-delete-asset') || delAsset.dataset.deleteAsset);
        return;
      }
      const delReq = e.target.closest('[data-delete-req]');
      if (delReq) {
        e.preventDefault();
        e.stopPropagation();
        deleteRequest(delReq.getAttribute('data-delete-req') || delReq.dataset.deleteReq);
        return;
      }
      const dc = e.target.closest('[data-complete]');
      if (dc) {
        e.stopPropagation();
        openComplete(dc.dataset.complete);
        return;
      }
      const oa = e.target.closest('[data-open-asset]');
      if (oa) {
        e.stopPropagation();
        openAsset(oa.dataset.openAsset);
        return;
      }
      const orq = e.target.closest('[data-open-req]');
      if (orq && !e.target.closest('select')) {
        openRequest(orq.dataset.openReq);
        return;
      }
      const g = e.target.closest('[data-go]');
      if (g) {
        closeLayers();
        window.location.hash = '#' + g.dataset.go;
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeLayers();
        appEl.classList.remove('nav-open');
      }
      if (e.key === 'Enter' && e.target.matches('tr[tabindex],li[tabindex]')) {
        e.target.click();
      }
    };

    root.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    seed();
    render();

    return () => {
      window.removeEventListener('hashchange', handleHash);
      root.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onLogout]);

  return (
    <div ref={containerRef}>
      <div className="app" id="app">
        <aside className="sidebar" id="sidebar" aria-label="Main navigation">
          <div className="brand">
            <span className="logo" id="logo">R</span>
            <span className="lbl">RailMaint</span>
          </div>
          <nav className="nav" id="nav"></nav>
        </aside>
        <div className="scrim" id="scrim"></div>
        <div className="main">
          <header className="topbar">
            <button className="icon-btn" id="menuBtn" aria-label="Toggle navigation" aria-expanded="true"></button>
            <span className="sp"></span>
            <a className="icon-btn" id="bell" href="#notifications" aria-label="Notifications"></a>
            <div className="who">
              <div className="avatar">A</div>
              <span>{user?.email ? user.email.split('@')[0] : 'Admin'}</span>
              <button
                className="icon-btn"
                id="logoutBtn"
                title="Log Out"
                aria-label="Log Out"
                style={{ width: '38px', height: '38px', marginLeft: '4px' }}
              ></button>
            </div>
            <div className="track" aria-hidden="true">
              <div className="train">
                <svg viewBox="0 -6 400 34">
                  <defs>
                    <linearGradient id="bm" x1="0" x2="1">
                      <stop offset="0" stopColor="#FFD76A" stopOpacity=".8" />
                      <stop offset="1" stopColor="#FFD76A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points="361,19 400,12 400,28" fill="url(#bm)" />
                  <rect x="0" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="6" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="18" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="30" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="42" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="54" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="1" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="4" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="68" y="15" width="4" height="3" fill="#111827" />
                  <rect x="72" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="78" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="90" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="102" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="114" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="126" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="73" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="76" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="140" y="15" width="4" height="3" fill="#111827" />
                  <rect x="144" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="150" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="162" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="174" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="186" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="198" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="145" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="148" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="212" y="15" width="4" height="3" fill="#111827" />
                  <rect x="216" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="222" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="234" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="246" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="258" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="270" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="217" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="220" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="284" y="15" width="4" height="3" fill="#111827" />
                  <path d="M288 4H340Q356 5 361 15V21H288Z" fill="#fff" stroke="#D3D9E2" />
                  <path d="M341 7Q351 8 355 13H341Z" fill="#1B7CC4" />
                  <rect x="296" y="8" width="10" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="312" y="8" width="10" height="5" rx="1.2" fill="#1B7CC4" />
                  <path d="M289 14H361V17H289Z" fill="#FF700F" />
                  <rect x="292" y="21" width="64" height="2" rx="1" fill="#111827" />
                  <rect x="317" y="-4" width="8" height="8" rx="1.5" fill="#111827" />
                  <rect x="315" y="-6" width="12" height="2.5" rx="1.2" fill="#111827" />
                  <rect x="317" y="0" width="8" height="1.6" fill="#FF700F" />
                  <circle cx="359" cy="19" r="1.6" fill="#FFE08A" />
                  <circle cx="10" cy="24.5" r="3" fill="#111827" /><circle cx="10" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="20" cy="24.5" r="3" fill="#111827" /><circle cx="20" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="48" cy="24.5" r="3" fill="#111827" /><circle cx="48" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="58" cy="24.5" r="3" fill="#111827" /><circle cx="58" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="82" cy="24.5" r="3" fill="#111827" /><circle cx="82" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="92" cy="24.5" r="3" fill="#111827" /><circle cx="92" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="120" cy="24.5" r="3" fill="#111827" /><circle cx="120" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="130" cy="24.5" r="3" fill="#111827" /><circle cx="130" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="154" cy="24.5" r="3" fill="#111827" /><circle cx="154" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="164" cy="24.5" r="3" fill="#111827" /><circle cx="164" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="192" cy="24.5" r="3" fill="#111827" /><circle cx="192" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="202" cy="24.5" r="3" fill="#111827" /><circle cx="202" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="226" cy="24.5" r="3" fill="#111827" /><circle cx="226" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="236" cy="24.5" r="3" fill="#111827" /><circle cx="236" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="264" cy="24.5" r="3" fill="#111827" /><circle cx="264" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="274" cy="24.5" r="3" fill="#111827" /><circle cx="274" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="300" cy="24.5" r="3" fill="#111827" /><circle cx="300" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="312" cy="24.5" r="3" fill="#111827" /><circle cx="312" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="340" cy="24.5" r="3" fill="#111827" /><circle cx="340" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="350" cy="24.5" r="3" fill="#111827" /><circle cx="350" cy="24.5" r="1.2" fill="#FF700F" />
                </svg>
                <i className="puff"></i>
                <i className="puff" style={{ animationDelay: '.6s' }}></i>
                <i className="puff" style={{ animationDelay: '1.2s' }}></i>
                <i className="puff" style={{ animationDelay: '1.8s' }}></i>
              </div>
            </div>
          </header>
          <main className="page" id="view"></main>
        </div>
      </div>
      <div className="layer" id="pl">
        <aside className="panel" id="panel" aria-label="Details"></aside>
      </div>
      <div className="layer" id="ml">
        <div className="modal-box" id="modal" role="dialog" aria-modal="true"></div>
      </div>
      <div id="toast" role="status" aria-live="polite"></div>
    </div>
  );
}
