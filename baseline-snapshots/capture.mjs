import { spawn } from 'child_process';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SNAPSHOT_DIR = 'C:\\RailMaint\\baseline-snapshots';
const TEMP_USER_DATA = path.join(SNAPSHOT_DIR, '.chrome-temp');
const BASELINE_FILE = path.join(SNAPSHOT_DIR, 'baseline.json');

const SEED_DATA = {
  assets: [
    { id: 'TRK_101', assetId: 'TRK_101', name: 'Track Section TRK_101', type: 'Track', category: 'Track', age: 4, last: '2026-10-22', risk: 28 },
    { id: 'SIG_201', assetId: 'SIG_201', name: 'Interlocking Signal SIG_201', type: 'Signals & Communication', category: 'Signals & Communication', age: 3, last: '2026-09-27', risk: 42 },
    { id: 'ELE_301', assetId: 'ELE_301', name: 'Traction Substation ELE_301', type: 'Electrical & Power', category: 'Electrical & Power', age: 6, last: '2026-10-27', risk: 65 },
    { id: 'MEC_401', assetId: 'MEC_401', name: 'Switch Machine MEC_401', type: 'Mechanical', category: 'Mechanical', age: 2, last: '2026-11-01', risk: 18 },
    { id: 'BRG_501', assetId: 'BRG_501', name: 'Steel Girder Bridge BRG_501', type: 'Bridges', category: 'Bridges', age: 8, last: '2026-09-12', risk: 78 },
  ],
  requests: [
    { id: 'REQ-101', asset: 'TRK_101', dept: 'Engineering / Track', type: 'Rail replacement', pri: 'Critical', date: '2026-11-11', start: '10:00', dur: 120, status: 'Scheduled', desc: 'Cracked rail head repair.' },
    { id: 'REQ-102', asset: 'SIG_201', dept: 'Signal & Telecom', type: 'Signal repair', pri: 'High', date: '2026-11-11', start: '11:00', dur: 90, status: 'Scheduled', desc: 'Signal lamp filament failure.' },
    { id: 'REQ-103', asset: 'ELE_301', dept: 'Electrical / Traction', type: 'Transformer service', pri: 'Medium', date: '2026-11-10', start: '09:00', dur: 180, status: 'Completed', doneDate: '2026-11-10', actual: 160, note: 'Replaced bushings.', desc: 'Routine servicing.' },
    { id: 'REQ-104', asset: 'MEC_401', dept: 'Mechanical', type: 'Switch Machine repair', pri: 'Low', date: '2026-11-08', start: '14:00', dur: 60, status: 'Delayed', desc: 'Pending spare motor gears.' },
    { id: 'REQ-105', asset: 'BRG_501', dept: 'Bridges', type: 'Bearing replacement', pri: 'High', date: '2026-11-15', start: '', dur: 240, status: 'Pending', desc: 'Elastomeric bearing worn out.' }
  ],
  notifs: [
    { id: 'N1', kind: 'critical-risk', title: 'High risk asset', desc: 'BRG_501 reached 78% risk.', time: '10m ago', ref: { t: 'asset', id: 'BRG_501' }, read: false },
    { id: 'N2', kind: 'completed', title: 'REQ-103 completed', desc: 'Transformer service finished.', time: '1h ago', ref: { t: 'request', id: 'REQ-103' }, read: true }
  ],
  hist: [
    { id: 'H1', asset: 'TRK_101', dept: 'Engineering / Track', type: 'Fastener tightening', date: '2026-10-15', dur: 60, done: true }
  ],
  riskHist: [],
  predHist: []
};

