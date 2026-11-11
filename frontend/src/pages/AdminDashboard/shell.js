import { NAV, TODAY } from './lib/constants';
import { ic } from './lib/dom';
import { pageModules } from './pages';
import { seed as seedStore } from './lib/store';
import {
  syncMaintenanceRequests,
  syncAssets,
  syncNotifications as syncNotificationsApi,
} from './lib/api';

export function createShell(ctx) {
  const {
    root,
    state: S,
    closeLayers,
    helpers,
    modals,
    onLogout,
  } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const V = $('#view');
  const appEl = $('#app');

  const {
    openRequest,
    openComplete,
    openAsset,
    deleteRequest,
    deleteAsset,
  } = modals || helpers;

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

  function addNotif(kind, title, desc, ref) {
    S.notifs.unshift({ id: 'N' + Date.now() + Math.random().toString(36).slice(2, 5), kind, title, desc, time: 'Just now', ref, read: false });
    ctx.persist();
    updateBell();
  }

  function openRef(ref) {
    ref.t === 'request' ? (modals?.openRequest || openRequest)(ref.id) : (modals?.openAsset || openAsset)(ref.id);
  }

  if (helpers) {
    helpers.updateBell = updateBell;
    helpers.addNotif = addNotif;
    helpers.openRef = openRef;
  }

  const pages = {};
  const mounts = {};
  for (const [k, mod] of Object.entries(pageModules)) {
    pages[k] = () => mod.render(ctx);
    mounts[k] = () => mod.mount(ctx);
  }

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

  ctx.render = render;
  if (helpers) helpers.getCurrentRoute = () => currentRoute;

  function seed() {
    seedStore(S, ctx.persist);
    syncMaintenanceRequests({ auth: ctx.auth, state: S, persist: ctx.persist, render });
    syncAssets({ auth: ctx.auth, state: S, persist: ctx.persist, render, constants: { TODAY } });
    syncNotificationsApi({ auth: ctx.auth, state: S, persist: ctx.persist, render, helpers: { updateBell, getCurrentRoute: () => currentRoute } });
  }

  if (helpers) helpers.seed = seed;

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
}
