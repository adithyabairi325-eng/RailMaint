import { DEPTS, TODAY } from './constants';
import { esc, tm, mt, daysBetween, clamp, hash } from './format';

export const riskClass = (r) => (r >= 80 ? 'Critical' : r >= 60 ? 'High' : r >= 40 ? 'Medium' : 'Low');

export const cond = (r) => (r >= 80 ? 'Critical' : r >= 40 ? 'At Risk' : 'Healthy');

export const TONE = {
  Critical: 'crit', High: 'high', Medium: 'med', Low: 'low',
  Healthy: 'low', 'At Risk': 'high', Completed: 'low', 'In Progress': 'orange',
  Scheduled: 'info', Pending: 'neutral', Delayed: 'crit', Overdue: 'crit',
};

export const pill = (l) => `<span class="pill ${TONE[l] || 'info'}">${esc(l)}</span>`;

export const GCOL = { Critical: 'var(--crit)', High: 'var(--orange)', Medium: '#D9A400', Low: '#2E9E5B' };

export const daysSince = (a) => (a ? daysBetween(a.last, TODAY) : 0);

export const prob = (a, h) => (a ? clamp(Math.round(a.risk * 0.8 + a.age * 0.5 + daysSince(a) * 0.06 + h * 0.1 - 6), 3, 97) : 0);

export const compat = (a, b) => a === b || (a === DEPTS[0] && b === DEPTS[1]) || (a === DEPTS[1] && b === DEPTS[0]);

export const sched = (r) => r.start && r.status !== 'Completed';

export const endOf = (r) => tm(r.start) + r.dur;

// Single location: tasks on the same date overlap if time intervals overlap
export const overlap = (a, b) => a.date === b.date && tm(a.start) < endOf(b) && tm(b.start) < endOf(a);

export function isDelayedTask(r) {
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

export function getRequestStatus(r) {
  if (!r) return 'Scheduled';
  if (r.status === 'Completed') return 'Completed';
  if (isDelayedTask(r)) return 'Delayed';
  if (r.status === 'In Progress') return 'In Progress';
  return r.status || 'Scheduled';
}

export function conflictPairs(list) {
  const l = list.filter(sched), out = [];
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      if (!compat(l[i].dept, l[j].dept) && overlap(l[i], l[j])) out.push([l[i], l[j]]);
    }
  }
  return out;
}

export function blocksOf(list) {
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

export function assess(a, issue) {
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

export const series = (a) => {
  const h = hash(a ? a.id : 'AST');
  return Array.from({ length: 12 }, (_, i) => (i === 11 ? a.risk : clamp(Math.round(a.risk * (0.5 + (0.5 * i) / 11) + ((h >> (i % 8)) % 7) - 3), 5, 95)));
};

export function whatIfCalc(r, prop, assump, ctxOrRequests, maybeAsset) {
  let a, reqs;
  if (Array.isArray(ctxOrRequests)) {
    reqs = ctxOrRequests;
    a = maybeAsset;
  } else {
    const ctx = ctxOrRequests;
    a = ctx?.helpers?.assetById ? ctx.helpers.assetById(r.asset) : (ctx?.assetById ? ctx.assetById(r.asset) : null);
    reqs = ctx?.state?.requests || ctx?.requests || [];
  }
  const extra = prop - r.dur;
  const base = conflictPairs(reqs).filter((p) => p.includes(r)).length;
  const tmp = { ...r, dur: prop };
  const others = reqs.filter((x) => x !== r);
  const hit = conflictPairs([...others, tmp]).filter((p) => p.includes(tmp));
  const risk = clamp(Math.round(a.risk + (extra > 0 ? extra * 0.15 : -extra * 0.2) + (assump === 'worse' ? 8 : assump === 'minor' ? -6 : 0)), 1, 99);
  const dis = Math.abs(extra) <= 15 ? 'Low' : Math.abs(extra) <= 45 ? 'Medium' : 'High';
  const trains = Math.max(0, Math.round(extra / 15));
  return { extra, base, conflicts: hit.length, hit, risk, orig: a.risk, dis, trains, end: mt(tm(r.start) + prop) };
}
