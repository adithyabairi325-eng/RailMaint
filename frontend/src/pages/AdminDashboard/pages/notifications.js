import { sevIcon } from '../lib/dom';
import { esc } from '../lib/format';

export function render(ctx) {
  const S = ctx.state;
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
}

export function mount(ctx) {
  const { root, state: S, render, persist, auth, helpers } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const V = $('#view') || root.querySelector('#view');
  const updateBell = helpers?.updateBell || (() => {});
  const openRef = helpers?.openRef || (() => {});

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
}
