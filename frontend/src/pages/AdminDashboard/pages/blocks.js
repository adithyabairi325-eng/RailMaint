import { TODAY, DEPTS, RANK } from '../lib/constants';
import { conflictPairs, blocksOf, endOf, compat, overlap, pill } from '../lib/domain';
import { tm, to12, mt, timeRange12, fmtDur, fmtD, esc } from '../lib/format';
import { opts, stat } from '../lib/dom';

export function optimize(ctx) {
  const { state: S, persist, toast } = ctx;
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

export function laneHTML(name, items, s0, span) {
  const rows = [];
  items.sort((a, b) => a.s - b.s).forEach((it) => {
    let k = rows.findIndex((e) => e <= it.s);
    if (k < 0) {
      k = rows.length;
      rows.push(0);
    }
    rows[k] = it.e;
    it.row = k;
  });
  const h = rows.length * 62 + 8;
  return `<div class="lane">
        <div class="lane-name">${name}</div>
        <div class="lane-track" style="height:${h}px;background-size:${(60 / span) * 100}% 100%">
          ${items.map((it) => `<div class="bar ${it.cls}" ${it.attr || ''} title="${esc(it.tip)}" style="left:${((it.s - s0) / span) * 100}%;width:${((it.e - it.s) / span) * 100}%;top:${4 + it.row * 62}px;height:${it.bh || 56}px">${it.html}</div>`).join('')}
        </div>
      </div>`;
}

export function render(ctx) {
  const S = ctx.state;
  const f = S.ui, list = S.requests.filter((r) => r.date === f.bd && (!f.bdept || r.dept === f.bdept));
  const bl = blocksOf(list), cf = conflictPairs(list), cids = new Set(cf.flat().map((r) => r.id));
  const T = list.filter((r) => r.start);
  let s0 = 480, e0 = 780;
  T.forEach((r) => {
    e0 = Math.max(e0, Math.ceil(endOf(r) / 60) * 60);
    s0 = Math.min(s0, Math.floor(tm(r.start) / 60) * 60);
  });
  const span = Math.max(60, e0 - s0), hrs = span / 60;
  const stCls = { 'In Progress': 's-prog', Completed: 's-done', Delayed: 's-delay' };
  const lanes = [
    laneHTML('Blocks', bl.map((b) => ({
      s: b.from, e: b.to, cls: 'blk' + (b.tasks.some((t) => cids.has(t.id)) ? ' conf' : ''), bh: 48,
      tip: `${to12(mt(b.from))} – ${to12(mt(b.to))}`,
      html: `<b>Maintenance Block</b><span>${to12(mt(b.from))} – ${to12(mt(b.to))}, ${b.tasks.length} task${b.tasks.length > 1 ? 's' : ''}</span>`,
    })), s0, span),
  ].concat(
    (f.bdept ? [f.bdept] : DEPTS).map((d) => laneHTML(d, T.filter((r) => r.dept === d).map((r) => ({
      s: tm(r.start), e: endOf(r), cls: (stCls[r.status] || '') + (cids.has(r.id) ? ' conf' : ''), attr: `data-open-req="${r.id}"`,
      tip: `${r.id}, ${r.type}`,
      html: `<b>${esc(r.type)}</b><span>${timeRange12(r.start, r.dur)}</span><span>${r.status}${cids.has(r.id) ? ', conflict' : ''}</span>`,
    })), s0, span))
  );

  return `<div class="ph-row">
        <h1>Block Optimization</h1>
        <div class="btn-row">
          <button class="btn" id="bk-view-sch-modal">View Detailed Schedule</button>
          <button class="btn primary" id="bk-run">Run Optimization</button>
        </div>
      </div>
      <div class="toolbar">
        <input type="date" id="bk-d" value="${f.bd}" aria-label="Date">
        <select id="bk-p" aria-label="Department">${opts(DEPTS, f.bdept, 'All departments')}</select>
      </div>
      <div class="stats three">${stat('Upcoming Blocks', bl.filter((b) => b.upcoming).length)}${stat('Active Blocks', bl.filter((b) => b.active).length)}${stat('Conflicts', cf.length)}</div>
      <section class="card flush gap">
        <div class="ph-row" style="padding: 18px 22px 0">
          <h2 style="margin:0">Schedule for ${fmtD(f.bd)}</h2>
          <span class="muted small">Timeline (12-Hour AM/PM)</span>
        </div>
        <div class="tl" style="margin-top:12px">
          <div class="tl-in" style="min-width:${150 + span * 2.7}px">
            <div class="axis"><div></div><div class="hrs">${Array.from({ length: hrs }, (_, i) => `<span>${to12(mt(s0 + i * 60))}</span>`).join('')}</div></div>
            ${lanes.join('')}
          </div>
        </div>
        <div class="legend-note">Track and Signal work can share one block. Other departments cannot overlap during the same time window.</div>
      </section>
      <section class="card flush gap">
        <div class="ph-row" style="padding: 18px 22px 0">
          <h2 style="margin:0">Requests</h2>
        </div>
        <div class="tbl-wrap">
          <table style="min-width:680px">
            <thead><tr><th>Request ID</th><th>Department</th><th>Scheduled Window</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              ${list.length ? list.sort((a, b) => (a.start || '99').localeCompare(b.start || '99')).map((r) => `<tr>
                <td class="id"><a href="#blocks" data-open-req="${r.id}" style="color:inherit">${r.id}</a></td>
                <td>${r.dept}</td>
                <td>${r.start ? `<b>${timeRange12(r.start, r.dur)}</b>` : '<span class="muted">Pending schedule</span>'}</td>
                <td class="num">${fmtDur(r.dur)}</td>
                <td>${r.start ? `<select class="st" data-st="${r.id}" aria-label="Status for ${r.id}">${opts(['Scheduled', 'In Progress', 'Completed', 'Delayed'], r.status)}</select>` : pill('Pending')}</td>
              </tr>`).join('') : `<tr><td colspan="5" class="empty">No work planned for this date.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
}

export function mount(ctx) {
  const { root, state: S, render, persist, toast, auth, helpers, modals } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const V = $('#view') || root.querySelector('#view');
  const reqById = helpers?.reqById || ((id) => S.requests.find((r) => r.id === id || String(r._id) === id));
  const openComplete = modals?.openComplete || helpers?.openComplete;
  const openSchedule = modals?.openSchedule || helpers?.openSchedule;
  const addNotif = helpers?.addNotif;

  const bkd = $('#bk-d');
  if (bkd) {
    const onBkDate = (e) => {
      if (e.target.value && e.target.value !== S.ui.bd) {
        S.ui.bd = e.target.value;
        render(true);
      }
    };
    bkd.onchange = onBkDate;
    bkd.oninput = onBkDate;
  }
  $('#bk-p').onchange = (e) => { S.ui.bdept = e.target.value; render(true); };
  $('#bk-run').onclick = () => { optimize(ctx); render(true); };
  $('#bk-view-sch-modal')?.addEventListener('click', () => {
    if (openSchedule) openSchedule(S.ui.bd, S.ui.bdept);
  });
  V.querySelectorAll('[data-st]').forEach((s) => (s.onchange = async (e) => {
    const r = reqById(s.dataset.st), v = e.target.value;
    const prevStatus = r.status;
    if (v === 'Completed') {
      if (openComplete) openComplete(r.id);
      render(true);
      return;
    }

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (token) {
        const res = await fetch(`/api/maintenance-requests/${r.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: v }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || `HTTP ${res.status}`);
        }
      }

      r.status = v;
      if (v === 'Delayed' && addNotif) addNotif('delayed', `${r.id} is delayed`, `${r.type} on ${r.asset} did not finish on schedule.`, { t: 'request', id: r.id });
      persist();
      toast(`${r.id} marked ${v} in MongoDB.`);
      render(true);
    } catch (err) {
      console.error('Failed to update status in MongoDB Atlas:', err);
      toast(`Failed to update status: ${err.message}`);
      s.value = prevStatus;
    }
  }));
  V.querySelectorAll('a[data-open-req]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
}
