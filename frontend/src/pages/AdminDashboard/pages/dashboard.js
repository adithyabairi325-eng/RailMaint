import { TODAY, SHORT } from '../lib/constants';
import { kpi, sevIcon } from '../lib/dom';
import { prob, blocksOf, getRequestStatus, pill } from '../lib/domain';
import { dm, to12, mt, esc } from '../lib/format';
import { reportRows } from '../lib/store';

export function render(ctx) {
  const S = ctx.state;
  const A = S.assets, R = S.requests;
  const healthy = A.filter((a) => a.risk < 40).length, crit = A.filter((a) => a.risk >= 80).length, mid = A.length - healthy - crit;
  const kp = [
    ['Total Assets', A.length],
    ['Open Requests', R.filter((r) => r.status !== 'Completed').length],
    ['At-Risk Assets', mid + crit],
    ['Predicted Failures', A.filter((a) => prob(a, 30) >= 70).length],
    ['Active Blocks', blocksOf(R).filter((b) => b.active).length],
    ['Completed Tasks', (ctx.helpers?.reportRows ? ctx.helpers.reportRows() : reportRows(S)).filter((x) => x.done).length],
  ];
  const segs = [['Healthy', healthy, '#2E9E5B'], ['At Risk', mid, '#FF700F'], ['Critical', crit, '#C8372D']];
  let cum = 0;
  const arcs = segs.map(([l, v, c]) => {
    const p = A.length ? (v / A.length) * 100 : 0, o = -cum;
    cum += p;
    return v ? `<circle cx="21" cy="21" r="15.9155" stroke="${c}" stroke-dasharray="${Math.max(p - 0.8, 0.1)} ${100 - Math.max(p - 0.8, 0.1)}" stroke-dashoffset="${o}"/>` : '';
  }).join('');
  const recent = [...R].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);
  const up = blocksOf(R).filter((b) => b.upcoming && b.date >= TODAY).slice(0, 4);
  const al = S.notifs.filter((n) => !n.read && ['critical-risk', 'predicted', 'overdue', 'conflict', 'delayed'].includes(n.kind)).slice(0, 4);

  return `<h1>Dashboard Overview</h1>
      <div class="kpis">${kp.map((k) => kpi(...k)).join('')}</div>
      <div class="cols">
        <div class="stack">
          <section class="card">
            <h2>Asset Risk Distribution</h2>
            <div class="donut-row">
              <div class="donut">
                <svg viewBox="0 0 42 42" role="img" aria-label="Asset risk distribution">
                  <circle cx="21" cy="21" r="15.9155" stroke="var(--line2)"/>
                  ${arcs}
                </svg>
                <div class="c"><b>${A.length}</b><span>Assets</span></div>
              </div>
              <ul class="legend">${segs.map(([l, v, c]) => `<li><i style="background:${c}"></i>${l}<b>${v}</b></li>`).join('')}</ul>
            </div>
          </section>
          <section class="card flush">
            <h2>Recent Maintenance Requests</h2>
            <div class="tbl-wrap">
              <table style="min-width:540px">
                <thead><tr><th>Request</th><th>Asset</th><th>Department</th><th>Priority</th><th>Status</th></tr></thead>
                <tbody>
                  ${recent.length ? recent.map((r) => `<tr class="clickable" tabindex="0" data-open-req="${r.id}"><td class="id">${r.id}</td><td>${r.asset}</td><td>${SHORT[r.dept]}</td><td>${pill(r.pri)}</td><td>${pill(getRequestStatus(r))}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No recent maintenance requests.</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="stack">
          <section class="card">
            <h2>Upcoming Maintenance Blocks</h2>
            ${up.length ? `<ul class="rows">${up.map((b) => `<li data-go="blocks"><div class="when"><b>${dm(b.date)}</b><span>${to12(mt(b.from))} – ${to12(mt(b.to))}</span></div><div class="t"><b>Maintenance Block</b><span class="muted small">${[...new Set(b.tasks.map((t) => SHORT[t.dept]))].join(', ')}</span></div></li>`).join('')}</ul>` : '<p class="muted">No upcoming blocks.</p>'}
          </section>
          <section class="card">
            <h2>Critical Alerts</h2>
            ${al.length ? `<ul class="rows">${al.map((n) => `<li data-alert="${n.id}">${sevIcon(n.kind)}<div class="t"><b>${esc(n.title)}</b><span class="muted small">${n.time}</span></div></li>`).join('')}</ul>` : '<p class="muted">No unread alerts.</p>'}
          </section>
        </div>
      </div>`;
}

export function mount(ctx) {
  const { root, state: S, render, helpers } = ctx;
  const V = root.querySelector('#view');
  if (!V) return;
  V.querySelectorAll('[data-alert]').forEach((li) => (li.onclick = () => {
    const n = S.notifs.find((x) => x.id === li.dataset.alert);
    if (n) {
      n.read = true;
      if (helpers?.updateBell) helpers.updateBell();
      if (helpers?.openRef) helpers.openRef(n.ref);
      render(true);
    }
  }));
}
