import { TODAY, DEPTS, SHORT, DEPT_TAG_CLASS } from '../lib/constants';
import { conflictPairs, getRequestStatus, pill } from '../lib/domain';
import { timeRange12, fmtDur, fmtD, esc } from '../lib/format';
import { ic, opts } from '../lib/dom';

export const scheduleState = {
  currentSchDate: null,
  currentSchDept: '',
};

export function buildScheduleHTML(ctx, activeDate, activeDept) {
      const S = ctx.state;
      const R = S.requests;
      const sc = R.filter((r) => r.start).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '').localeCompare(b.start || ''));
      const wait = R.filter((r) => !r.start && r.status !== 'Completed').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const cf = conflictPairs(S.requests);
      const cids = new Set(cf.flat().map((r) => r.id));

      let targetDate = (typeof activeDate === 'string' && activeDate) ? activeDate : scheduleState.currentSchDate;
      if (!targetDate || typeof targetDate !== 'string') {
        const scDays = [...new Set(sc.map((r) => r.date).filter(Boolean))].sort();
        const allReqDays = [...new Set(S.requests.map((r) => r.date).filter(Boolean))].sort();
        if (scDays.includes(TODAY)) targetDate = TODAY;
        else if (scDays.length) targetDate = scDays[0];
        else if (allReqDays.includes(TODAY)) targetDate = TODAY;
        else if (allReqDays.length) targetDate = allReqDays[0];
        else targetDate = TODAY;
      }
      scheduleState.currentSchDate = targetDate;

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



export function wireScheduleEvents(ctx, container) {
      const { state: S, render, closeLayers, helpers, modals } = ctx;
      const runOptimize = helpers?.runOptimize || (() => {
        const todo = S.requests.filter((r) => r.status === 'Pending' || r.status === 'Delayed').length, cf = conflictPairs(S.requests).length;
        if (!todo && !cf) {
          ctx.toast('The schedule is already optimized.');
          return;
        }
        if (helpers?.optimize) helpers.optimize();
        render(true);
        if (modals?.openSchedule) modals.openScheduleFn(scheduleState.scheduleState.currentSchDate, scheduleState.scheduleState.currentSchDept);
        else openScheduleFn(ctx, scheduleState.scheduleState.currentSchDate, scheduleState.scheduleState.currentSchDept);
      });
      const openScheduleFn = modals?.openSchedule || ((d, dep) => openScheduleFn(ctx, d, dep));
      const openNewRequestFn = modals?.openNewRequest || helpers?.openNewRequest;
      const openRequestFn = modals?.openRequest || helpers?.openRequest;
      const dateInp = container.querySelector('#sch-date-input');
      if (dateInp) {
        const handleDate = (e) => {
          if (e.target.value && e.target.value !== scheduleState.currentSchDate) {
            openScheduleFn(e.target.value, scheduleState.currentSchDept);
          }
        };
        dateInp.onchange = handleDate;
        dateInp.oninput = handleDate;
      }
      const deptSel = container.querySelector('#sch-dept-filter');
      if (deptSel) {
        deptSel.onchange = (e) => openScheduleFn(scheduleState.currentSchDate, e.target.value);
      }

      const optBtn = container.querySelector('#sch-btn-opt');
      if (optBtn) {
        optBtn.onclick = () => { runOptimize(); render(true); openScheduleFn(scheduleState.currentSchDate, scheduleState.currentSchDept); };
      }
      const quickOpt = container.querySelector('#sch-quick-opt');
      if (quickOpt) {
        quickOpt.onclick = () => { runOptimize(); render(true); openScheduleFn(scheduleState.currentSchDate, scheduleState.currentSchDept); };
      }
      const waitOpt = container.querySelector('#sch-wait-opt');
      if (waitOpt) {
        waitOpt.onclick = () => { runOptimize(); render(true); openScheduleFn(scheduleState.currentSchDate, scheduleState.currentSchDept); };
      }
      const quickNew = container.querySelector('#sch-quick-new');
      if (quickNew) {
        quickNew.onclick = () => { closeLayers(); if (openNewRequestFn) openNewRequestFn(); };
      }
      const tlBtn = container.querySelector('#sch-btn-timeline');
      if (tlBtn) {
        tlBtn.onclick = () => {
          closeLayers();
          S.ui.bd = scheduleState.currentSchDate || TODAY;
          window.location.hash = '#blocks';
        };
      }
      container.querySelectorAll('tr[data-open-req]').forEach((tr) => {
        tr.onclick = (e) => {
          if (e.target.closest('select') || e.target.closest('button')) return;
          if (openRequestFn) openRequestFn(tr.dataset.openReq);
        };
      });
    }



export function openSchedule(ctx, activeDate = null, activeDept = null) {
      const { root, state: S, openModal } = ctx;
      const $ = (s, r = root) => r.querySelector(s);
      if (typeof activeDate === 'string' && activeDate) {
        scheduleState.currentSchDate = activeDate;
      } else {
        scheduleState.currentSchDate = null;
      }
      if (typeof activeDept === 'string') {
        scheduleState.currentSchDept = activeDept;
      }

      const sc = S.requests.filter((r) => r.start);
      const scDays = [...new Set(sc.map((r) => r.date).filter(Boolean))].sort();
      const allReqDays = [...new Set(S.requests.map((r) => r.date).filter(Boolean))].sort();

      if (!scheduleState.currentSchDate || typeof scheduleState.currentSchDate !== 'string') {
        if (scDays.includes(TODAY)) scheduleState.currentSchDate = TODAY;
        else if (scDays.length) scheduleState.currentSchDate = scDays[0];
        else if (allReqDays.includes(TODAY)) scheduleState.currentSchDate = TODAY;
        else if (allReqDays.length) scheduleState.currentSchDate = allReqDays[0];
        else scheduleState.currentSchDate = TODAY;
      }

      const modalHTML = buildScheduleHTML(ctx, scheduleState.currentSchDate, scheduleState.currentSchDept);
      openModal('Maintenance Schedule', modalHTML, true);
      wireScheduleEvents(ctx, $('#modal'));
    }


