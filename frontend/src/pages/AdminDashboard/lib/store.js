import { TODAY, STORAGE_KEY } from './constants';
import { addDays } from './format';

export const DEFAULT_ASSETS = [
  { id: 'TRK_101', assetId: 'TRK_101', name: 'Track Section TRK_101', type: 'Track', category: 'Track', age: 4, last: addDays(TODAY, -20), risk: 28 },
  { id: 'SIG_201', assetId: 'SIG_201', name: 'Interlocking Signal SIG_201', type: 'Signals & Communication', category: 'Signals & Communication', age: 3, last: addDays(TODAY, -45), risk: 42 },
  { id: 'ELE_301', assetId: 'ELE_301', name: 'Traction Substation ELE_301', type: 'Electrical & Power', category: 'Electrical & Power', age: 6, last: addDays(TODAY, -15), risk: 65 },
  { id: 'MEC_401', assetId: 'MEC_401', name: 'Switch Machine MEC_401', type: 'Mechanical', category: 'Mechanical', age: 2, last: addDays(TODAY, -10), risk: 18 },
  { id: 'BRG_501', assetId: 'BRG_501', name: 'Steel Girder Bridge BRG_501', type: 'Bridges', category: 'Bridges', age: 8, last: addDays(TODAY, -60), risk: 78 },
];

export function createInitialState() {
  return {
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
}

export function persist(S) {
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

export function seed(S, persistFn) {
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
    if (persistFn) persistFn();
    else persist(S);
  }
}

export const assetById = (S, id) => S.assets.find((a) => a.id === id || a.assetId === id || String(a._id) === id);
export const reqById = (S, id) => S.requests.find((r) => r.id === id || String(r._id) === id);

export function reportRows(S) {
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
