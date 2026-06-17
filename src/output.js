import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeToPath } from 'fast-csv';
import { sendEmailDigest } from './emailDigest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

const CSV_HEADERS = ['id', 'title', 'price', 'location', 'url', 'image', 'keyword', 'scrapedAt'];
const PROFIT_CSV_HEADERS = [
  'keyword', 'rank', 'matchedItem', 'condition', 'title', 'description', 'price',
  'estimatedResaleGBP', 'netAfterFeesGBP', 'estimatedProfitGBP', 'roiPercent',
  'location', 'url', 'scrapedAt',
];

export async function saveResults(listings) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(DATA_DIR, `results_${ts}.json`);
  const latestPath = path.join(DATA_DIR, 'results_latest.json');
  const json = JSON.stringify(listings, null, 2);

  await Promise.all([
    fs.writeFile(jsonPath, json, 'utf8'),
    fs.writeFile(latestPath, json, 'utf8'),
  ]);

  console.log(`[output] JSON saved → ${jsonPath}`);
  console.log(`[output] JSON saved → ${latestPath}`);

  if (process.env.OUTPUT_CSV === 'true') {
    const csvPath = path.join(DATA_DIR, `results_${ts}.csv`);
    await new Promise((resolve, reject) => {
      writeToPath(csvPath, listings, { headers: CSV_HEADERS })
        .on('error', reject)
        .on('finish', resolve);
    });
    console.log(`[output] CSV saved → ${csvPath}`);
  }
}

// dealsByKeyword: { [keyword]: deal[] } as returned by analyseProfit()
export async function saveProfitReport(dealsByKeyword) {
  const keywords = Object.keys(dealsByKeyword);
  if (!keywords.length) {
    console.log('[profit] No profitable deals found — skipping report.');
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });

  // Flatten with per-keyword rank for CSV / JSON
  const flat = [];
  for (const keyword of keywords) {
    dealsByKeyword[keyword].forEach((deal, i) => {
      flat.push({ keyword, rank: i + 1, ...deal });
    });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(DATA_DIR, `profit_${ts}.json`);
  const latestPath = path.join(DATA_DIR, 'profit_latest.json');
  const json = JSON.stringify(dealsByKeyword, null, 2);

  await Promise.all([
    fs.writeFile(jsonPath, json, 'utf8'),
    fs.writeFile(latestPath, json, 'utf8'),
  ]);

  console.log(`[profit] Report saved → ${jsonPath}`);

  if (process.env.OUTPUT_CSV === 'true') {
    const csvPath = path.join(DATA_DIR, `profit_${ts}.csv`);
    await new Promise((resolve, reject) => {
      writeToPath(csvPath, flat, { headers: PROFIT_CSV_HEADERS })
        .on('error', reject)
        .on('finish', resolve);
    });
    console.log(`[profit] CSV saved → ${csvPath}`);
  }

  console.log('\n[profit] Top deals by keyword:');
  for (const keyword of keywords) {
    console.log(`\n  [${keyword}]`);
    for (const deal of dealsByKeyword[keyword]) {
      console.log(
        `    #${flat.find(f => f.keyword === keyword && f.url === deal.url)?.rank} ${deal.matchedItem} [${deal.condition ?? 'used'}] | Buy @ ${deal.price} → Resell ~£${deal.estimatedResaleGBP} (net £${deal.netAfterFeesGBP}) | Profit £${deal.estimatedProfitGBP} | ${deal.title}`
      );
    }
  }

  await sendEmailDigest(dealsByKeyword);
}
