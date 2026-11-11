import { MON } from './constants';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtD = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  if (iso.includes('-')) {
    const parts = iso.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return iso;
    }
  }
  return iso;
};

export const dm = (iso) => {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return '—';
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const [y, m, d] = parts[0].length === 4 ? parts : [parts[2], parts[1], parts[0]];
  return `${+d || 1} ${MON[(+m || 1) - 1] || ''}`;
};

export const tm = (h) => {
  const [a, b] = h.split(':');
  return +a * 60 + +b;
};

export const mt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

export const to12 = (h) => {
  if (!h || typeof h !== 'string' || !h.includes(':')) return h || '—';
  const [hh, mm] = h.split(':');
  let hr = parseInt(hh, 10);
  if (isNaN(hr)) return h;
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return `${hr}:${mm.padStart(2, '0')} ${ampm}`;
};

export const mt12 = (m) => to12(mt(m));

export const timeRange12 = (startH, durMin) => {
  if (!startH) return 'Not scheduled';
  const sMin = tm(startH);
  const eMin = sMin + durMin;
  return `${to12(startH)} – ${mt12(eMin)}`;
};

export const fmtDur = (min) => {
  if (!min) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${h} hr${h > 1 ? 's' : ''} ${m} min`;
};

export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
