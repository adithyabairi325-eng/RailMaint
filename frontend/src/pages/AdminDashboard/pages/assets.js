import { CATS, PREFIX, TODAY } from '../lib/constants';
import { cond, pill } from '../lib/domain';
import { esc, fmtD, addDays, clamp } from '../lib/format';
import { opts, stat, ic, fld } from '../lib/dom';

export function render(ctx) {
  const S = ctx.state;
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
}

export function mount(ctx) {
  const { root, state: S, render, persist, toast, openModal, closeLayers, auth, helpers, modals } = ctx;
  const $ = (s, r = root) => r.querySelector(s);
  const deleteAsset = modals?.deleteAsset || helpers?.deleteAsset;
  const assetById = helpers?.assetById || ((id) => S.assets.find((a) => a.id === id || a.assetId === id || String(a._id) === id));

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
        if (deleteAsset) deleteAsset(btn.getAttribute('data-delete-asset'));
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
}
