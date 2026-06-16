import 'dotenv/config';
import { launchBrowser } from './browser.js';
import { ensureLoggedIn } from './auth.js';
import { scrapeKeyword } from './scraper.js';
import { saveResults } from './output.js';
import { randomDelay, deduplicateById } from './utils.js';

const KEYWORDS = [
  'pc', 'computer', 'motherboard', 'cpu', 'ram',
  'nvidia', 'rtx', 'amd', 'tech', 'mini pc', 'laptop',
  'desktop', 'server', '16GB', '32GB', '8GB',
];

const { FB_EMAIL, FB_PASSWORD } = process.env;

if (!FB_EMAIL || !FB_PASSWORD) {
  console.error('FB_EMAIL and FB_PASSWORD must be set in .env');
  process.exit(1);
}

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
  console.log('[index] Done.');
} finally {
  await browser.close();
}
