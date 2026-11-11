import { DEPTS, PRI } from '../lib/constants';
import { esc, fmtD } from '../lib/format';
import { stat, opts, ic } from '../lib/dom';
import { getRequestStatus, pill, conflictPairs } from '../lib/domain';

export function render(ctx) {
  const S = ctx.state;
  const R = S.requests, f = S.ui.rq, c = (s) => R.filter((r) => getRequestStatus(r) === s).length;
  return `<div class="ph-row">
        <h1>Maintenance Requests</h1>
        <div class="btn-row stretch">
          <button class="btn" id="viewSch">View Schedule</button>
          <button class="btn" id="optSch">Optimize Schedule</button>
          <button class="btn primary" id="newReq">+ New Request</button>
        </div>
      </div>
      <div class="toolbar">
        <input type="search" id="rq-q" placeholder="Search by ID or asset" value="${esc(f.q)}" aria-label="Search requests">
        <select id="rq-d" aria-label="Department">${opts(DEPTS, f.dept, 'All departments')}</select>
        <select id="rq-p" aria-label="Priority">${opts(PRI, f.pri, 'All priorities')}</select>
        <select id="rq-s" aria-label="Status">${opts(['Scheduled', 'In Progress', 'Completed', 'Delayed'], f.st, 'All statuses')}</select>
      </div>
      <div class="stats">${stat('Total', R.length)}${stat('Scheduled', c('Scheduled'))}${stat('In Progress', c('In Progress'))}${stat('Delayed', c('Delayed'))}${stat('Completed', c('Completed'))}</div>
      <div class="card flush gap"><div class="tbl-wrap" id="rq-t"></div></div>`;
}

export function mount(ctx) {
  const { root, state: S, render, toast, helpers, modals } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const deleteRequest = modals?.deleteRequest || helpers?.deleteRequest;
  const openNewRequest = modals?.openNewRequest || helpers?.openNewRequest;
  const openSchedule = modals?.openSchedule || helpers?.openSchedule;
  const optimize = helpers?.optimize;

  function runOptimize() {
    const todo = S.requests.filter((r) => r.status === 'Pending' || r.status === 'Delayed').length, cf = conflictPairs(S.requests).length;
    if (!todo && !cf) {
      toast('The schedule is already optimized.');
      return;
    }
    if (optimize) optimize();
    render(true);
    if (openSchedule) openSchedule();
  }

  const f = S.ui.rq;
  const fill = () => {
    const q = f.q.toLowerCase();
    const rows = S.requests
      .filter((r) => {
        const st = getRequestStatus(r);
        return (!f.dept || r.dept === f.dept) &&
               (!f.pri || r.pri === f.pri) &&
               (!f.st || st === f.st || r.status === f.st) &&
               (!q || [r.id, r.asset, r.type].join(' ').toLowerCase().includes(q));
      })
      .sort((a, b) => b.id.localeCompare(a.id));
    $('#rq-t').innerHTML = `<table style="min-width:860px">
          <thead><tr><th>Request ID</th><th>Asset</th><th>Department</th><th>Priority</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>` +
          (rows.length ? rows.map((r) => {
            const rId = r.id || r._id;
            const effectiveStatus = getRequestStatus(r);
            const isDone = r.status === 'Completed';
            return `<tr class="clickable" tabindex="0" data-open-req="${rId}">
              <td class="id">${rId}</td>
              <td>${r.asset}</td>
              <td>${r.dept}</td>
              <td>${pill(r.pri)}</td>
              <td class="num">${fmtD(r.date)}</td>
              <td>${pill(effectiveStatus)}</td>
              <td class="req-actions-cell">
                <div class="btn-row req-actions" style="flex-wrap:nowrap;align-items:center">
                  ${isDone
                    ? `<span class="done-tag" title="Completed">${ic('check', 16)}Done</span>`
                    : `<button class="btn sm primary mark-done-btn" data-complete="${rId}" title="Mark as Done">${ic('check', 14)} Mark as Done</button>`}
                  <button class="btn sm" data-open-req="${rId}" title="View details">View</button>
                  <button class="btn-del-icon" data-delete-req="${rId}" title="Delete maintenance request" aria-label="Delete">${ic('trash', 16)}</button>
                </div>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="7" class="empty">No requests match these filters.</td></tr>`) +
          `</tbody></table>`;

    $('#rq-t').querySelectorAll('[data-delete-req]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (deleteRequest) deleteRequest(btn.getAttribute('data-delete-req'));
      };
    });
  };
  fill();
  $('#rq-q').oninput = (e) => { f.q = e.target.value; fill(); };
  $('#rq-d').onchange = (e) => { f.dept = e.target.value; fill(); };
  $('#rq-p').onchange = (e) => { f.pri = e.target.value; fill(); };
  $('#rq-s').onchange = (e) => { f.st = e.target.value; fill(); };
  $('#newReq').onclick = openNewRequest;
  $('#viewSch').onclick = () => openSchedule();
  $('#optSch').onclick = runOptimize;
}
