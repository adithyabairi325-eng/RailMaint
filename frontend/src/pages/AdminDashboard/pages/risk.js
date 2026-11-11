import { TODAY } from '../lib/constants';
import { gauge, factorsHTML, animGauge } from '../lib/charts';
import { GCOL, pill, cond, assess } from '../lib/domain';
import { fmtD, esc } from '../lib/format';
import { ic, fld, opts } from '../lib/dom';

export function riskResultHTML(res) {
  if (!res) return `<div class="result">${gauge(null)}<p class="muted">Choose a request and run the assessment.</p></div>`;
  return `<div class="result">
        ${gauge(res.risk, GCOL[res.cls])}
        <div>${pill(res.cls)}</div>
        ${factorsHTML(res.factors)}
        <div class="note">Recommended priority: ${res.cls}. Complete within ${res.within}.</div>
      </div>`;
}

export const stepsHTML = (on) => `<div class="steps"><span class="${on >= 1 ? 'on' : ''}"><b>1</b>Existing Issue</span><span class="arr">›</span><span class="${on >= 2 ? 'on' : ''}"><b>2</b>Risk Assessment</span><span class="arr">›</span><span class="${on >= 3 ? 'on' : ''}"><b>3</b>Priority Recommendation</span></div>`;

export function riskHistHTML(S) {
  return `<table style="min-width:640px">
        <thead><tr><th>Date</th><th>Asset</th><th>Issue</th><th>Risk</th><th>Priority</th></tr></thead>
        <tbody>${S.riskHist.length ? S.riskHist.map((h) => `<tr><td class="num">${fmtD(h.date)}</td><td class="id">${h.asset}</td><td>${esc(h.issue)}</td><td class="num"><b>${h.risk}%</b></td><td>${pill(h.cls)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No assessment history recorded.</td></tr>'}</tbody>
      </table>`;
}

export function render(ctx) {
  const S = ctx.state;
  const open = S.requests.filter((r) => r.status !== 'Completed');
  const sel = S.ui.riskSel && open.find((r) => r.id === S.ui.riskSel) ? S.ui.riskSel : open[0]?.id || '';
  S.ui.riskSel = sel;
  const targetReq = open.find((r) => r.id === sel);

  return `<div class="ph-row">
        <h1>Present Risk Scoring</h1>
        <span class="pill crit" style="font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:6px">${ic('alert', 14)} ML Model &amp; Datasets: Not Integrated</span>
      </div>
      <div class="ml-status-banner">
        <span class="ml-status-icon">${ic('alert', 20)}</span>
        <div class="ml-status-body">
          <b>Machine Learning Model &amp; Datasets Not Integrated</b>
          <p>Production ML scoring models and sensor datasets are not currently connected. Scoring values shown are rule-based heuristic calculations.</p>
        </div>
      </div>
      ${stepsHTML(S.ui.riskRes ? 3 : 1)}
      <div class="cols even">
        <section class="card">
          <div class="form">
            ${fld('Asset or maintenance request', open.length ? `<select id="rk-s">${opts(open.map((r) => [r.id, `${r.id}  ${r.asset}, ${r.type}`]), sel)}</select>` : `<select id="rk-s" disabled><option>No open requests available</option></select>`)}
            ${fld('Reported issue', `<textarea id="rk-i" placeholder="${open.length ? 'Describe defect or issue...' : 'Add a maintenance request to run risk assessments.'}" ${open.length ? '' : 'disabled'}>${esc(targetReq?.desc || '')}</textarea>`)}
            <button class="btn primary" id="rk-run" ${open.length ? '' : 'disabled'}>Run Risk Assessment</button>
          </div>
        </section>
        <section class="card" id="rk-res">${riskResultHTML(S.ui.riskRes)}</section>
      </div>
      <section class="card flush gap"><h2>Assessment History</h2><div class="tbl-wrap" id="rk-h">${riskHistHTML(S)}</div></section>`;
}

export function mount(ctx) {
  const { root, state: S, render, persist, toast, helpers } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const reqById = helpers?.reqById || ((id) => S.requests.find((r) => r.id === id || String(r._id) === id));
  const assetById = helpers?.assetById || ((id) => S.assets.find((a) => a.id === id || a.assetId === id || String(a._id) === id));

  animGauge();
  $('#rk-s').onchange = (e) => {
    S.ui.riskSel = e.target.value;
    S.ui.riskRes = null;
    render(true);
  };
  $('#rk-run').onclick = () => {
    const r = reqById($('#rk-s').value);
    if (!r) return;
    const a = assetById(r.asset);
    if (!a) return;
    const issue = $('#rk-i').value.trim();
    if (!issue) {
      toast('Describe the issue first');
      return;
    }
    const res = assess(a, issue);
    S.ui.riskRes = res;
    a.risk = res.risk;
    r.pri = res.cls;
    r.desc = issue;
    S.riskHist.unshift({ date: TODAY, asset: a.id, issue, risk: res.risk, cls: res.cls });
    persist();
    $('#rk-res').innerHTML = riskResultHTML(res);
    $('#rk-h').innerHTML = riskHistHTML(S);
    $('.steps').outerHTML = stepsHTML(3);
    animGauge();
    toast(`${a.id} is now ${cond(res.risk)} at ${res.risk}%. Priority set to ${res.cls}.`);
  };
}
