import { extractListing } from './extractor.js';
import { randomDelay, isUKListing } from './utils.js';
import { ensureLoggedIn } from './auth.js';

const SCROLL_ROUNDS = parseInt(process.env.SCROLL_ROUNDS ?? '3', 10);
const LAT = process.env.LATITUDE ?? '54.5973';
const LON = process.env.LONGITUDE ?? '-5.9301';
const RADIUS = process.env.RADIUS ?? '10';

function buildSearchUrl(keyword) {
  const params = new URLSearchParams({
    query: keyword,
    latitude: LAT,
    longitude: LON,
    radius: RADIUS,
    daysSinceListed: '30',
  });
  return `https://www.facebook.com/marketplace/category/search?${params.toString()}`;
}

export async function scrapeKeyword(page, keyword) {
  const url = buildSearchUrl(keyword);
  console.log(`[scraper] Searching: "${keyword}" → ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    if (page.url().includes('/login')) {
      console.warn('[scraper] Session expired mid-run, re-logging in...');
      await ensureLoggedIn(page, process.env.FB_EMAIL, process.env.FB_PASSWORD);
      await page.goto(url, { waitUntil: 'networkidle2' });
    }

    try {
      await page.waitForSelector('a[href*="/marketplace/item/"]', { timeout: 15000 });
    } catch {
      console.warn(`[scraper] No listings found for "${keyword}" — skipping.`);
      return [];
    }

    let prevCount = 0;
    for (let round = 0; round < SCROLL_ROUNDS; round++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(1500, 3000);
      const currentCount = await page.$$eval(
        'a[href*="/marketplace/item/"]',
        els => els.length
      );
      if (currentCount === prevCount) break;
      prevCount = currentCount;
    }

    const handles = await page.$$('a[href*="/marketplace/item/"]');
    console.log(`[scraper] Found ${handles.length} listing elements for "${keyword}".`);

    const results = [];
    for (const handle of handles) {
      const listing = await extractListing(handle, keyword);
      if (listing && isUKListing(listing)) results.push(listing);
    }

    console.log(`[scraper] ${results.length} UK listings kept for "${keyword}" (after location filter).`);
    return results;
  } catch (err) {
    console.error(`[scraper] Error scraping "${keyword}": ${err.message}`);
    return [];
  }
}
