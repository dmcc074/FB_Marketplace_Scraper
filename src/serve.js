import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DASHBOARD = path.resolve(__dirname, '../dashboard/index.html');
const PORT = process.env.PORT ?? 3000;

async function readJSON(file) {
  try {
    return await fs.readFile(path.join(DATA_DIR, file), 'utf8');
  } catch {
    return 'null';
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }

  if (req.url === '/api/profit') {
    const body = await readJSON('profit_latest.json');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  } else if (req.url === '/api/listings') {
    const body = await readJSON('results_latest.json');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  } else if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = await fs.readFile(DASHBOARD, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    } catch {
      res.writeHead(404).end('Dashboard not found');
    }
  } else {
    res.writeHead(404).end();
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
