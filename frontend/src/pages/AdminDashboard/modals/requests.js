import { TODAY, DEPTS, CAT_DEPT, WORK, PRI } from '../lib/constants';
import { getRequestStatus, pill, riskClass } from '../lib/domain';
import { esc, fmtD, timeRange12, fmtDur } from '../lib/format';
import { dl, ic, fld, opts } from '../lib/dom';
import { buildScheduleHTML, wireScheduleEvents, scheduleState } from './schedule';
import { confirmDelete } from './assets';

export function openRequest(ctx, id) {
      const { state: S, openPanel, helpers } = ctx;
      const reqById = helpers?.reqById || ((rId) => S.requests.find((r) => r.id === rId || r._id === rId));
      const assetById = helpers?.assetById || ((aId) => S.assets.find((a) => a.id === aId || a.assetId === aId || String(a._id) === aId));
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



export async function markCompleted(ctx, r, doneDate = TODAY, actual = null, note = '') {
      const { root, state: S, auth, persist, toast, render, helpers, modals } = ctx;
      const $ = (s, rEl = root) => rEl.querySelector(s);
      const assetById = helpers?.assetById || ((aId) => S.assets.find((a) => a.id === aId || a.assetId === aId || String(a._id) === aId));
      const addNotif = helpers?.addNotif || (() => {});
      const buildScheduleHTMLFn = modals?.buildScheduleHTML || ((d, dep) => buildScheduleHTML(ctx, d, dep));
      const wireScheduleEventsFn = modals?.wireScheduleEvents || ((cont) => wireScheduleEvents(ctx, cont));
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
          modal.innerHTML = buildScheduleHTMLFn(scheduleState.currentSchDate, scheduleState.currentSchDept);
          wireScheduleEventsFn(modal);
        }
      } catch (err) {
        console.error('Failed to update status in MongoDB Atlas:', err);
        toast(`Error updating status: ${err.message}`);
      }
    }



export function openComplete(ctx, id) {
      const { root, state: S, openModal, closeLayers, helpers, modals } = ctx;
      const $ = (s, rEl = root) => rEl.querySelector(s);
      const reqById = helpers?.reqById || ((rId) => S.requests.find((r) => r.id === rId || r._id === rId));
      const markCompletedFn = modals?.markCompleted || ((req, d, t, n) => markCompleted(ctx, req, d, t, n));
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
        markCompletedFn(r, $('#cf-d').value, +$('#cf-t').value, $('#cf-n').value.trim());
      };
    }



export function openNewRequest(ctx) {
      const { root, state: S, openModal, closeLayers, auth, persist, toast, render, helpers } = ctx;
      const $ = (s, rEl = root) => rEl.querySelector(s);
      const assetById = helpers?.assetById || ((aId) => S.assets.find((a) => a.id === aId || a.assetId === aId || String(a._id) === aId));
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



export function deleteRequest(ctx, id) {
      if (!id) return;
      const { state: S, auth, persist, closeLayers, toast, render, helpers, modals } = ctx;
      const reqById = helpers?.reqById || ((rId) => S.requests.find((r) => r.id === rId || r._id === rId));
      const confirmDeleteFn = modals?.confirmDelete || ((t, m, c) => confirmDelete(ctx, t, m, c));
      const r = reqById(id);
      const label = r ? `${r.id} (${r.type || 'Request'} on ${r.asset || 'Asset'})` : id;

      confirmDeleteFn('Delete Maintenance Request', `Are you sure you want to delete maintenance request ${label}? This action cannot be undone.`, async () => {
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