export async function runSnapshots() {
  const seedJson = JSON.stringify(SEED_DATA);
  const vite = await createServer({
    root: 'C:/RailMaint/frontend',
    server: { port: 5195 },
    logLevel: 'error',
    plugins: [{
      name: 'snapshot-harness',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api')) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({}));
            return;
          }
          if (req.url === '/__harness') {
            res.setHeader('Content-Type', 'text/html');
            const rawHtml = `<!doctype html>
<html>
<head><meta charset="UTF-8"/></head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import { auth } from '/src/firebase/firebaseConfig.js';
    import AdminDashboard from '/src/pages/AdminDashboard/AdminDashboard.jsx';

    auth.currentUser = { getIdToken: async () => 'mock-admin-token' };

    localStorage.setItem('railmaint_user_store_v3', ${JSON.stringify(seedJson)});
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AdminDashboard, {
      user: { email: 'admin@railmaint.com' },
      onLogout: () => {}
    }));
  </script>
</body>
</html>`;
            const html = await server.transformIndexHtml(req.url, rawHtml);
            res.end(html);
            return;
          }
          next();
        });
      }
    }]
  });
  await vite.listen();

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9223',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9223/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  const targetRes = await fetch('http://127.0.0.1:9223/json/new?http://localhost:5195/__harness', { method: 'PUT' });
  const targetData = await targetRes.json();
  const ws = new WebSocket(targetData.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.onopen = resolve);

  let msgId = 1;
  const pendingCommands = new Map();
  ws.addEventListener('message', (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
    } else if (data.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', JSON.stringify(data.params.exceptionDetails));
    }
    if (data.id && pendingCommands.has(data.id)) {
      const { resolve, reject } = pendingCommands.get(data.id);
      pendingCommands.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  });

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingCommands.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  console.log('Sending Runtime.enable...');
  await sendCommand('Runtime.enable');
  console.log('Waiting for initial render...');

  // Wait for #view to exist and render
  for (let i = 0; i < 50; i++) {
    const r = await sendCommand('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector("#view") && document.querySelector("#view").innerHTML.length > 50)',
      returnByValue: true
    });
    if (r?.result?.value) {
      console.log('Initial render detected!');
      break;
    }
    await new Promise(res => setTimeout(res, 200));
  }

  async function evalJs(expr) {
    const res = await sendCommand('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    });
    if (res?.exceptionDetails) {
      console.error('JS EVAL EXCEPTION:', res.exceptionDetails);
    }
    return res?.result?.value;
  }

  const snapshots = { routes: {}, modals: {}, responsive: {} };

  // 1. Capture 9 routes
  const routes = ['dashboard','requests','blocks','assets','risk','prediction','whatif','reports','notifications'];
  for (const r of routes) {
    console.log(`Capturing route: #${r}...`);
    const html = await evalJs(`(async () => {
      location.hash = '#${r}';
      await new Promise(res => setTimeout(res, 500));
      return document.querySelector('#view').innerHTML;
    })()`);
    snapshots.routes[r] = html || '';
  }

  // 2. Modals capture
  // Request detail modal/panel
  console.log('Capturing modal: request_detail...');
  snapshots.modals['request_detail'] = await evalJs(`(async () => {
    location.hash = '#requests';
    await new Promise(res => setTimeout(res, 300));
    const el = document.querySelector('[data-open-req="REQ-101"]');
    if (el) el.click();
    await new Promise(res => setTimeout(res, 300));
    return document.querySelector('#panel')?.innerHTML || '';
  })()`);

  // Complete request modal
  console.log('Capturing modal: complete_request...');
  snapshots.modals['complete_request'] = await evalJs(`(async () => {
    const btn = document.querySelector('[data-complete="REQ-101"]');
    if (btn) btn.click();
    await new Promise(res => setTimeout(res, 300));
    return document.querySelector('#modal')?.innerHTML || '';
  })()`);

  await evalJs(`document.querySelector('[data-close]')?.click()`);

  // New request modal
  console.log('Capturing modal: new_request...');
  snapshots.modals['new_request'] = await evalJs(`(async () => {
    location.hash = '#requests';
    await new Promise(res => setTimeout(res, 300));
    document.querySelector('#newReq')?.click();
    await new Promise(res => setTimeout(res, 300));
    return document.querySelector('#modal')?.innerHTML || '';
  })()`);

  await evalJs(`document.querySelector('[data-close]')?.click()`);

  // Schedule modal (from blocks)
  console.log('Capturing modal: schedule_modal...');
  snapshots.modals['schedule_modal'] = await evalJs(`(async () => {
    location.hash = '#blocks';
    await new Promise(res => setTimeout(res, 300));
    document.querySelector('#openSch')?.click();
    await new Promise(res => setTimeout(res, 300));
    return document.querySelector('#modal')?.innerHTML || '';
  })()`);

  await evalJs(`document.querySelector('[data-close]')?.click()`);

  // Asset detail panel
  console.log('Capturing modal: asset_detail...');
  snapshots.modals['asset_detail'] = await evalJs(`(async () => {
    location.hash = '#assets';
    await new Promise(res => setTimeout(res, 300));
    const el = document.querySelector('[data-open-asset="TRK_101"]');
    if (el) el.click();
    await new Promise(res => setTimeout(res, 300));
    return document.querySelector('#panel')?.innerHTML || '';
  })()`);

  await evalJs(`document.querySelector('[data-close]')?.click()`);

  // Delete confirmation modal
  console.log('Capturing modal: delete_confirm...');
  snapshots.modals['delete_confirm'] = await evalJs(`(async () => {
    location.hash = '#requests';
    await new Promise(res => setTimeout(res, 300));
    const delBtn = document.querySelector('[data-delete-req="REQ-101"]');
    if (delBtn) delBtn.click();
    await new Promise(res => setTimeout(res, 300));
    return document.querySelector('#modal')?.innerHTML || '';
  })()`);

  await evalJs(`document.querySelector('[data-close]')?.click()`);

  // 3. Responsive at <=900px
  console.log('Testing responsive <=900px...');
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: true
  });

  snapshots.responsive = await evalJs(`(async () => {
    const menuBtn = document.querySelector('#menuBtn');
    menuBtn?.click();
    const hasNavOpen = document.querySelector('#app')?.classList.contains('nav-open');
    const scrim = document.querySelector('#scrim');
    scrim?.click();
    const closedAfterScrim = !document.querySelector('#app')?.classList.contains('nav-open');
    return { hasNavOpen, closedAfterScrim };
  })()`);
  console.log('Done captures!');

  ws.close();
  chrome.kill();
  await vite.close();

  return snapshots;
}

