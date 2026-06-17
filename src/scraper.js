import { extractListing } from './extractor.js';
import { randomDelay, isUKListing } from './utils.js';
import { ensureLoggedIn } from './auth.js';

const SCROLL_ROUNDS = parseInt(process.env.SCROLL_ROUNDS ?? '3', 10);
const RADIUS = process.env.RADIUS ?? '10';
const CITY_SLUG = process.env.CITY_SLUG ?? 'belfast';

function buildSearchUrl(keyword) {
  const params = new URLSearchParams({
    query: keyword,
    radius: RADIUS,
    daysSinceListed: '30',
  });
  return `https://www.facebook.com/marketplace/${CITY_SLUG}/search/?${params.toString()}`;
}

export async function scrapeKeyword(page, keyword) {
  const url = buildSearchUrl(keyword);
  console.log(`[scraper] Searching: "${keyword}" → ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3500);

    if (page.url().includes('/login')) {
      console.warn('[scraper] Session expired mid-run, re-logging in...');
      await ensureLoggedIn(page, process.env.FB_EMAIL, process.env.FB_PASSWORD);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 3500);
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
      if (!listing) continue;
      if (isUKListing(listing)) {
        results.push(listing);
      } else {
        console.log(`[scraper] Filtered out: price="${listing.price}" location="${listing.location}"`);
      }
    }

    console.log(`[scraper] ${results.length} UK listings kept for "${keyword}" (after location filter).`);
    return results;
  } catch (err) {
    console.error(`[scraper] Error scraping "${keyword}": ${err.message}`);
    return [];
  }
}
