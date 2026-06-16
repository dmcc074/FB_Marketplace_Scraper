import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeToPath } from 'fast-csv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

const CSV_HEADERS = ['id', 'title', 'price', 'location', 'url', 'image', 'keyword', 'scrapedAt'];

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