const isSaveMode = process.argv.includes('--save');
console.log(isSaveMode ? '=== CAPTURING BASELINE SNAPSHOTS ===' : '=== RUNNING VERIFICATION AGAINST BASELINE ===');

const current = await runSnapshots();

if (isSaveMode) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2), 'utf8');
  console.log(`Baseline saved successfully to ${BASELINE_FILE}`);
  for (const r of Object.keys(current.routes)) {
    console.log(`  Route #${r}: ${current.routes[r].length} chars`);
  }
  for (const m of Object.keys(current.modals)) {
    console.log(`  Modal ${m}: ${current.modals[m].length} chars`);
  }
  console.log(`Responsive check:`, current.responsive);
} else {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(`Error: Baseline file not found at ${BASELINE_FILE}. Run with --save first.`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));

  let diffs = 0;

  // Compare routes
  for (const r of Object.keys(baseline.routes)) {
    const b = baseline.routes[r];
    const c = current.routes[r];
    if (b !== c) {
      diffs++;
      console.error(`DIFF DETECTED in route: #${r}`);
      console.error(`Baseline len: ${b?.length}, Current len: ${c?.length}`);
      let diffIdx = -1;
      const minLen = Math.min(b?.length || 0, c?.length || 0);
      for (let i = 0; i < minLen; i++) {
        if (b[i] !== c[i]) { diffIdx = i; break; }
      }
      if (diffIdx >= 0) {
        console.error(`First diff at index ${diffIdx}:`);
        console.error(`Baseline: ...${b.slice(Math.max(0, diffIdx - 30), diffIdx + 30)}...`);
        console.error(`Current:  ...${c.slice(Math.max(0, diffIdx - 30), diffIdx + 30)}...`);
      }
    }
  }

  // Compare modals
  for (const m of Object.keys(baseline.modals)) {
    const b = baseline.modals[m];
    const c = current.modals[m];
    if (b !== c) {
      diffs++;
      console.error(`DIFF DETECTED in modal: ${m}`);
      console.error(`Baseline len: ${b?.length}, Current len: ${c?.length}`);
    }
  }

  // Compare responsive
  if (JSON.stringify(baseline.responsive) !== JSON.stringify(current.responsive)) {
    diffs++;
    console.error(`DIFF DETECTED in responsive behavior:`, { baseline: baseline.responsive, current: current.responsive });
  }

  if (diffs === 0) {
    console.log('PERFECT MATCH: Zero diff across all 9 routes, all modals, and responsive behavior!');
  } else {
    console.error(`FAILED: ${diffs} diff(s) found!`);
    process.exit(1);
  }
}
