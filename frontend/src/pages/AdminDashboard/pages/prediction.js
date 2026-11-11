import { TODAY } from '../lib/constants';
import { lineChart, factorsHTML } from '../lib/charts';
import { series, daysSince, riskClass, pill, prob } from '../lib/domain';
import { hash, fmtD } from '../lib/format';
import { ic, fld, opts } from '../lib/dom';

export function predChartHTML(a, res, predH) {
  if (!a) return '<p class="muted">No asset registered or selected.</p>';
  const hz = res ? res.h : predH;
  return lineChart(series(a), { proj: res ? res.p : null, xl: [['Nov 2025', 0, 'l'], ['Today', res ? 82 : 100, res ? 'c' : 'r'], ...(res ? [[`+${hz} days`, 100, 'r']] : [])] });
}

export function predResultHTML(a, res) {
  if (!res) return `<div class="result"><div class="hero-num" aria-label="No prediction yet">—</div><p class="muted">${a ? 'Select an asset and run the prediction.' : 'Add an asset in Asset Management to run failure predictions.'}</p></div>`;
  const d = daysSince(a), fails = (hash(a.id) % 3) + (a.risk >= 60 ? 2 : 0), cls = riskClass(res.p);
  return `<div class="result">
        <div>
          <div class="hero-num" style="color:${cls === 'Low' ? 'var(--low)' : cls === 'Medium' ? 'var(--med)' : cls === 'High' ? 'var(--high)' : 'var(--crit)'}">${res.p}%</div>
          <div class="muted small" style="margin-top:6px">Failure probability in ${res.h} days</div>
        </div>
        <div>${pill(cls)}</div>
        ${factorsHTML([
          { n: 'Previous failures', v: `${fails} in 24 months`, p: fails * 20 },
          { n: 'Maintenance gap', v: d + ' days', p: d / 1.5 },
          { n: 'Current condition', v: a.risk + '% risk', p: a.risk },
        ])}
      </div>`;
}

export function render(ctx) {
  const S = ctx.state;
  const assetById = ctx.helpers?.assetById || ((id) => S.assets.find((x) => x.id === id || x.assetId === id || String(x._id) === id));
  const sel = S.ui.predSel && assetById(S.ui.predSel) ? S.ui.predSel : (S.assets[0]?.id || '');
  S.ui.predSel = sel;
  const a = assetById(sel);
  const res = S.ui.predRes && S.ui.predRes.asset === sel ? S.ui.predRes : null;
  return `<div class="ph-row">
        <h1>Future Failure Prediction</h1>
        <span class="pill crit" style="font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:6px">${ic('alert', 14)} ML Model &amp; Datasets: Not Integrated</span>
      </div>
      <div class="ml-status-banner">
        <span class="ml-status-icon">${ic('alert', 20)}</span>
        <div class="ml-status-body">
          <b>Machine Learning Model &amp; Datasets Not Integrated</b>
          <p>Predictive failure ML algorithms and telemetry sensor datasets are not integrated. Predictions and trend graphs are simulated based on historical heuristics.</p>
        </div>
      </div>
      <section class="card gap" style="margin-top:18px">
        <div class="form-grid">
          ${fld('Asset', S.assets.length ? `<select id="pd-a">${opts(S.assets.map((x) => [x.id, `${x.id} (${x.type})`]), sel)}</select>` : `<select id="pd-a" disabled><option>No assets registered</option></select>`)}
          ${fld('Time horizon', `<select id="pd-h">${opts([['30', '30 days'], ['60', '60 days'], ['90', '90 days']], String(S.ui.predH))}</select>`)}
          <button class="btn primary" id="pd-run" ${a ? '' : 'disabled'}>Predict Failure</button>
        </div>
      </section>
      <div class="cols even">
        <section class="card" id="pd-res">${predResultHTML(a, res)}</section>
        <section class="card"><h2>Risk Trend, Last 12 Months</h2><div id="pd-ch">${predChartHTML(a, res, S.ui.predH)}</div></section>
      </div>
      <section class="card flush gap">
        <h2>Previous Predictions</h2>
        <div class="tbl-wrap">
          <table style="min-width:560px">
            <thead><tr><th>Date</th><th>Asset</th><th>Horizon</th><th>Probability</th><th>Risk</th></tr></thead>
            <tbody>${S.predHist.length ? S.predHist.map((h) => `<tr><td class="num">${fmtD(h.date)}</td><td class="id">${h.asset}</td><td>${h.h} days</td><td class="num"><b>${h.p}%</b></td><td>${pill(riskClass(h.p))}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No previous predictions recorded.</td></tr>'}</tbody>
          </table>
        </div>
      </section>`;
}

export function mount(ctx) {
  const { root, state: S, render, persist, toast, helpers } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const assetById = helpers?.assetById || ((id) => S.assets.find((x) => x.id === id || x.assetId === id || String(x._id) === id));
  const addNotif = helpers?.addNotif;

  $('#pd-a').onchange = (e) => { S.ui.predSel = e.target.value; S.ui.predRes = null; render(true); };
  $('#pd-h').onchange = (e) => { S.ui.predH = +e.target.value; };
  $('#pd-run').onclick = () => {
    const a = assetById($('#pd-a').value);
    if (!a) return;
    const h = +$('#pd-h').value, p = prob(a, h);
    S.ui.predRes = { asset: a.id, h, p };
    S.ui.predH = h;
    S.predHist.unshift({ date: TODAY, asset: a.id, h, p });
    if (p >= 70 && !S.notifs.some((n) => n.kind === 'predicted' && n.ref.id === a.id && !n.read)) {
      if (addNotif) addNotif('predicted', `High failure probability for ${a.id}`, `${p}% chance of failure within ${h} days.`, { t: 'asset', id: a.id });
    }
    persist();
    toast(`${a.id}: ${p}% failure probability in ${h} days`);
    render(true);
  };
}
