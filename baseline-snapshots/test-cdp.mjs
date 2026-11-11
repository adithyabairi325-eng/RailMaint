import { spawn } from 'child_process';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\RailMaint\\baseline-snapshots\\.chrome-temp';

if (!fs.existsSync(TEMP_USER_DATA)) {
  fs.mkdirSync(TEMP_USER_DATA, { recursive: true });
}

console.log('Starting Vite server...');
const vite = await createServer({
  root: 'C:/RailMaint/frontend',
  server: { port: 5198 },
  logLevel: 'error',
  plugins: [{
    name: 'test-harness-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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
    import AdminDashboard from '/src/pages/AdminDashboard/AdminDashboard.jsx';

    window.__init = () => {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(AdminDashboard, {
        user: { email: 'admin@railmaint.com' },
        onLogout: () => {}
      }));
    };
    window.__init();
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
console.log('Vite server running at http://localhost:5198');

console.log('Launching headless Chrome...');
const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${TEMP_USER_DATA}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

let versionData = null;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (res.ok) {
      versionData = await res.json();
      break;
    }
  } catch {}
  await new Promise(r => setTimeout(r, 200));
}

if (!versionData) {
  console.error('Failed to connect to Chrome CDP');
  chrome.kill();
  await vite.close();
  process.exit(1);
}

console.log('Chrome connected. Opening harness tab...');
const targetRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5198/__harness', { method: 'PUT' });
const targetData = await targetRes.json();
const wsUrl = targetData.webSocketDebuggerUrl;

const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.onopen = resolve);

let msgId = 1;
function sendCommand(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await sendCommand('Runtime.enable');

// Wait for #view to exist in DOM
console.log('Waiting for #view...');
let viewExists = false;
for (let i = 0; i < 50; i++) {
  const evalRes = await sendCommand('Runtime.evaluate', {
    expression: 'Boolean(document.querySelector("#view") && document.querySelector("#view").innerHTML.length > 50)',
    returnByValue: true
  });
  if (evalRes?.result?.value) {
    viewExists = true;
    break;
  }
  await new Promise(r => setTimeout(r, 200));
}

console.log('#view exists:', viewExists);

const dashboardHTML = await sendCommand('Runtime.evaluate', {
  expression: 'document.querySelector("#view")?.innerHTML.slice(0, 100)',
  returnByValue: true
});
console.log('Dashboard HTML preview:', dashboardHTML?.result?.value);

ws.close();
chrome.kill();
await vite.close();
console.log('Test completed successfully!');
