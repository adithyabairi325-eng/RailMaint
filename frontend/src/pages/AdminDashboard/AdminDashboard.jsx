import React, { useEffect, useRef } from 'react';
import './AdminDashboard.css';
import { auth } from '../../firebase/firebaseConfig';

export default function AdminDashboard({ onLogout, user }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    /* ---------- constants ---------- */
    const getToday = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const TODAY = getToday();
    const DEPTS = ['Engineering / Track', 'Signal & Telecom', 'Electrical / Traction', 'Mechanical', 'Bridges'];
    const CATS = ['Track', 'Signals & Communication', 'Electrical & Power', 'Mechanical', 'Bridges'];
    const CAT_DEPT = Object.fromEntries(CATS.map((c, i) => [c, DEPTS[i]]));
    const SHORT = {
      'Engineering / Track': 'Track',
      'Signal & Telecom': 'Signal',
      'Electrical / Traction': 'Electrical',
      'Mechanical': 'Mechanical',
      'Bridges': 'Bridges',
    };
    const PREFIX = { 'Track': 'TRK', 'Signals & Communication': 'SIG', 'Electrical & Power': 'ELE', 'Mechanical': 'MEC', 'Bridges': 'BRG' };
    const WORK = {
      [DEPTS[0]]: ['Rail replacement', 'Sleeper replacement', 'Fastener tightening', 'Track section repair', 'Track switch repair'],
      [DEPTS[1]]: ['Signal repair', 'Network / communication fault', 'Equipment damage repair'],
      [DEPTS[2]]: ['Transformer service', 'Power supply fix', 'Overheating inspection'],
      [DEPTS[3]]: ['Wheel repair', 'Brake repair', 'Motor part replacement', 'Component replacement'],
      [DEPTS[4]]: ['Structure repair', 'Concrete support repair', 'Bridge deck repair', 'Bearing replacement'],
    };
    const PRI = ['Critical', 'High', 'Medium', 'Low'];
    const RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /* ---------- helpers ---------- */
    const $ = (s, r = root) => r.querySelector(s);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtD = (iso) => {
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
    const dm = (iso) => {
      if (!iso || typeof iso !== 'string' || !iso.includes('-')) return '—';
      const parts = iso.split('-');
      if (parts.length < 3) return iso;
      const [y, m, d] = parts[0].length === 4 ? parts : [parts[2], parts[1], parts[0]];
      return `${+d || 1} ${MON[(+m || 1) - 1] || ''}`;
    };
    const tm = (h) => {
      const [a, b] = h.split(':');
      return +a * 60 + +b;
    };
    const mt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const to12 = (h) => {
      if (!h || typeof h !== 'string' || !h.includes(':')) return h || '—';
      const [hh, mm] = h.split(':');
      let hr = parseInt(hh, 10);
      if (isNaN(hr)) return h;
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;
      return `${hr}:${mm.padStart(2, '0')} ${ampm}`;
    };
    const mt12 = (m) => to12(mt(m));
    const timeRange12 = (startH, durMin) => {
      if (!startH) return 'Not scheduled';
      const sMin = tm(startH);
      const eMin = sMin + durMin;
      return `${to12(startH)} – ${mt12(eMin)}`;
    };
    const fmtDur = (min) => {
      if (!min) return '0 min';
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (!h) return `${m} min`;
      if (!m) return `${h} hr${h > 1 ? 's' : ''}`;
      return `${h} hr${h > 1 ? 's' : ''} ${m} min`;
    };
    const DEPT_TAG_CLASS = {
      'Engineering / Track': 'dept-track',
      'Signal & Telecom': 'dept-signal',
      'Electrical / Traction': 'dept-electrical',
      'Mechanical': 'dept-mechanical',
      'Bridges': 'dept-bridges',
    };
    const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
    const addDays = (iso, n) => {
      const d = new Date(iso + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const ICONS = {
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
    const ic = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

    /* ---------- domain rules (Single Location) ---------- */
    const riskClass = (r) => (r >= 80 ? 'Critical' : r >= 60 ? 'High' : r >= 40 ? 'Medium' : 'Low');
    const cond = (r) => (r >= 80 ? 'Critical' : r >= 40 ? 'At Risk' : 'Healthy');
    const TONE = {
      Critical: 'crit', High: 'high', Medium: 'med', Low: 'low',
      Healthy: 'low', 'At Risk': 'high', Completed: 'low', 'In Progress': 'orange',
      Scheduled: 'info', Pending: 'neutral', Delayed: 'crit', Overdue: 'crit',
    };
    const pill = (l) => `<span class="pill ${TONE[l] || 'info'}">${esc(l)}</span>`;
    const GCOL = { Critical: 'var(--crit)', High: 'var(--orange)', Medium: '#D9A400', Low: '#2E9E5B' };
    const daysSince = (a) => (a ? daysBetween(a.last, TODAY) : 0);
    const prob = (a, h) => (a ? clamp(Math.round(a.risk * 0.8 + a.age * 0.5 + daysSince(a) * 0.06 + h * 0.1 - 6), 3, 97) : 0);
    const compat = (a, b) => a === b || (a === DEPTS[0] && b === DEPTS[1]) || (a === DEPTS[1] && b === DEPTS[0]);
    const sched = (r) => r.start && r.status !== 'Completed';
    const endOf = (r) => tm(r.start) + r.dur;
    // Single location: tasks on the same date overlap if time intervals overlap
    const overlap = (a, b) => a.date === b.date && tm(a.start) < endOf(b) && tm(b.start) < endOf(a);

    function isDelayedTask(r) {
      if (!r) return false;
      if (r.status === 'Completed') return false;
      if (r.status === 'Delayed') return true;
      const rDate = (r.date && r.date.split('-')[0].length === 4) ? r.date : (r.date ? r.date.split('-').reverse().join('-') : '');
      if (rDate && rDate < TODAY) return true;
      if (rDate === TODAY && r.start) {
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        if (nowMin > tm(r.start) + r.dur) return true;
      }
      return false;
    }

    function getRequestStatus(r) {
      if (!r) return 'Scheduled';
      if (r.status === 'Completed') return 'Completed';
      if (isDelayedTask(r)) return 'Delayed';
      if (r.status === 'In Progress') return 'In Progress';
      return r.status || 'Scheduled';
    }

    function conflictPairs(list) {
      const l = list.filter(sched), out = [];
      for (let i = 0; i < l.length; i++) {
        for (let j = i + 1; j < l.length; j++) {
          if (!compat(l[i].dept, l[j].dept) && overlap(l[i], l[j])) out.push([l[i], l[j]]);
        }
      }
      return out;
    }

    function blocksOf(list) {
      const m = {};
      list.filter(sched).forEach((r) => {
        (m[r.date] ??= []).push(r);
      });
      return Object.values(m)
        .map((g) => ({
          date: g[0].date,
          tasks: g,
          from: Math.min(...g.map((r) => tm(r.start))),
          to: Math.max(...g.map(endOf)),
          active: g.some((r) => r.status === 'In Progress'),
          upcoming: !g.some((r) => r.status === 'In Progress') && g.some((r) => r.status === 'Scheduled'),
        }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.from - b.from);
    }

    /* ---------- persistent JS data store (NO Location, Clean User Data) ---------- */
    const STORAGE_KEY = 'railmaint_user_store_v3';
    const S = {
      assets: [],
      requests: [],
      notifs: [],
      riskHist: [],
      predHist: [],
      hist: [],
      ui: {
        rq: { q: '', dept: '', pri: '', st: '' },
        as: { q: '', cat: '', cond: '' },
        nf: 'all',
        bd: TODAY,
        bdept: '',
        riskSel: null,
        riskRes: null,
        predSel: null,
        predH: 60,
        predRes: null,
        wi: { id: null, prop: null, assump: 'none', sim: null },
        rp: { from: addDays(TODAY, -90), to: TODAY, dept: '' },
      },
    };

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          assets: S.assets,
          requests: S.requests,
          notifs: S.notifs,
          riskHist: S.riskHist,
          predHist: S.predHist,
          hist: S.hist,
        }));
      } catch {}
    }

    const assetById = (id) => S.assets.find((a) => a.id === id || a.assetId === id || String(a._id) === id);
    const reqById = (id) => S.requests.find((r) => r.id === id || String(r._id) === id);

    const DEFAULT_ASSETS = [
      { id: 'TRK_101', assetId: 'TRK_101', name: 'Track Section TRK_101', type: 'Track', category: 'Track', age: 4, last: addDays(TODAY, -20), risk: 28 },
      { id: 'SIG_201', assetId: 'SIG_201', name: 'Interlocking Signal SIG_201', type: 'Signals & Communication', category: 'Signals & Communication', age: 3, last: addDays(TODAY, -45), risk: 42 },
      { id: 'ELE_301', assetId: 'ELE_301', name: 'Traction Substation ELE_301', type: 'Electrical & Power', category: 'Electrical & Power', age: 6, last: addDays(TODAY, -15), risk: 65 },
      { id: 'MEC_401', assetId: 'MEC_401', name: 'Switch Machine MEC_401', type: 'Mechanical', category: 'Mechanical', age: 2, last: addDays(TODAY, -10), risk: 18 },
      { id: 'BRG_501', assetId: 'BRG_501', name: 'Steel Girder Bridge BRG_501', type: 'Bridges', category: 'Bridges', age: 8, last: addDays(TODAY, -60), risk: 78 },
    ];

    function seed() {
      // Clear legacy demo mock datasets from localStorage
      try {
        localStorage.removeItem('railmaint_exact_store');
        localStorage.removeItem('railmaint_exact_store_v2');
      } catch {}

      const saved = (() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      if (saved && Array.isArray(saved.assets) && saved.assets.length > 0) {
        S.assets = saved.assets;
        S.requests = saved.requests || [];
        S.notifs = saved.notifs || [];
        S.riskHist = saved.riskHist || [];
        S.predHist = saved.predHist || [];
        S.hist = saved.hist || [];
      } else {
        S.assets = [...DEFAULT_ASSETS];
        S.requests = (saved && Array.isArray(saved.requests)) ? saved.requests : [];
        S.hist = [];
        S.predHist = [];
        S.riskHist = [];
        S.notifs = [];
        persist();
      }

      // Sync maintenance requests from MongoDB Atlas via Express backend
      (async () => {
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (!token) return;
          const res = await fetch('/api/maintenance-requests', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.requests)) {
              // MongoDB is the sole source of truth for persisted requests
              S.requests = data.requests;
              persist();
              render(true);
            }
          }
        } catch (e) {
          console.warn('MongoDB sync notice:', e.message);
        }
      })();

      // Sync assets from MongoDB Atlas via Express backend
      (async () => {
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (!token) return;
          const res = await fetch('/api/assets?limit=100', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.assets) && data.assets.length > 0) {
              S.assets = data.assets.map((a) => ({
                ...a,
                id: a.id || a.assetId || a._id,
                assetId: a.assetId || a.id || a._id,
                type: a.type || a.category || a.assetType || 'Track',
                last: a.last || a.lastInspectionDate || TODAY,
              }));
              persist();
              render(true);
            }
          }
        } catch (e) {
          console.warn('Asset sync notice:', e.message);
        }
      })();

      // Sync notifications from MongoDB Atlas via Express backend
      async function syncNotifications() {
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (!token) return;
          const res = await fetch('/api/notifications', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.notifications)) {
              S.notifs = data.notifications;
              persist();
              updateBell();
              if (currentRoute === 'notifications') {
                render(true);
              }
            }
          }
        } catch (e) {
          console.warn('Notifications sync notice:', e.message);
        }
      }
      syncNotifications();
    }

    function reportRows() {
      const rows = S.hist.slice();
      S.requests.forEach((r) => {
        if (r.status === 'Completed') {
          rows.push({ id: r.id, asset: r.asset, dept: r.dept, type: r.type, date: r.doneDate || r.date, dur: r.actual || r.dur, done: true });
        } else if (r.date < TODAY) {
          rows.push({ id: r.id, asset: r.asset, dept: r.dept, type: r.type, date: r.date, dur: r.dur, done: false });
        }
      });
      return rows;
    }

    /* ---------- UI helpers ---------- */
    const V = $('#view');
    let toastT;
    function toast(msg) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(() => t.classList.remove('show'), 3400);
    }
    function openPanel(title, html) {
      $('#panel').innerHTML = `<div class="ph"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${ic('x')}</button></div>${html}`;
      $('#pl').classList.add('open');
      $('#panel').scrollTop = 0;
    }
    function openModal(title, html, wide = false) {
      const m = $('#modal');
      if (wide) m.classList.add('modal-wide');
      else m.classList.remove('modal-wide');
      m.innerHTML = `<div class="ph"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Close">${ic('x')}</button></div>${html}`;
      $('#ml').classList.add('open');
      m.scrollTop = 0;
    }
    function closeLayers() {
      $('#pl').classList.remove('open');
      $('#ml').classList.remove('open');
      $('#modal')?.classList.remove('modal-wide');
    }
    const dl = (rows) => `<dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    const opts = (arr, sel, all) => (all != null ? `<option value="">${all}</option>` : '') + arr.map((v) => {
      const [val, lab] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(lab)}</option>`;
    }).join('');
    const fld = (label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;
    const kpi = (l, v) => `<div class="kpi"><span>${l}</span><b>${v}</b></div>`;
    const stat = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;

    function addNotif(kind, title, desc, ref) {
      S.notifs.unshift({ id: 'N' + Date.now() + Math.random().toString(36).slice(2, 5), kind, title, desc, time: 'Just now', ref, read: false });
      persist();
      updateBell();
    }
    function updateBell() {
      const n = S.notifs.filter((x) => !x.read).length;
      const b = $('#bell');
      if (b) {
        b.setAttribute('aria-label', `Notifications, ${n} unread`);
        b.innerHTML = ic('bell') + (n ? `<span class="badge">${n}</span>` : '');
      }
      const navNf = root.querySelector('#nav a[data-k="notifications"] .lbl');
      if (navNf) {
        navNf.innerHTML = `Notifications${n ? ` <span style="display:inline-block;padding:1px 6px;font-size:11px;font-weight:800;border-radius:10px;background:var(--orange);color:#fff;margin-left:6px">${n}</span>` : ''}`;
      }
    }
    function sevIcon(kind) {
      const m = { 'critical-risk': ['alert', 'crit'], predicted: ['trend', 'high'], overdue: ['clock', 'high'], conflict: ['alert', 'med'], delayed: ['clock', 'med'], completed: ['check', 'low'] }[kind];
      return `<span class="sev ${m[1]}">${ic(m[0], 18)}</span>`;
    }
    function openRef(ref) {
      ref.t === 'request' ? openRequest(ref.id) : openAsset(ref.id);
    }

    function openRequest(id) {
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

    async function markCompleted(r, doneDate = TODAY, actual = null, note = '') {
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
          modal.innerHTML = buildScheduleHTML(currentSchDate, currentSchDept);
          wireScheduleEvents(modal);
        }
      } catch (err) {
        console.error('Failed to update status in MongoDB Atlas:', err);
        toast(`Error updating status: ${err.message}`);
      }
    }

    function openComplete(id) {
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
        markCompleted(r, $('#cf-d').value, +$('#cf-t').value, $('#cf-n').value.trim());
      };
    }

    function openAsset(id) {
      const a = assetById(id), c = cond(a.risk);
      const hist = reportRows().filter((x) => x.asset === id && x.done).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 4);
      const rel = S.requests.filter((r) => r.asset === id && r.status !== 'Completed');
      openPanel(
        a.id,
        `<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
          <span class="hero-num">${a.risk}%</span>
          <div>${pill(c)}<div class="muted small">Risk score</div></div>
        </div>` +
        dl([
          ['Asset type', a.type],
          ['Age', a.age + ' years'],
          ['Last maintenance', fmtD(a.last)],
        ]) +
        `<h3>Maintenance history</h3>` +
        (hist.length ? `<ul class="list">${hist.map((h) => `<li><span>${esc(h.type)}</span><span class="muted small">${fmtD(h.date)}, ${h.dur} min</span></li>`).join('')}</ul>` : '<p class="muted">No completed maintenance recorded.</p>') +
        `<h3>Related requests</h3>` +
        (rel.length ? `<ul class="list">${rel.map((r) => `<li class="click" data-open-req="${r.id}"><span><b>${r.id}</b> ${esc(r.type)}</span>${pill(r.status)}</li>`).join('')}</ul>` : '<p class="muted">No open requests.</p>') +
        `<div class="btn-row gap" style="margin-top:22px">
          <button class="btn danger-soft" data-delete-asset="${a.id || a.assetId || a._id}">${ic('trash', 16)} Delete Asset</button>
        </div>`
      );
    }

    function confirmDelete(title, message, onConfirm) {
      openModal(
        title,
        `<div style="display:grid;gap:16px;padding:6px 0">
          <p style="font-size:15px;color:var(--text);margin:0;line-height:1.5">${esc(message)}</p>
          <div class="btn-row" style="justify-content:flex-end;gap:10px;margin-top:14px">
            <button class="btn" type="button" id="cd-cancel">Cancel</button>
            <button class="btn danger" type="button" id="cd-confirm">Delete</button>
          </div>
        </div>`
      );
      $('#cd-cancel').onclick = closeLayers;
      $('#cd-confirm').onclick = () => {
        closeLayers();
        onConfirm();
      };
    }

    function deleteAsset(id) {
      if (!id) return;
      const a = assetById(id);
      const label = a ? `${a.id || a.assetId} (${a.type || a.category || 'Asset'})` : id;

      confirmDelete('Delete Asset', `Are you sure you want to delete asset ${label}? This action cannot be undone.`, async () => {
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (token) {
            const res = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok && res.status !== 404) {
              const errData = await res.json().catch(() => ({}));
              console.warn('Backend delete asset notice:', errData?.error);
            }
          }
        } catch (err) {
          console.warn('Backend delete asset notice:', err.message);
        }

        S.assets = S.assets.filter((item) => (item.id || item.assetId) !== id && item.assetId !== id && item.id !== id && String(item._id) !== id);
        persist();
        closeLayers();
        toast(`Asset ${id} deleted.`);
        render(true);
      });
    }

    function deleteRequest(id) {
      if (!id) return;
      const r = reqById(id);
      const label = r ? `${r.id} (${r.type || 'Request'} on ${r.asset || 'Asset'})` : id;

      confirmDelete('Delete Maintenance Request', `Are you sure you want to delete maintenance request ${label}? This action cannot be undone.`, async () => {
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

    /* ---------- charts ---------- */
    function gauge(v, col) {
      return `<div class="gauge"><svg viewBox="0 0 120 68" aria-hidden="true"><path class="g-bg" d="M10 62A50 50 0 0 1 110 62" pathLength="100"/><path class="g-fg" d="M10 62A50 50 0 0 1 110 62" pathLength="100" data-v="${v ?? 0}" style="stroke:${col || 'var(--line2)'};stroke-dasharray:0 100"/></svg><div class="g-c"><b>${v == null ? '—' : v + '%'}</b></div></div>`;
    }
    function animGauge() {
      requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('.g-fg').forEach((p) => (p.style.strokeDasharray = `${p.dataset.v} 100`))));
    }
    function factorsHTML(f) {
      return `<div class="factors">${f.map((x) => `<div class="factor"><b>${esc(x.n)}</b><span>${esc(x.v)}</span><div class="meter"><i style="width:${clamp(x.p, 4, 100)}%"></i></div></div>`).join('')}</div>`;
    }
    function lineChart(vals, o = {}) {
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
    function barChart(labels, vals) {
      const m = Math.max(1, ...vals);
      return `<div class="bars">${vals.map((v) => `<div class="bcol"><b>${v}</b><i style="height:${(v / m) * 82}%"></i></div>`).join('')}</div><div class="bl">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
    }

    /* ---------- pages ---------- */
    const pages = {};
    const mounts = {};

    pages.dashboard = () => {
      const A = S.assets, R = S.requests;
      const healthy = A.filter((a) => a.risk < 40).length, crit = A.filter((a) => a.risk >= 80).length, mid = A.length - healthy - crit;
      const kp = [
        ['Total Assets', A.length],
        ['Open Requests', R.filter((r) => r.status !== 'Completed').length],
        ['At-Risk Assets', mid + crit],
        ['Predicted Failures', A.filter((a) => prob(a, 30) >= 70).length],
        ['Active Blocks', blocksOf(R).filter((b) => b.active).length],
        ['Completed Tasks', reportRows().filter((x) => x.done).length],
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
    };

    mounts.dashboard = () => {
      V.querySelectorAll('[data-alert]').forEach((li) => (li.onclick = () => {
        const n = S.notifs.find((x) => x.id === li.dataset.alert);
        if (n) {
          n.read = true;
          updateBell();
          openRef(n.ref);
          render(true);
        }
      }));
    };

    /* requests */
    pages.requests = () => {
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
    };

    mounts.requests = () => {
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
            deleteRequest(btn.getAttribute('data-delete-req'));
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
    };

    function runOptimize() {
      const todo = S.requests.filter((r) => r.status === 'Pending' || r.status === 'Delayed').length, cf = conflictPairs(S.requests).length;
      if (!todo && !cf) {
        toast('The schedule is already optimized.');
        return;
      }
      optimize();
      render(true);
      openSchedule();
    }

    let currentSchDate = null;
    let currentSchDept = '';

    function buildScheduleHTML(activeDate, activeDept) {
      const R = S.requests;
      const sc = R.filter((r) => r.start).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start || '').localeCompare(b.start || ''));
      const wait = R.filter((r) => !r.start && r.status !== 'Completed').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const cf = conflictPairs(S.requests);
      const cids = new Set(cf.flat().map((r) => r.id));

      let targetDate = (typeof activeDate === 'string' && activeDate) ? activeDate : currentSchDate;
      if (!targetDate || typeof targetDate !== 'string') {
        const scDays = [...new Set(sc.map((r) => r.date).filter(Boolean))].sort();
        const allReqDays = [...new Set(S.requests.map((r) => r.date).filter(Boolean))].sort();
        if (scDays.includes(TODAY)) targetDate = TODAY;
        else if (scDays.length) targetDate = scDays[0];
        else if (allReqDays.includes(TODAY)) targetDate = TODAY;
        else if (allReqDays.length) targetDate = allReqDays[0];
        else targetDate = TODAY;
      }
      currentSchDate = targetDate;

      const dateFiltered = sc.filter((r) => r.date === targetDate && (!activeDept || r.dept === activeDept));
      const waitFiltered = wait.filter((r) => (!activeDept || r.dept === activeDept));
      const conflictsCount = cf.filter(([a, b]) => a.date === targetDate || b.date === targetDate).length;
      const scheduledCount = dateFiltered.filter((r) => getRequestStatus(r) === 'Scheduled').length;
      const inProgCount = dateFiltered.filter((r) => getRequestStatus(r) === 'In Progress').length;
      const doneCount = dateFiltered.filter((r) => getRequestStatus(r) === 'Completed').length;
      const delayedCount = dateFiltered.filter((r) => getRequestStatus(r) === 'Delayed').length;

      /* tasks table rows */
      const taskRows = dateFiltered.length
        ? dateFiltered.map((r) => {
            const st = getRequestStatus(r);

            let statusHTML = '';
            if (st === 'Completed') {
              statusHTML = '<span class="pill low">Completed</span>';
            } else if (st === 'Delayed') {
              statusHTML = '<span class="pill crit">Delayed</span>';
            } else if (st === 'In Progress') {
              statusHTML = '<span class="pill orange">In Progress</span>';
            } else {
              statusHTML = '<span class="pill info">Scheduled</span>';
            }

            return `
              <tr class="clickable" data-open-req="${r.id}">
                <td class="sch-time-cell">
                  <b>${timeRange12(r.start, r.dur)}</b>
                  <span>⏱ ${fmtDur(r.dur)}</span>
                </td>
                <td>
                  <div class="sch-task-title">${esc(r.type)}</div>
                  <div class="sch-task-sub">
                    <span class="id">${r.id}</span>
                    <span>•</span>
                    <span>Asset: <strong>${r.asset}</strong></span>
                  </div>
                </td>
                <td><span class="sch-dept-tag ${DEPT_TAG_CLASS[r.dept] || ''}">${SHORT[r.dept] || r.dept}</span></td>
                <td>${pill(r.pri)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    ${statusHTML}
                    ${cids.has(r.id) ? '<span class="pill crit" title="Conflict">⚠</span>' : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="5" class="empty">No tasks scheduled for ${fmtD(targetDate)}.</td></tr>`;

      /* waiting section */
      const waitHTML = waitFiltered.length ? `
        <div class="sch-waiting-section" style="margin-top:20px">
          <h3 style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span>Tasks Waiting to be Scheduled (${waitFiltered.length})</span>
            <button class="btn sm primary" id="sch-wait-opt">Optimize All to Schedule</button>
          </h3>
          <div class="tbl-wrap">
            <table class="sch-tasks-table">
              <thead>
                <tr><th>ID</th><th>Task</th><th>Department</th><th>Asset</th><th>Duration</th><th>Target Date</th><th>Priority</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${waitFiltered.map((r) => `
                  <tr class="clickable" data-open-req="${r.id}">
                    <td class="id">${r.id}</td>
                    <td><strong>${esc(r.type)}</strong></td>
                    <td><span class="sch-dept-tag ${DEPT_TAG_CLASS[r.dept] || ''}">${SHORT[r.dept] || r.dept}</span></td>
                    <td>${r.asset}</td>
                    <td>${fmtDur(r.dur)}</td>
                    <td>${fmtD(r.date)}</td>
                    <td>${pill(r.pri)}</td>
                    <td>${pill(r.status)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : '';

      const emptyHTML = !dateFiltered.length && !waitFiltered.length ? `
        <div class="sch-empty-box" style="margin-top:12px">
          ${ic('clock', 36)}
          <h3>No Tasks for ${fmtD(targetDate)}</h3>
          <p>Create a maintenance request then run Optimization to schedule it.</p>
          <div class="btn-row" style="justify-content:center;margin-top:12px">
            <button class="btn primary" id="sch-quick-new">+ Create Request</button>
            <button class="btn" id="sch-quick-opt">Run Optimization</button>
          </div>
        </div>` : '';

      return `
        <div class="sch-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <label style="font-weight:800;font-size:13px;color:var(--muted);white-space:nowrap">Select Date:</label>
            <input type="date" id="sch-date-input" value="${targetDate}" style="min-height:38px;padding:4px 12px;font-size:13px;width:auto;min-width:160px">
            <select id="sch-dept-filter" aria-label="Department Filter" style="min-height:38px;padding:4px 12px;font-size:13px;width:auto">
              ${opts(DEPTS, activeDept, 'All Departments')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px">
              <span style="font-size:12px;font-weight:800;color:var(--muted)">SCHEDULED</span>
              <b style="font-size:18px;font-weight:800">${scheduledCount}</b>
            </div>
            ${inProgCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--orange)">IN PROGRESS</span><b style="font-size:18px;font-weight:800;color:var(--orange)">${inProgCount}</b></div>` : ''}
            ${doneCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--low)">COMPLETED</span><b style="font-size:18px;font-weight:800;color:var(--low)">${doneCount}</b></div>` : ''}
            ${delayedCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--crit)">DELAYED</span><b style="font-size:18px;font-weight:800;color:var(--crit)">${delayedCount}</b></div>` : ''}
            ${conflictsCount ? `<div class="sch-kpi-card" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px"><span style="font-size:12px;font-weight:800;color:var(--crit)">CONFLICTS</span><b style="font-size:18px;font-weight:800;color:var(--crit)">${conflictsCount}</b></div>` : ''}
          </div>
        </div>

        ${dateFiltered.length ? `
        <div class="sch-block-card" style="margin-bottom:18px">
          <div class="tbl-wrap">
            <table class="sch-tasks-table">
              <thead>
                <tr>
                  <th style="width:200px">Time Slot (AM/PM)</th>
                  <th>Task & Asset</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th style="width:140px">Status</th>
                </tr>
              </thead>
              <tbody>${taskRows}</tbody>
            </table>
          </div>
        </div>` : emptyHTML}

        ${waitHTML}

        <div class="btn-row" style="justify-content:space-between;margin-top:18px;border-top:1px solid var(--line2);padding-top:14px">
          <div class="btn-row">
            <button class="btn primary" id="sch-btn-opt">Optimize Schedule</button>
            <button class="btn" id="sch-btn-timeline">Open Timeline View</button>
          </div>
          <button class="btn" type="button" data-close>Close</button>
        </div>
      `;
    }

    function wireScheduleEvents(container) {
      const dateInp = container.querySelector('#sch-date-input');
      if (dateInp) {
        const handleDate = (e) => {
          if (e.target.value && e.target.value !== currentSchDate) {
            openSchedule(e.target.value, currentSchDept);
          }
        };
        dateInp.onchange = handleDate;
        dateInp.oninput = handleDate;
      }
      const deptSel = container.querySelector('#sch-dept-filter');
      if (deptSel) {
        deptSel.onchange = (e) => openSchedule(currentSchDate, e.target.value);
      }

      const optBtn = container.querySelector('#sch-btn-opt');
      if (optBtn) {
        optBtn.onclick = () => { runOptimize(); render(true); openSchedule(currentSchDate, currentSchDept); };
      }
      const quickOpt = container.querySelector('#sch-quick-opt');
      if (quickOpt) {
        quickOpt.onclick = () => { runOptimize(); render(true); openSchedule(currentSchDate, currentSchDept); };
      }
      const waitOpt = container.querySelector('#sch-wait-opt');
      if (waitOpt) {
        waitOpt.onclick = () => { runOptimize(); render(true); openSchedule(currentSchDate, currentSchDept); };
      }
      const quickNew = container.querySelector('#sch-quick-new');
      if (quickNew) {
        quickNew.onclick = () => { closeLayers(); openNewRequest(); };
      }
      const tlBtn = container.querySelector('#sch-btn-timeline');
      if (tlBtn) {
        tlBtn.onclick = () => {
          closeLayers();
          S.ui.bd = currentSchDate || TODAY;
          window.location.hash = '#blocks';
        };
      }
      container.querySelectorAll('tr[data-open-req]').forEach((tr) => {
        tr.onclick = (e) => {
          if (e.target.closest('select') || e.target.closest('button')) return;
          openRequest(tr.dataset.openReq);
        };
      });
    }

    function openSchedule(activeDate = null, activeDept = null) {
      if (typeof activeDate === 'string' && activeDate) {
        currentSchDate = activeDate;
      } else {
        currentSchDate = null;
      }
      if (typeof activeDept === 'string') {
        currentSchDept = activeDept;
      }

      const sc = S.requests.filter((r) => r.start);
      const scDays = [...new Set(sc.map((r) => r.date).filter(Boolean))].sort();
      const allReqDays = [...new Set(S.requests.map((r) => r.date).filter(Boolean))].sort();

      if (!currentSchDate || typeof currentSchDate !== 'string') {
        if (scDays.includes(TODAY)) currentSchDate = TODAY;
        else if (scDays.length) currentSchDate = scDays[0];
        else if (allReqDays.includes(TODAY)) currentSchDate = TODAY;
        else if (allReqDays.length) currentSchDate = allReqDays[0];
        else currentSchDate = TODAY;
      }

      const modalHTML = buildScheduleHTML(currentSchDate, currentSchDept);
      openModal('Maintenance Schedule', modalHTML, true);
      wireScheduleEvents($('#modal'));
    }

    function openNewRequest() {
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

    /* assets */
    pages.assets = () => {
      const A = S.assets, f = S.ui.as, n = (l) => A.filter((a) => cond(a.risk) === l).length;
      return `<div class="ph-row">
        <h1>Asset Management</h1>
        <button class="btn primary" id="newAsset">+ Add Asset</button>
      </div>
      <div class="toolbar">
        <input type="search" id="as-q" placeholder="Search by ID" value="${esc(f.q)}" aria-label="Search assets">
        <select id="as-c" aria-label="Category">${opts(CATS, f.cat, 'All categories')}</select>
        <select id="as-s" aria-label="Condition">${opts(['Healthy', 'At Risk', 'Critical'], f.cond, 'All conditions')}</select>
      </div>
      <div class="stats">${stat('Total', A.length)}${stat('Healthy', n('Healthy'))}${stat('At Risk', n('At Risk'))}${stat('Critical', n('Critical'))}</div>
      <div class="card flush gap"><div class="tbl-wrap" id="as-t"></div></div>`;
    };

    mounts.assets = () => {
      const f = S.ui.as;
      const fill = () => {
        const q = f.q.toLowerCase();
        const rows = S.assets.filter((a) => (!f.cat || a.type === f.cat) && (!f.cond || cond(a.risk) === f.cond) && (!q || a.id.toLowerCase().includes(q)));
        $('#as-t').innerHTML = `<table style="min-width:760px">
          <thead><tr><th>Asset ID</th><th>Asset Type</th><th>Age</th><th>Last Maintenance</th><th>Condition</th><th>Risk Score</th><th>Actions</th></tr></thead>
          <tbody>` +
          (rows.length ? rows.map((a) => {
            const aId = a.id || a.assetId || a._id;
            return `<tr class="clickable" tabindex="0" data-open-asset="${aId}">
              <td class="id">${aId}</td>
              <td>${a.type || a.category || a.assetType || 'Track'}</td>
              <td>${a.age ?? '—'} years</td>
              <td class="num">${fmtD(a.last || a.lastInspectionDate)}</td>
              <td>${pill(cond(a.risk))}</td>
              <td class="num"><b>${a.risk ?? 0}%</b></td>
              <td>
                <div class="btn-row" style="flex-wrap:nowrap;align-items:center">
                  <button class="btn sm" data-open-asset="${aId}">View</button>
                  <button class="btn-del-icon" data-delete-asset="${aId}" title="Delete asset" aria-label="Delete">${ic('trash', 16)}</button>
                </div>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="7" class="empty">No assets match these filters.</td></tr>`) +
          `</tbody></table>`;

        $('#as-t').querySelectorAll('[data-delete-asset]').forEach((btn) => {
          btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteAsset(btn.getAttribute('data-delete-asset'));
          };
        });
      };
      fill();
      $('#as-q').oninput = (e) => { f.q = e.target.value; fill(); };
      $('#as-c').onchange = (e) => { f.cat = e.target.value; fill(); };
      $('#as-s').onchange = (e) => { f.cond = e.target.value; fill(); };
      $('#newAsset').onclick = () => {
        const nextId = (cat) => {
          const p = PREFIX[cat];
          const nums = S.assets.filter((a) => a.id.startsWith(p)).map((a) => +a.id.slice(4));
          return p + '_' + (Math.max(...nums, p === 'TRK' ? 100 : p === 'SIG' ? 200 : p === 'ELE' ? 300 : p === 'MEC' ? 400 : 500) + 1);
        };
        openModal(
          'Add Asset',
          `<form class="form" id="naf">
            <div class="form-2">
              ${fld('Category', `<select id="na-c">${opts(CATS, CATS[0])}</select>`)}
              ${fld('Asset ID', `<input id="na-i" value="${nextId(CATS[0])}" required>`)}
            </div>
            <div class="form-2">
              ${fld('Age (years)', `<input type="number" id="na-a" min="0" value="5" required>`)}
              ${fld('Risk score (%)', `<input type="number" id="na-r" min="0" max="100" value="30" required>`)}
            </div>
            ${fld('Last maintenance', `<input type="date" id="na-m" value="${addDays(TODAY, -30)}" required>`)}
            <div class="btn-row stretch" style="justify-content:flex-end">
              <button class="btn" type="button" data-close>Cancel</button>
              <button class="btn primary" type="submit">Add Asset</button>
            </div>
          </form>`
        );
        $('#na-c').onchange = (e) => { $('#na-i').value = nextId(e.target.value); };
        $('#naf').onsubmit = async (e) => {
          e.preventDefault();
          const id = $('#na-i').value.trim().toUpperCase();
          if (assetById(id)) {
            toast(`${id} already exists`);
            return;
          }

          const newAssetObj = {
            assetId: id,
            id,
            name: `${$('#na-c').value} Asset ${id}`,
            category: $('#na-c').value,
            type: $('#na-c').value,
            location: 'Main Line',
            age: +$('#na-a').value,
            lastInspectionDate: $('#na-m').value,
            last: $('#na-m').value,
            risk: clamp(+$('#na-r').value, 0, 100),
          };

          try {
            const token = await auth?.currentUser?.getIdToken();
            if (token) {
              const res = await fetch('/api/assets', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newAssetObj),
              });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.warn('Backend asset creation returned non-200:', errData?.error);
              } else {
                const created = await res.json().catch(() => ({}));
                if (created?.asset) {
                  Object.assign(newAssetObj, created.asset);
                }
              }
            }
          } catch (err) {
            console.warn('Backend asset creation notice:', err.message);
          }

          S.assets.push(newAssetObj);
          persist();
          closeLayers();
          toast(`${id} added`);
          render(true);
        };
      };
    };

    /* present risk scoring */
    function assess(a, issue) {
      const t = issue.toLowerCase();
      let sev = 55, sl = 'Moderate';
      if (/crack|fractur|broken|failure|burn|short|overheat|hot|collapse|spall|flat/.test(t)) {
        sev = 88; sl = 'Severe';
      } else if (/wear|noise|loose|leak|vibrat|intermittent|drop|damage|heat/.test(t)) {
        sev = 68; sl = 'Significant';
      } else if (/minor|inspect|paint|routine/.test(t)) {
        sev = 35; sl = 'Minor';
      }
      const risk = Math.min(98, Math.round(0.45 * a.risk + 0.55 * sev)), cls = riskClass(risk), d = daysSince(a);
      return {
        risk,
        cls,
        within: { Critical: '24 hours', High: '3 days', Medium: '7 days', Low: '30 days' }[cls],
        factors: [
          { n: 'Issue severity', v: sl, p: sev },
          { n: 'Asset condition', v: a.risk + '% current risk', p: a.risk },
          { n: 'Time since maintenance', v: d + ' days', p: d / 1.5 },
        ],
      };
    }

    function riskResultHTML(res) {
      if (!res) return `<div class="result">${gauge(null)}<p class="muted">Choose a request and run the assessment.</p></div>`;
      return `<div class="result">
        ${gauge(res.risk, GCOL[res.cls])}
        <div>${pill(res.cls)}</div>
        ${factorsHTML(res.factors)}
        <div class="note">Recommended priority: ${res.cls}. Complete within ${res.within}.</div>
      </div>`;
    }
    const stepsHTML = (on) => `<div class="steps"><span class="${on >= 1 ? 'on' : ''}"><b>1</b>Existing Issue</span><span class="arr">›</span><span class="${on >= 2 ? 'on' : ''}"><b>2</b>Risk Assessment</span><span class="arr">›</span><span class="${on >= 3 ? 'on' : ''}"><b>3</b>Priority Recommendation</span></div>`;
    function riskHistHTML() {
      return `<table style="min-width:640px">
        <thead><tr><th>Date</th><th>Asset</th><th>Issue</th><th>Risk</th><th>Priority</th></tr></thead>
        <tbody>${S.riskHist.length ? S.riskHist.map((h) => `<tr><td class="num">${fmtD(h.date)}</td><td class="id">${h.asset}</td><td>${esc(h.issue)}</td><td class="num"><b>${h.risk}%</b></td><td>${pill(h.cls)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No assessment history recorded.</td></tr>'}</tbody>
      </table>`;
    }

    pages.risk = () => {
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
      <section class="card flush gap"><h2>Assessment History</h2><div class="tbl-wrap" id="rk-h">${riskHistHTML()}</div></section>`;
    };

    mounts.risk = () => {
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
        $('#rk-h').innerHTML = riskHistHTML();
        $('.steps').outerHTML = stepsHTML(3);
        animGauge();
        toast(`${a.id} is now ${cond(res.risk)} at ${res.risk}%. Priority set to ${res.cls}.`);
      };
    };

    /* future failure prediction */
    const series = (a) => {
      const h = hash(a ? a.id : 'AST');
      return Array.from({ length: 12 }, (_, i) => (i === 11 ? a.risk : clamp(Math.round(a.risk * (0.5 + (0.5 * i) / 11) + ((h >> (i % 8)) % 7) - 3), 5, 95)));
    };
    function predChartHTML(a, res) {
      if (!a) return '<p class="muted">No asset registered or selected.</p>';
      const hz = res ? res.h : S.ui.predH;
      return lineChart(series(a), { proj: res ? res.p : null, xl: [['Nov 2025', 0, 'l'], ['Today', res ? 82 : 100, res ? 'c' : 'r'], ...(res ? [[`+${hz} days`, 100, 'r']] : [])] });
    }
    function predResultHTML(a, res) {
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

    pages.prediction = () => {
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
        <section class="card"><h2>Risk Trend, Last 12 Months</h2><div id="pd-ch">${predChartHTML(a, res)}</div></section>
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
    };

    mounts.prediction = () => {
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
          addNotif('predicted', `High failure probability for ${a.id}`, `${p}% chance of failure within ${h} days.`, { t: 'asset', id: a.id });
        }
        persist();
        toast(`${a.id}: ${p}% failure probability in ${h} days`);
        render(true);
      };
    };

    /* block optimization */
    function optimize() {
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

    function laneHTML(name, items, s0, span) {
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

    pages.blocks = () => {
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
    };

    mounts.blocks = () => {
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
      $('#bk-run').onclick = () => { optimize(); render(true); };
      $('#bk-view-sch-modal')?.addEventListener('click', () => openSchedule(S.ui.bd, S.ui.bdept));
      V.querySelectorAll('[data-st]').forEach((s) => (s.onchange = async (e) => {
        const r = reqById(s.dataset.st), v = e.target.value;
        const prevStatus = r.status;
        if (v === 'Completed') {
          openComplete(r.id);
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
          if (v === 'Delayed') addNotif('delayed', `${r.id} is delayed`, `${r.type} on ${r.asset} did not finish on schedule.`, { t: 'request', id: r.id });
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
    };

    /* what-if simulator (PREDICTION ONLY - NO APPLY BUTTON) */
    function whatIfCalc(r, prop, assump) {
      const a = assetById(r.asset), extra = prop - r.dur;
      const base = conflictPairs(S.requests).filter((p) => p.includes(r)).length;
      const tmp = { ...r, dur: prop };
      const others = S.requests.filter((x) => x !== r);
      const hit = conflictPairs([...others, tmp]).filter((p) => p.includes(tmp));
      const risk = clamp(Math.round(a.risk + (extra > 0 ? extra * 0.15 : -extra * 0.2) + (assump === 'worse' ? 8 : assump === 'minor' ? -6 : 0)), 1, 99);
      const dis = Math.abs(extra) <= 15 ? 'Low' : Math.abs(extra) <= 45 ? 'Medium' : 'High';
      const trains = Math.max(0, Math.round(extra / 15));
      return { extra, base, conflicts: hit.length, hit, risk, orig: a.risk, dis, trains, end: mt(tm(r.start) + prop) };
    }

    pages.whatif = () => {
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
    };

    mounts.whatif = () => {
      const w = S.ui.wi;
      $('#wi-r').onchange = (e) => { w.id = e.target.value; w.prop = null; w.sim = null; render(true); };
      $('#wi-p').oninput = (e) => { w.prop = +e.target.value; };
      $('#wi-a').onchange = (e) => { w.assump = e.target.value; };
      $('#wi-sim').onclick = () => {
        const r = reqById(w.id);
        if (!r) return;
        const p = clamp(Math.round(+$('#wi-p').value || r.dur), 10, 600);
        w.prop = p;
        w.sim = { ...whatIfCalc(r, p, w.assump), prop: p };
        render(true);
      };
      $('#wi-reset').onclick = () => { w.prop = null; w.assump = 'none'; w.sim = null; render(true); };
    };

    /* reports */
    const monthsBetween = (f, t) => {
      const o = [];
      let [y, m] = f.slice(0, 7).split('-').map(Number);
      const [ty, tmo] = t.slice(0, 7).split('-').map(Number);
      while ((y < ty || (y === ty && m <= tmo)) && o.length < 12) {
        o.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
      return o;
    };
    /* reports */
    let isFetchingReports = false;
    async function fetchReportsData() {
      if (isFetchingReports) return;
      isFetchingReports = true;
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) {
          isFetchingReports = false;
          return;
        }

        const { from, to, dept } = S.ui.rp;
        const qParams = new URLSearchParams();
        if (from) qParams.set('from', from);
        if (to) qParams.set('to', to);
        if (dept) qParams.set('department', dept);

        const qs = qParams.toString() ? `?${qParams.toString()}` : '';
        const deptQs = dept ? `?department=${encodeURIComponent(dept)}` : '';
        const headers = { Authorization: `Bearer ${token}` };

        const [ovRes, dpRes, trRes, asRes] = await Promise.all([
          fetch(`/api/reports/overview${qs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/reports/departments${qs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/reports/trends${qs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/reports/assets${deptQs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);

        S.rpData = {
          overview: ovRes,
          departments: dpRes,
          trends: trRes,
          assets: asRes,
          loaded: true,
        };
      } catch (err) {
        console.warn('Reports fetch error:', err.message);
      } finally {
        isFetchingReports = false;
        render(true);
      }
    }

    function repRows() {
      const { from, to, dept } = S.ui.rp;
      return S.requests
        .filter((r) => {
          const d = r.doneDate || r.date;
          if (from && d < from) return false;
          if (to && d > to) return false;
          if (dept && r.dept !== dept) return false;
          return r.status === 'Completed' || (r.date < TODAY);
        })
        .map((r) => ({
          id: r.id,
          asset: r.asset,
          dept: r.dept,
          date: r.status === 'Completed' ? (r.doneDate || r.date) : r.date,
          dur: r.status === 'Completed' ? (r.actual ?? r.dur) : r.dur,
          done: r.status === 'Completed',
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    pages.reports = () => {
      const f = S.ui.rp;
      if (!S.rpData && !isFetchingReports) {
        fetchReportsData();
      }

      const rows = repRows();
      const doneRows = rows.filter((r) => r.done);
      const overRows = rows.filter((r) => !r.done);

      // Prefer real API overview if available, fallback to local dataset
      const completedCount = S.rpData?.overview?.completedRequests ?? doneRows.length;
      const overdueCount = S.rpData?.overview?.overdueRequests ?? overRows.length;
      const avgDurationStr = S.rpData?.overview?.avgActualDuration != null
        ? `${S.rpData.overview.avgActualDuration} min`
        : (doneRows.length ? `${Math.round(doneRows.reduce((s, r) => s + (r.dur || 0), 0) / doneRows.length)} min` : '—');

      // Trends data from real API
      const trendItems = S.rpData?.trends?.trends || [];
      const trLabels = trendItems.map((t) => t.monthLabel.split(' ')[0]);
      const trCompleted = trendItems.map((t) => t.completedRequests);
      const trOverdue = trendItems.map((t) => t.overdueRequests);

      // Department performance from real API
      const deptItems = S.rpData?.departments?.departments || DEPTS.map((d) => {
        const dd = rows.filter((r) => r.dept === d);
        const c = dd.filter((r) => r.done).length;
        return {
          department: d,
          totalRequests: dd.length,
          completedRequests: c,
          completionRate: dd.length ? Math.round((c / dd.length) * 100) : 0,
        };
      });

      return `<div class="ph-row">
        <h1>Reports &amp; Analytics</h1>
      </div>
      <div class="toolbar">
        <input type="date" id="rp-f" value="${f.from}" aria-label="From date">
        <input type="date" id="rp-t" value="${f.to}" aria-label="To date">
        <select id="rp-d" aria-label="Department">${opts(DEPTS, f.dept, 'All departments')}</select>
      </div>
      <div class="stats three">
        ${stat('Completed Tasks', completedCount)}
        ${stat('Average Completion Time', avgDurationStr)}
        ${stat('Overdue Tasks', overdueCount)}
      </div>
      ${(trendItems.length || rows.length) ? `<div class="cols even gap" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
        <section class="card">
          <h2>Maintenance Completion Trends</h2>
          ${trendItems.length ? barChart(trLabels, trCompleted) : '<div class="empty small">No completion data</div>'}
        </section>
        <section class="card">
          <h2>Overdue Work Trends</h2>
          ${trendItems.length ? barChart(trLabels, trOverdue) : '<div class="empty small">No overdue trends</div>'}
        </section>
        <section class="card">
          <h2>Department Performance</h2>
          <div class="hb">
            ${deptItems.map((d) => {
              const name = SHORT[d.department] || d.department;
              const rate = d.completionRate;
              const isZero = d.totalRequests === 0;
              return `<div class="r">
                <b>${name}</b>
                <span>${isZero ? 'No tasks' : `${rate}% (${d.completedRequests}/${d.totalRequests})`}</span>
                <div class="meter"><i style="width:${isZero ? 0 : rate}%"></i></div>
              </div>`;
            }).join('')}
          </div>
        </section>
      </div>` : `<div class="card gap empty">No records found for the selected range.</div>`}
      <section class="card flush gap">
        <div class="ph-row" style="padding:18px 20px 0">
          <h2 style="margin:0">Completed and Overdue Work</h2>
          <button class="btn sm" id="rp-csv">${ic('download', 16)}Export CSV</button>
        </div>
        <div class="tbl-wrap" style="margin-top:12px">
          <table style="min-width:680px">
            <thead><tr><th>Request ID</th><th>Asset</th><th>Department</th><th>Completion Date</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              ${rows.length ? rows.slice(0, 40).map((r) => `<tr>
                <td class="id">${r.id}</td>
                <td>${r.asset}</td>
                <td>${r.dept}</td>
                <td class="num">${r.done ? fmtD(r.date) : '—'}</td>
                <td class="num">${r.done ? (r.dur ? r.dur + ' min' : '—') : '—'}</td>
                <td>${pill(r.done ? 'Completed' : 'Overdue')}</td>
              </tr>`).join('') : `<tr><td colspan="6" class="empty">No work in this range.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
    };

    mounts.reports = () => {
      const f = S.ui.rp;
      const rpf = $('#rp-f');
      if (rpf) {
        const updateFrom = (e) => {
          if (e.target.value && e.target.value !== f.from) {
            f.from = e.target.value;
            S.rpData = null;
            fetchReportsData();
          }
        };
        rpf.onchange = updateFrom;
        rpf.oninput = updateFrom;
      }
      const rpt = $('#rp-t');
      if (rpt) {
        const updateTo = (e) => {
          if (e.target.value && e.target.value !== f.to) {
            f.to = e.target.value;
            S.rpData = null;
            fetchReportsData();
          }
        };
        rpt.onchange = updateTo;
        rpt.oninput = updateTo;
      }
      const rpd = $('#rp-d');
      if (rpd) {
        rpd.onchange = (e) => {
          f.dept = e.target.value;
          S.rpData = null;
          fetchReportsData();
        };
      }
      const rpCsv = $('#rp-csv');
      if (rpCsv) {
        rpCsv.onclick = () => {
          const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const csv = [['Request ID', 'Asset', 'Department', 'Completion Date', 'Duration (min)', 'Status'].map(q).join(',')].concat(
            repRows().map((r) => [r.id, r.asset, r.dept, r.done ? fmtD(r.date) : '', r.done ? r.dur : '', r.done ? 'Completed' : 'Overdue'].map(q).join(','))
          ).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'railmaint-report.csv';
          a.click();
          URL.revokeObjectURL(url);
          toast('Report exported to CSV');
        };
      }
    };

    /* notifications */
    pages.notifications = () => {
      const N = S.notifs, un = N.filter((n) => !n.read).length, list = S.ui.nf === 'unread' ? N.filter((n) => !n.read) : N;
      return `<div class="ph-row">
        <h1>Notifications</h1>
        <button class="btn" id="nf-all" ${un ? '' : 'disabled'}>Mark All as Read</button>
      </div>
      <div class="seg" role="group" aria-label="Filter">
        <button data-nf="all" class="${S.ui.nf === 'all' ? 'on' : ''}">All</button>
        <button data-nf="unread" class="${S.ui.nf === 'unread' ? 'on' : ''}">Unread (${un})</button>
      </div>
      <div class="card flush">
        <ul class="nflist">
          ${list.length ? list.map((n) => `<li class="nf ${n.read ? '' : 'unread'}" data-n="${n.id}" tabindex="0">
            ${sevIcon(n.kind)}
            <div class="body">
              <div class="ti">${esc(n.title)}</div>
              <div class="ds">${esc(n.desc)}</div>
              <div class="meta"><span>${n.time}</span><span class="chip">${n.ref.id}</span></div>
            </div>
            ${n.read ? '' : `<div class="act"><button class="btn sm" data-mark="${n.id}">Mark as Read</button></div>`}
          </li>`).join('') : `<li class="empty">No unread notifications.</li>`}
        </ul>
      </div>`;
    };

    mounts.notifications = () => {
      V.querySelectorAll('[data-nf]').forEach((b) => (b.onclick = () => { S.ui.nf = b.dataset.nf; render(true); }));
      const markAllBtn = $('#nf-all');
      if (markAllBtn) {
        markAllBtn.onclick = async () => {
          S.notifs.forEach((n) => (n.read = true));
          persist();
          updateBell();
          render(true);
          try {
            const token = await auth?.currentUser?.getIdToken();
            if (token) {
              await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          } catch (e) {
            console.warn('Mark all read notice:', e.message);
          }
        };
      }
      V.querySelectorAll('.nf').forEach((li) => (li.onclick = async (e) => {
        const n = S.notifs.find((x) => x.id === li.dataset.n);
        if (!n) return;
        const markOnly = e.target.closest('[data-mark]');
        if (!n.read) {
          n.read = true;
          persist();
          updateBell();
          try {
            const token = await auth?.currentUser?.getIdToken();
            if (token) {
              await fetch(`/api/notifications/${n.id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          } catch (err) {
            console.warn('Mark read notice:', err.message);
          }
        }
        if (markOnly) {
          render(true);
          return;
        }
        if (n.ref) {
          openRef(n.ref);
        }
        render(true);
      }));
    };

    /* ---------- shell ---------- */
    const NAV = [
      ['dashboard', 'Dashboard Overview', 'grid'],
      ['requests', 'Maintenance Requests', 'clipboard'],
      ['blocks', 'Block Optimization', 'calendar'],
      ['assets', 'Asset Management', 'box'],
      ['risk', 'Present Risk Scoring', 'gauge'],
      ['prediction', 'Future Failure Prediction', 'trend'],
      ['whatif', 'What-If Simulator', 'sliders'],
      ['reports', 'Reports & Analytics', 'bars'],
      ['notifications', 'Notifications', 'bell'],
    ];

    const appEl = $('#app');
    $('#logo').textContent = 'R';
    $('#menuBtn').innerHTML = ic('menu');
    $('#logoutBtn').innerHTML = ic('logout', 18);
    $('#logoutBtn').onclick = () => {
      if (onLogout) onLogout();
    };

    $('#nav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}" data-k="${k}" title="${l}">${ic(i)}<span class="lbl">${l}</span></a>`).join('');

    let currentRoute = 'dashboard';
    const route = () => {
      const k = window.location.hash.slice(1);
      return pages[k] ? k : 'dashboard';
    };

    function render(keepScroll) {
      const k = route();
      currentRoute = k;
      root.querySelectorAll('#nav a').forEach((a) => {
        const on = a.dataset.k === k;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      V.innerHTML = pages[k]();
      mounts[k]?.();
      updateBell();
      if (keepScroll !== true) {
        window.scrollTo(0, 0);
        appEl.classList.remove('nav-open');
      }
    }

    const mobile = () => matchMedia('(max-width:900px)').matches;
    $('#menuBtn').onclick = () => {
      if (mobile()) appEl.classList.toggle('nav-open');
      else appEl.classList.toggle('collapsed');
      $('#menuBtn').setAttribute('aria-expanded', String(mobile() ? appEl.classList.contains('nav-open') : !appEl.classList.contains('collapsed')));
    };
    $('#scrim').onclick = () => appEl.classList.remove('nav-open');

    const handleHash = () => render();
    window.addEventListener('hashchange', handleHash);

    const handleClick = (e) => {
      if (e.target.closest('[data-close]') || e.target.id === 'pl' || e.target.id === 'ml') {
        closeLayers();
        return;
      }
      const delAsset = e.target.closest('[data-delete-asset]');
      if (delAsset) {
        e.preventDefault();
        e.stopPropagation();
        deleteAsset(delAsset.getAttribute('data-delete-asset') || delAsset.dataset.deleteAsset);
        return;
      }
      const delReq = e.target.closest('[data-delete-req]');
      if (delReq) {
        e.preventDefault();
        e.stopPropagation();
        deleteRequest(delReq.getAttribute('data-delete-req') || delReq.dataset.deleteReq);
        return;
      }
      const dc = e.target.closest('[data-complete]');
      if (dc) {
        e.stopPropagation();
        openComplete(dc.dataset.complete);
        return;
      }
      const oa = e.target.closest('[data-open-asset]');
      if (oa) {
        e.stopPropagation();
        openAsset(oa.dataset.openAsset);
        return;
      }
      const orq = e.target.closest('[data-open-req]');
      if (orq && !e.target.closest('select')) {
        openRequest(orq.dataset.openReq);
        return;
      }
      const g = e.target.closest('[data-go]');
      if (g) {
        closeLayers();
        window.location.hash = '#' + g.dataset.go;
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeLayers();
        appEl.classList.remove('nav-open');
      }
      if (e.key === 'Enter' && e.target.matches('tr[tabindex],li[tabindex]')) {
        e.target.click();
      }
    };

    root.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    seed();
    render();

    return () => {
      window.removeEventListener('hashchange', handleHash);
      root.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onLogout]);

  return (
    <div ref={containerRef}>
      <div className="app" id="app">
        <aside className="sidebar" id="sidebar" aria-label="Main navigation">
          <div className="brand">
            <span className="logo" id="logo">R</span>
            <span className="lbl">RailMaint</span>
          </div>
          <nav className="nav" id="nav"></nav>
        </aside>
        <div className="scrim" id="scrim"></div>
        <div className="main">
          <header className="topbar">
            <button className="icon-btn" id="menuBtn" aria-label="Toggle navigation" aria-expanded="true"></button>
            <span className="sp"></span>
            <a className="icon-btn" id="bell" href="#notifications" aria-label="Notifications"></a>
            <div className="who">
              <div className="avatar">A</div>
              <span>{user?.email ? user.email.split('@')[0] : 'Admin'}</span>
              <button
                className="icon-btn"
                id="logoutBtn"
                title="Log Out"
                aria-label="Log Out"
                style={{ width: '38px', height: '38px', marginLeft: '4px' }}
              ></button>
            </div>
            <div className="track" aria-hidden="true">
              <div className="train">
                <svg viewBox="0 -6 400 34">
                  <defs>
                    <linearGradient id="bm" x1="0" x2="1">
                      <stop offset="0" stopColor="#FFD76A" stopOpacity=".8" />
                      <stop offset="1" stopColor="#FFD76A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points="361,19 400,12 400,28" fill="url(#bm)" />
                  <rect x="0" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="6" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="18" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="30" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="42" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="54" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="1" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="4" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="68" y="15" width="4" height="3" fill="#111827" />
                  <rect x="72" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="78" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="90" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="102" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="114" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="126" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="73" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="76" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="140" y="15" width="4" height="3" fill="#111827" />
                  <rect x="144" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="150" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="162" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="174" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="186" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="198" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="145" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="148" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="212" y="15" width="4" height="3" fill="#111827" />
                  <rect x="216" y="4" width="68" height="17" rx="3" fill="#fff" stroke="#D3D9E2" />
                  <rect x="222" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="234" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="246" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="258" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="270" y="8" width="8" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="217" y="14" width="66" height="3" fill="#FF700F" />
                  <rect x="220" y="21" width="60" height="2" rx="1" fill="#111827" />
                  <rect x="284" y="15" width="4" height="3" fill="#111827" />
                  <path d="M288 4H340Q356 5 361 15V21H288Z" fill="#fff" stroke="#D3D9E2" />
                  <path d="M341 7Q351 8 355 13H341Z" fill="#1B7CC4" />
                  <rect x="296" y="8" width="10" height="5" rx="1.2" fill="#1B7CC4" />
                  <rect x="312" y="8" width="10" height="5" rx="1.2" fill="#1B7CC4" />
                  <path d="M289 14H361V17H289Z" fill="#FF700F" />
                  <rect x="292" y="21" width="64" height="2" rx="1" fill="#111827" />
                  <rect x="317" y="-4" width="8" height="8" rx="1.5" fill="#111827" />
                  <rect x="315" y="-6" width="12" height="2.5" rx="1.2" fill="#111827" />
                  <rect x="317" y="0" width="8" height="1.6" fill="#FF700F" />
                  <circle cx="359" cy="19" r="1.6" fill="#FFE08A" />
                  <circle cx="10" cy="24.5" r="3" fill="#111827" /><circle cx="10" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="20" cy="24.5" r="3" fill="#111827" /><circle cx="20" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="48" cy="24.5" r="3" fill="#111827" /><circle cx="48" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="58" cy="24.5" r="3" fill="#111827" /><circle cx="58" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="82" cy="24.5" r="3" fill="#111827" /><circle cx="82" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="92" cy="24.5" r="3" fill="#111827" /><circle cx="92" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="120" cy="24.5" r="3" fill="#111827" /><circle cx="120" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="130" cy="24.5" r="3" fill="#111827" /><circle cx="130" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="154" cy="24.5" r="3" fill="#111827" /><circle cx="154" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="164" cy="24.5" r="3" fill="#111827" /><circle cx="164" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="192" cy="24.5" r="3" fill="#111827" /><circle cx="192" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="202" cy="24.5" r="3" fill="#111827" /><circle cx="202" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="226" cy="24.5" r="3" fill="#111827" /><circle cx="226" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="236" cy="24.5" r="3" fill="#111827" /><circle cx="236" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="264" cy="24.5" r="3" fill="#111827" /><circle cx="264" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="274" cy="24.5" r="3" fill="#111827" /><circle cx="274" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="300" cy="24.5" r="3" fill="#111827" /><circle cx="300" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="312" cy="24.5" r="3" fill="#111827" /><circle cx="312" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="340" cy="24.5" r="3" fill="#111827" /><circle cx="340" cy="24.5" r="1.2" fill="#FF700F" />
                  <circle cx="350" cy="24.5" r="3" fill="#111827" /><circle cx="350" cy="24.5" r="1.2" fill="#FF700F" />
                </svg>
                <i className="puff"></i>
                <i className="puff" style={{ animationDelay: '.6s' }}></i>
                <i className="puff" style={{ animationDelay: '1.2s' }}></i>
                <i className="puff" style={{ animationDelay: '1.8s' }}></i>
              </div>
            </div>
          </header>
          <main className="page" id="view"></main>
        </div>
      </div>
      <div className="layer" id="pl">
        <aside className="panel" id="panel" aria-label="Details"></aside>
      </div>
      <div className="layer" id="ml">
        <div className="modal-box" id="modal" role="dialog" aria-modal="true"></div>
      </div>
      <div id="toast" role="status" aria-live="polite"></div>
    </div>
  );
}
