// src/rerunProfit.js
// Re-runs the profit analysis against fresh eBay sold prices without
// re-scraping Facebook Marketplace. Reads the most recent listings file
// (or a custom path passed as the first CLI argument).
//
// Usage:
//   node src/rerunProfit.js                        # uses data/results_latest.json
//   node src/rerunProfit.js data/results_XYZ.json  # uses a specific snapshot
//
// Always uses live eBay prices regardless of USE_LIVE_PRICES in .env.
// If FB_EMAIL + FB_PASSWORD are set a browser is launched to re-fetch
// listing descriptions (more accurate matching); otherwise title-only.

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyseProfit } from './profitAnalyser.js';
import { saveProfitReport } from './output.js';
import { notifyDeals } from './notifier.js';
import { launchBrowser } from './browser.js';
import { ensureLoggedIn } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

// Force live eBay prices for the whole process
process.env.USE_LIVE_PRICES = 'true';

async function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(DATA_DIR, 'results_latest.json');

  let listings;
  try {
    const raw = await fs.readFile(inputPath, 'utf8');
    listings = JSON.parse(raw);
  } catch (err) {
    console.error(`[rerunProfit] Could not read listings file: ${inputPath}`);
    console.error(err.message);
    process.exit(1);
  }

  console.log(`[rerunProfit] Loaded ${listings.length} listings from ${inputPath}`);

  const { FB_EMAIL, FB_PASSWORD } = process.env;
  const canUseBrowser = Boolean(FB_EMAIL && FB_PASSWORD);

  let browser = null;
  let page = null;

  if (canUseBrowser) {
    console.log('[rerunProfit] FB credentials found — launching browser for description re-fetch.');
    ({ browser, page } = await launchBrowser());
    await ensureLoggedIn(page, FB_EMAIL, FB_PASSWORD);
  } else {
    console.log('[rerunProfit] No FB credentials — running title-only matching (set FB_EMAIL + FB_PASSWORD for better accuracy).');
  }

  try {
    const dealsByKeyword = await analyseProfit(listings, page);
    const totalDeals = Object.values(dealsByKeyword).reduce((n, arr) => n + arr.length, 0);
    console.log(
      `[rerunProfit] Found ${totalDeals} profitable deals across ${Object.keys(dealsByKeyword).length} keyword(s).`,
    );
    await saveProfitReport(dealsByKeyword);
    await notifyDeals(dealsByKeyword);
    console.log('[rerunProfit] Done.');
  } finally {
    if (browser) await browser.close();
  }
}

main();
