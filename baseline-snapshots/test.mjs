import { createServer } from 'vite';

console.log('Testing Vite from baseline-snapshots...');
const server = await createServer({
  root: 'C:/RailMaint/frontend',
  server: { port: 5199 },
  logLevel: 'error'
});
await server.listen();
console.log('Vite listening on port 5199');
await server.close();
console.log('Vite closed successfully');

