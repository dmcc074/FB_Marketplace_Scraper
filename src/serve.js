import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DASHBOARD = path.resolve(__dirname, '../dashboard/index.html');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');
const PORT = process.env.PORT ?? 3000;

async function readJSON(file) {
  try {
    return await fs.readFile(path.join(DATA_DIR, file), 'utf8');
  } catch {
    return 'null';
  }
}

async function readPortfolio() {
  try {
    const raw = await fs.readFile(PORTFOLIO_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writePortfolio(items) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PORTFOLIO_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // ── GET routes ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (url === '/api/profit') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(await readJSON('profit_latest.json'));
    } else if (url === '/api/listings') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(await readJSON('results_latest.json'));
    } else if (url === '/api/portfolio') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await readPortfolio()));
    } else if (url === '/' || url === '/index.html') {
      try {
        const html = await fs.readFile(DASHBOARD, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
      } catch {
        res.writeHead(404).end('Dashboard not found');
      }
    } else {
      res.writeHead(404).end();
    }
    return;
  }

  // ── POST routes ───────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { res.writeHead(400).end('Bad JSON'); return; }

    const portfolio = await readPortfolio();

    if (url === '/api/portfolio/buy') {
      const entry = {
        id: Date.now().toString(36),
        listingId:          body.listingId ?? null,
        title:              body.title ?? null,
        matchedItem:        body.matchedItem ?? null,
        imageUrl:           body.imageUrl ?? null,
        listingUrl:         body.listingUrl ?? null,
        buyPrice:           Number(body.buyPrice),
        boughtAt:           new Date().toISOString(),
        estimatedResaleGBP: body.estimatedResaleGBP ?? null,
        estimatedProfitGBP: body.estimatedProfitGBP ?? null,
        roiPercent:         body.roiPercent ?? null,
        status:             'purchased',
        listedPrice:        null,
        listedAt:           null,
        soldPrice:          null,
        soldAt:             null,
        actualProfitGBP:    null,
      };
      portfolio.push(entry);
      await writePortfolio(portfolio);
      res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify(entry));

    } else if (url === '/api/portfolio/update') {
      const idx = portfolio.findIndex(e => e.id === body.id);
      if (idx === -1) { res.writeHead(404).end('Not found'); return; }

      const entry = portfolio[idx];

      if (body.action === 'listed') {
        entry.status      = 'listed';
        entry.listedPrice = Number(body.listedPrice);
        entry.listedAt    = new Date().toISOString();
      } else if (body.action === 'sold') {
        entry.status         = 'sold';
        entry.soldPrice      = Number(body.soldPrice);
        entry.soldAt         = new Date().toISOString();
        // eBay fee ~12.8% + £10 postage
        const net            = Math.round(entry.soldPrice * 0.872 - 10);
        entry.actualProfitGBP = net - entry.buyPrice;
      } else if (body.action === 'delete') {
        portfolio.splice(idx, 1);
        await writePortfolio(portfolio);
        res.writeHead(200).end('{}');
        return;
      }

      portfolio[idx] = entry;
      await writePortfolio(portfolio);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(entry));
    } else {
      res.writeHead(404).end();
    }
    return;
  }

  res.writeHead(405).end();
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
