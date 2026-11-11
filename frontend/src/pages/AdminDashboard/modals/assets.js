import { cond, pill } from '../lib/domain';
import { reportRows as defaultReportRows } from '../lib/store';
import { fmtD, esc } from '../lib/format';
import { dl, ic } from '../lib/dom';

export function openAsset(ctx, id) {
  const { state: S, openPanel, helpers } = ctx;
  const assetById = helpers?.assetById || ((aId) => S.assets.find((a) => a.id === aId || a.assetId === aId || String(a._id) === aId));
  const reportRows = helpers?.reportRows || (() => defaultReportRows(S));
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



export function confirmDelete(ctx, title, message, onConfirm) {
  const { root, openModal, closeLayers } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
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



export function deleteAsset(ctx, id) {
      if (!id) return;
      const { state: S, auth, persist, closeLayers, toast, render, helpers, modals } = ctx;
      const assetById = helpers?.assetById || ((aId) => S.assets.find((a) => a.id === aId || a.assetId === aId || String(a._id) === aId));
      const confirmDeleteFn = modals?.confirmDelete || ((t, m, c) => confirmDelete(ctx, t, m, c));
      const a = assetById(id);
      const label = a ? `${a.id || a.assetId} (${a.type || a.category || 'Asset'})` : id;

      confirmDeleteFn('Delete Asset', `Are you sure you want to delete asset ${label}? This action cannot be undone.`, async () => {
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


