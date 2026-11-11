import React, { useEffect, useRef } from 'react';
import './AdminDashboard.css';
import { auth } from '../../firebase/firebaseConfig';
import {
  getToday,
  TODAY,
  DEPTS,
  CATS,
  CAT_DEPT,
  SHORT,
  PREFIX,
  WORK,
  PRI,
  RANK,
  MON,
  DEPT_TAG_CLASS,
  STORAGE_KEY,
  NAV,
} from './lib/constants';
import {
  fmtD,
  dm,
  tm,
  mt,
  to12,
  mt12,
  timeRange12,
  fmtDur,
  addDays,
  daysBetween,
  hash,
  clamp,
  esc,
} from './lib/format';
import {
  initDom,
  $,
  ic,
  dl,
  opts,
  fld,
  kpi,
  stat,
  toast,
  openPanel,
  openModal,
  closeLayers,
} from './lib/dom';
import {
  riskClass,
  cond,
  TONE,
  pill,
  GCOL,
  daysSince,
  prob,
  compat,
  sched,
  endOf,
  overlap,
  isDelayedTask,
  getRequestStatus,
  conflictPairs,
  blocksOf,
  assess,
  series,
  whatIfCalc as domainWhatIfCalc,
} from './lib/domain';
import {
  initCharts,
  gauge,
  animGauge,
  factorsHTML,
  lineChart,
  barChart,
} from './lib/charts';
import {
  DEFAULT_ASSETS,
  createInitialState,
  persist as persistStore,
  seed as seedStore,
  assetById as assetByIdStore,
  reqById as reqByIdStore,
  reportRows as reportRowsStore,
} from './lib/store';
import {
  fetchReportsData as fetchReportsDataApi,
  isFetchingReports,
  syncMaintenanceRequests,
  syncAssets,
  syncNotifications as syncNotificationsApi,
} from './lib/api';
import { pageModules } from './pages';
import { createModals } from './modals';

export default function AdminDashboard({ onLogout, user }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    initDom(root);
    initCharts(root);

    /* ---------- constants ---------- */

    /* ---------- helpers ---------- */

    /* ---------- domain rules (Single Location) ---------- */

    /* ---------- persistent JS data store (NO Location, Clean User Data) ---------- */
    const S = createInitialState();
    const persist = () => persistStore(S);
    const assetById = (id) => assetByIdStore(S, id);
    const reqById = (id) => reqByIdStore(S, id);
    const reportRows = () => reportRowsStore(S);

    function seed() {
      seedStore(S, persist);
      syncMaintenanceRequests({ auth, state: S, persist, render });
      syncAssets({ auth, state: S, persist, render, constants: { TODAY } });
      syncNotificationsApi({ auth, state: S, persist, render, helpers: { updateBell, getCurrentRoute: () => currentRoute } });
    }

    /* ---------- UI helpers ---------- */
    const V = $('#view');

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

    const ctx = {
      root,
      state: S,
      persist,
      render: (p) => render(p),
      toast,
      openModal,
      openPanel,
      closeLayers,
      auth,
      constants: {
        TODAY,
        DEPTS,
        CATS,
        CAT_DEPT,
        SHORT,
        PREFIX,
        WORK,
        PRI,
        RANK,
        MON,
        DEPT_TAG_CLASS,
        STORAGE_KEY,
        NAV,
      },
      helpers: {
        assetById,
        reqById,
        reportRows,
        updateBell,
        openRef,
        optimize,
        addNotif,
      },
      modals: {},
    };

    const modals = createModals(ctx);
    ctx.modals = modals;
    Object.assign(ctx.helpers, modals);
    const {
      openRequest,
      openNewRequest,
      openComplete,
      openSchedule,
      openAsset,
      confirmDelete,
      markCompleted,
      deleteRequest,
      deleteAsset,
    } = modals;

    /* ---------- pages ---------- */
    const pages = {};
    const mounts = {};
    for (const [k, mod] of Object.entries(pageModules)) {
      pages[k] = () => mod.render(ctx);
      mounts[k] = () => mod.mount(ctx);
    }

    /* ---------- shell ---------- */

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
