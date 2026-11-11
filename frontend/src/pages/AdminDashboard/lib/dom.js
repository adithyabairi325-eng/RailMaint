import { esc } from './format';

let root = null;

export const initDom = (rootEl) => {
  root = rootEl;
};

export const $ = (s, r = root) => r ? r.querySelector(s) : null;

export const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  gauge: '<path d="M3.3 17a9 9 0 1 1 17.4 0"/><path d="M12 14l4-4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  bars: '<path d="M5 20V10M11 20V4M17 20v-7M3 20h18"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h0"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
};

export const ic = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

export const dl = (rows) => `<dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

export const opts = (arr, sel, all) => (all != null ? `<option value="">${all}</option>` : '') + arr.map((v) => {
  const [val, lab] = Array.isArray(v) ? v : [v, v];
  return `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(lab)}</option>`;
}).join('');

export const fld = (label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;

export const kpi = (l, v) => `<div class="kpi"><span>${l}</span><b>${v}</b></div>`;

export const stat = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;

let toastT;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3400);
}

export function openPanel(title, html) {
  $('#panel').innerHTML = `<div class="ph"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${ic('x')}</button></div>${html}`;
  $('#pl').classList.add('open');
  $('#panel').scrollTop = 0;
}

export function openModal(title, html, wide = false) {
  const m = $('#modal');
  if (wide) m.classList.add('modal-wide');
  else m.classList.remove('modal-wide');
  m.innerHTML = `<div class="ph"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Close">${ic('x')}</button></div>${html}`;
  $('#ml').classList.add('open');
  m.scrollTop = 0;
}

export function closeLayers() {
  $('#pl').classList.remove('open');
  $('#ml').classList.remove('open');
  $('#modal')?.classList.remove('modal-wide');
}

export function sevIcon(kind) {
  const m = { 'critical-risk': ['alert', 'crit'], predicted: ['trend', 'high'], overdue: ['clock', 'high'], conflict: ['alert', 'med'], delayed: ['clock', 'med'], completed: ['check', 'low'] }[kind] || ['alert', 'med'];
  return `<span class="sev ${m[1]}">${ic(m[0], 18)}</span>`;
}

