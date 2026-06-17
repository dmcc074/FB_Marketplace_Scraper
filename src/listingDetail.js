import { randomDelay } from './utils.js';

/**
 * Visit a Facebook Marketplace listing page and extract the seller's description.
 * Returns { description: string|null }.
 */
export async function fetchListingDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(800, 1500);

    return await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span[dir="auto"]')]
        .map(s => s.innerText.trim())
        .filter(s => s.length > 25);

      // Exclude prices, timestamps, short UI labels
      const isPrice = s => /^[£$€]/.test(s);
      const isDate  = s => /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s) ||
                           /(listed|ago|today|yesterday|just now)/i.test(s.slice(0, 40));
      const isNav   = s => /(Marketplace|Messenger|Facebook|See more|See less|Report|Share|Save)/i.test(s) && s.length < 40;

      const candidates = spans.filter(s => !isPrice(s) && !isDate(s) && !isNav(s));

      // Descriptions tend to be the longest user-written blocks
      candidates.sort((a, b) => b.length - a.length);

      const description = candidates.slice(0, 4).join('\n').slice(0, 600).trim();
      return { description: description || null };
    });
  } catch {
    return { description: null };
  }
}
