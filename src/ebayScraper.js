// src/ebayScraper.js
// Fetches real sold prices from eBay UK for a given item name.
// Uses only Node's built-in fetch — no npm packages required.

import { RateLimiter } from './utils.js';

const cache = new Map();
// eBay will block rapid requests — enforce a minimum gap between fetches.
const ebayLimiter = new RateLimiter(3000, 6000);

/**
 * Fetch the median sold price (GBP) for an item from eBay UK sold listings.
 * UK-only sellers, 60 results, outlier-filtered via IQR before taking median.
 * Returns a number, or null if the lookup fails or yields too few prices.
 *
 * @param {string} itemName
 * @returns {Promise<number|null>}
 */
export async function fetchEbaySoldPrice(itemName) {
  const key = itemName.toLowerCase().trim();

  if (cache.has(key)) {
    return cache.get(key);
  }

  await ebayLimiter.wait();

  // LH_Sold=1         — completed/sold listings only
  // LH_Complete=1     — required alongside LH_Sold
  // LH_ItemLocation=1 — items physically located in the UK only
  // _ipg=60           — 60 results per page (more data points)
  // _sop=13           — sort by recently sold for fresh prices
  const url =
    `https://www.ebay.co.uk/sch/i.html` +
    `?_nkw=${encodeURIComponent(itemName)}` +
    `&LH_Sold=1&LH_Complete=1` +
    `&LH_ItemLocation=1` +
    `&_ipg=60&_sop=13&_sacat=0`;

  let html;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    });
    if (!response.ok) {
      console.warn(`[ebayScraper] HTTP ${response.status} for "${itemName}"`);
      return null;
    }
    html = await response.text();
  } catch (err) {
    console.warn(`[ebayScraper] fetch failed for "${itemName}":`, err.message);
    return null;
  }

  const prices = extractSoldPrices(html);

  if (prices.length < 3) {
    console.warn(
      `[ebayScraper] Too few prices found for "${itemName}" (${prices.length}). Returning null.`,
    );
    return null;
  }

  const filtered = iqrFilter(prices);
  const median = computeMedian(filtered.length >= 3 ? filtered : prices);

  console.log(
    `[ebayScraper] "${itemName}": ${prices.length} raw → ${filtered.length} after IQR → median £${median}`,
  );

  cache.set(key, median);
  return median;
}

/**
 * Extract sold prices from eBay UK HTML.
 *
 * Strategy (most-precise to least-precise):
 *  1. Prices inside s-item__price spans — the listing price cell for each row.
 *  2. POSITIVE-class spans — green "sold for" price on completed listings.
 *  3. JSON-LD "@type":"Offer" price fields embedded by eBay.
 *
 * Shipping costs, navigation prices, and "was" struck-through prices are
 * excluded by targeting only these specific structural patterns.
 *
 * @param {string} html
 * @returns {number[]}
 */
function extractSoldPrices(html) {
  const prices = new Set();

  // 1. s-item__price spans — the primary price cell for each listing row.
  //    Handles single prices and "£100.00 to £150.00" ranges (takes lower bound).
  const itemPriceRe = /s-item__price[^>]*>([\s\S]*?)<\/span>/gi;
  let m;
  while ((m = itemPriceRe.exec(html)) !== null) {
    const p = parsePoundAmount(m[1]);
    if (p !== null) prices.add(p);
  }

  // 2. POSITIVE class — eBay marks the actual transaction price in green.
  if (prices.size < 5) {
    const positiveRe = /class="POSITIVE"[^>]*>([\s\S]*?)<\/span>/gi;
    while ((m = positiveRe.exec(html)) !== null) {
      const p = parsePoundAmount(m[1]);
      if (p !== null) prices.add(p);
    }
  }

  // 3. JSON-LD embedded by eBay — reliable but not always present.
  if (prices.size < 5) {
    const jsonLdRe = /"price"\s*:\s*"([\d.]+)"/g;
    while ((m = jsonLdRe.exec(html)) !== null) {
      const v = parseFloat(m[1]);
      if (!isNaN(v) && v >= 5 && v <= 15000) prices.add(v);
    }
  }

  return [...prices];
}

/**
 * Parse the first £-denominated amount from a HTML fragment.
 * Returns null if none found or value is outside a sane item range.
 * @param {string} fragment
 * @returns {number|null}
 */
function parsePoundAmount(fragment) {
  const text = fragment.replace(/<[^>]+>/g, ' ');
  const match = /£([\d,]+(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const v = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(v) || v < 5 || v > 15000) return null;
  return v;
}

/**
 * Remove statistical outliers using the IQR method.
 * Values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR] are discarded.
 * @param {number[]} values
 * @returns {number[]}
 */
function iqrFilter(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter(v => v >= lo && v <= hi);
}

/**
 * Compute the median of an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
function computeMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}
