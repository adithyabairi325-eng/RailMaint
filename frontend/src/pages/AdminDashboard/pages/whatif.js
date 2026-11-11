import { conflictPairs, whatIfCalc } from '../lib/domain';
import { clamp } from '../lib/format';
import { ic, fld, opts, dl } from '../lib/dom';

export function render(ctx) {
  const S = ctx.state;
  const reqById = ctx.helpers?.reqById || ((id) => S.requests.find((x) => x.id === id || String(x._id) === id));
  const assetById = ctx.helpers?.assetById || ((id) => S.assets.find((x) => x.id === id || x.assetId === id || String(x._id) === id));
  const cand = S.requests.filter((r) => r.start && r.status !== 'Completed'), w = S.ui.wi;
  if (!w.id || !cand.find((r) => r.id === w.id)) {
    w.id = cand[0]?.id || '';
    w.prop = null;
    w.sim = null;
  }
  const r = reqById(w.id), a = r ? assetById(r.asset) : null;
  if (r && w.prop == null) w.prop = r.dur + 30;
  const sm = w.sim;
  const delta = (v, u) => (v === 0 ? '' : ` <span style="color:${v > 0 ? 'var(--crit)' : 'var(--low)'}">(${v > 0 ? '+' : ''}${v}${u})</span>`);

  return `<div class="ph-row">
        <h1>What-If Simulator</h1>
        <span class="pill crit" style="font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:6px">${ic('alert', 14)} ML Model &amp; Datasets: Not Integrated</span>
      </div>
      <div class="ml-status-banner">
        <span class="ml-status-icon">${ic('alert', 20)}</span>
        <div class="ml-status-body">
          <b>Machine Learning Model &amp; Datasets Not Integrated</b>
          <p>What-if disruption prediction models and historical delay datasets are not connected. Scenario impacts are calculated using baseline rule estimates.</p>
        </div>
      </div>
      <section class="card gap" style="margin-top:18px">
        <div class="form-grid">
          ${fld('Maintenance request', cand.length ? `<select id="wi-r">${opts(cand.map((x) => [x.id, `${x.id}  ${x.type}`]), w.id)}</select>` : `<select id="wi-r" disabled><option>No scheduled requests</option></select>`)}
          ${fld('Original duration', `<input value="${r ? r.dur + ' min' : '—'}" readonly aria-readonly="true">`)}
          ${fld('Proposed duration (minutes)', `<input type="number" id="wi-p" min="10" step="5" value="${w.prop || 60}" ${r ? '' : 'disabled'}>`)}
          ${fld('Risk assumption (optional)', `<select id="wi-a" ${r ? '' : 'disabled'}>${opts([['none', 'No assumption'], ['worse', 'Defect is worse than reported'], ['minor', 'Defect is minor']], w.assump)}</select>`)}
        </div>
        <div class="btn-row stretch" style="margin-top:16px">
          <button class="btn primary" id="wi-sim" ${r ? '' : 'disabled'}>Simulate Scenario</button>
          <button class="btn" id="wi-reset">Reset</button>
        </div>
      </section>
      <div class="cols even">
        <section class="card">
          <h2>Original Plan</h2>
          ${r && a ? dl([['Duration', r.dur + ' min'], ['Risk', a.risk + '%'], ['Conflicts', String(conflictPairs(S.requests).filter((p) => p.includes(r)).length)], ['Disruption', 'Baseline']]) : '<p class="muted">No scheduled requests available to simulate.</p>'}
        </section>
        <section class="card">
          <div class="ph-row" style="margin-bottom:14px">
            <h2 style="margin:0">Simulated Plan</h2>
            <span class="demo">Simulated prediction results</span>
          </div>
          ${sm ? dl([
            ['Duration', `${sm.prop} min${delta(sm.extra, ' min')}`],
            ['Risk', `${sm.risk}%${delta(sm.risk - sm.orig, '')}`],
            ['Conflicts', `${sm.conflicts}${delta(sm.conflicts - sm.base, '')}`],
            ['Disruption', `${sm.dis}${sm.trains > 0 ? `, about ${sm.trains} train${sm.trains > 1 ? 's' : ''} delayed` : ''}`],
          ]) +
          (sm.hit.length ? `<div class="note" style="margin-top:16px">Work would end at ${sm.end} and overlap ${sm.hit.map((p) => p.find((x) => x.id !== r.id && x.id !== undefined && x.start)?.id).filter(Boolean).join(', ')}.</div>` : '')
          : `<p class="muted">${r ? 'Set a proposed duration and click Simulate Scenario to predict impact.' : 'Schedule a maintenance request first to simulate scenarios.'}</p>`}
        </section>
      </div>`;
}

export function mount(ctx) {
  const { root, state: S, render, helpers } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const reqById = helpers?.reqById || ((id) => S.requests.find((x) => x.id === id || String(x._id) === id));

  const w = S.ui.wi;
  $('#wi-r').onchange = (e) => { w.id = e.target.value; w.prop = null; w.sim = null; render(true); };
  $('#wi-p').oninput = (e) => { w.prop = +e.target.value; };
  $('#wi-a').onchange = (e) => { w.assump = e.target.value; };
  $('#wi-sim').onclick = () => {
    const r = reqById(w.id);
    if (!r) return;
    const p = clamp(Math.round(+$('#wi-p').value || r.dur), 10, 600);
    w.prop = p;
    w.sim = { ...whatIfCalc(r, p, w.assump, ctx), prop: p };
    render(true);
  };
  $('#wi-reset').onclick = () => { w.prop = null; w.assump = 'none'; w.sim = null; render(true); };
}
