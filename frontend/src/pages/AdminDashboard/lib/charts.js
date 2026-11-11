import { esc, clamp } from './format';

let chartRoot = null;

export function initCharts(rootEl) {
  chartRoot = rootEl;
}

export function gauge(v, col) {
  return `<div class="gauge"><svg viewBox="0 0 120 68" aria-hidden="true"><path class="g-bg" d="M10 62A50 50 0 0 1 110 62" pathLength="100"/><path class="g-fg" d="M10 62A50 50 0 0 1 110 62" pathLength="100" data-v="${v ?? 0}" style="stroke:${col || 'var(--line2)'};stroke-dasharray:0 100"/></svg><div class="g-c"><b>${v == null ? '—' : v + '%'}</b></div></div>`;
}

export function animGauge(r = chartRoot) {
  const target = r || (typeof document !== 'undefined' ? document : null);
  if (!target) return;
  requestAnimationFrame(() => requestAnimationFrame(() => target.querySelectorAll('.g-fg').forEach((p) => (p.style.strokeDasharray = `${p.dataset.v} 100`))));
}

export function factorsHTML(f) {
  return `<div class="factors">${f.map((x) => `<div class="factor"><b>${esc(x.n)}</b><span>${esc(x.v)}</span><div class="meter"><i style="width:${clamp(x.p, 4, 100)}%"></i></div></div>`).join('')}</div>`;
}

export function lineChart(vals, o = {}) {
  const { proj = null, max = 100, fmt = (v) => v + '%', xl = [] } = o, n = vals.length, w = proj == null ? 100 : 82;
  const X = (i) => (i / (n - 1)) * w, Y = (v) => 100 - (v / max) * 100;
  const grid = [0, 25, 50, 75, 100].map((y) => `<line class="grid" x1="0" x2="100" y1="${y}" y2="${y}" vector-effect="non-scaling-stroke"/>`).join('');
  const line = `<polyline class="ln" vector-effect="non-scaling-stroke" points="${vals.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}"/>`;
  const pj = proj == null ? '' : `<polyline class="pj" vector-effect="non-scaling-stroke" points="${X(n - 1)},${Y(vals[n - 1])} 100,${Y(proj)}"/>`;
  return `<div class="chart-wrap"><div class="yl"><span>${fmt(max)}</span><span>${fmt(Math.round(max / 2))}</span><span>${fmt(0)}</span></div><div>
        <div class="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${grid}${line}${pj}</svg>
        <span class="dot" style="left:${X(n - 1)}%;top:${Y(vals[n - 1])}%"></span>${proj == null ? '' : `<span class="dot pj" style="left:100%;top:${Y(proj)}%"></span>`}</div>
        <div class="xl">${xl.map(([t, pos, al]) => `<span style="left:${pos}%;${al === 'r' ? 'transform:translateX(-100%)' : al === 'c' ? 'transform:translateX(-50%)' : ''}">${t}</span>`).join('')}</div></div></div>`;
}

export function barChart(labels, vals) {
  const m = Math.max(1, ...vals);
  return `<div class="bars">${vals.map((v) => `<div class="bcol"><b>${v}</b><i style="height:${(v / m) * 82}%"></i></div>`).join('')}</div><div class="bl">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
}
