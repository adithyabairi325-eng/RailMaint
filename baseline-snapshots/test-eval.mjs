import { spawn } from 'child_process';
import { createServer } from 'vite';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\RailMaint\\baseline-snapshots\\.chrome-temp2';

const vite = await createServer({
  root: 'C:/RailMaint/frontend',
  server: { port: 5194 },
  logLevel: 'error',
  plugins: [{
    name: 'test-harness',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/__harness') {
          res.setHeader('Content-Type', 'text/html');
          const rawHtml = `<!doctype html>
<html><head><meta charset="UTF-8"/></head><body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import AdminDashboard from '/src/pages/AdminDashboard/AdminDashboard.jsx';
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AdminDashboard, { user: { email: 'admin@railmaint.com' }, onLogout: () => {} }));
  </script>
</body></html>`;
          res.end(await server.transformIndexHtml(req.url, rawHtml));
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
  '--remote-debugging-port=9224',
  `--user-data-dir=${TEMP_USER_DATA}`,
  '--disable-gpu',
  'about:blank'
]);

for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch('http://127.0.0.1:9224/json/version');
    if (res.ok) break;
  } catch {}
  await new Promise(r => setTimeout(r, 200));
}

const targetRes = await fetch('http://127.0.0.1:9224/json/new?http://localhost:5194/__harness', { method: 'PUT' });
const targetData = await targetRes.json();
const ws = new WebSocket(targetData.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

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
await new Promise(r => setTimeout(r, 1500));

const res = await sendCommand('Runtime.evaluate', {
  expression: `(async () => {
    console.log('Setting location.hash to #reports...');
    location.hash = '#reports';
    await new Promise(res => setTimeout(res, 500));
    console.log('Querying #view...');
    return document.querySelector('#view').innerHTML;
  })()`,
  awaitPromise: true,
  returnByValue: true
});

console.log('EVAL RESULT:', JSON.stringify(res, null, 2).slice(0, 300));

ws.close();
chrome.kill();
await vite.close();

