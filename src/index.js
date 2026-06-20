import 'dotenv/config';
import { launchBrowser } from './browser.js';
import { ensureLoggedIn } from './auth.js';
import { scrapeKeyword } from './scraper.js';
import { saveResults, saveProfitReport } from './output.js';
import { randomDelay, deduplicateById } from './utils.js';
import { analyseProfit } from './profitAnalyser.js';
import { notifyDeals } from './notifier.js';

const KEYWORDS = [
  // Individual GPUs — find single-card sellers, not whole PCs
  'rtx 3060', 'rtx 3070', 'rtx 3080',
  'rtx 4060', 'rtx 4070', 'rtx 4080',
  'rx 6700', 'rx 6800', 'rx 6900', 'rx 7800',
  'graphics card', 'gpu',
  // Individual CPUs
  'ryzen 5600', 'ryzen 5800', 'ryzen 7600', 'ryzen 7800x3d',
  // Apple
  'macbook',
  // Laptops
  'gaming laptop', 'dell xps', 'thinkpad',
  // PC
  'gaming pc', 'pc', 'desktop', 'computer',
  // Guitar Pedals
  ''
];

const { FB_EMAIL, FB_PASSWORD } = process.env;

if (!FB_EMAIL || !FB_PASSWORD) {
  console.error('FB_EMAIL and FB_PASSWORD must be set in .env');
  process.exit(1);
}

async function run() {
  const { browser, page } = await launchBrowser();

  try {
    await ensureLoggedIn(page, FB_EMAIL, FB_PASSWORD);

    const allListings = [];

    for (const keyword of KEYWORDS) {
      const results = await scrapeKeyword(page, keyword);
      allListings.push(...results);
      console.log(`[index] "${keyword}" → ${results.length} listings (total so far: ${allListings.length})`);
      await randomDelay(3000, 7000);
    }

    const deduped = deduplicateById(allListings);
    console.log(`[index] Deduplication: ${allListings.length} → ${deduped.length} unique listings.`);

    await saveResults(deduped);

    const dealsByKeyword = await analyseProfit(deduped, page);
    const totalDeals = Object.values(dealsByKeyword).reduce((n, arr) => n + arr.length, 0);
    console.log(`[index] Found ${totalDeals} potentially profitable deals across ${Object.keys(dealsByKeyword).length} keyword(s).`);
    await saveProfitReport(dealsByKeyword);
    await notifyDeals(dealsByKeyword);

    console.log('[index] Done.');
  } finally {
    await browser.close();
  }
}

const INTERVAL_HOURS = parseFloat(process.env.RUN_INTERVAL_HOURS ?? '0');

if (INTERVAL_HOURS > 0) {
  console.log(`[scheduler] Running every ${INTERVAL_HOURS}h. Press Ctrl+C to stop.`);
  while (true) {
    await run();
    const ms = INTERVAL_HOURS * 60 * 60 * 1000;
    const next = new Date(Date.now() + ms).toLocaleTimeString();
    console.log(`[scheduler] Next run at ${next}`);
    await new Promise(r => setTimeout(r, ms));
  }
} else {
  await run();
}
