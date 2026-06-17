// src/ebayScraper.js
// Fetches real sold prices from eBay UK for a given item name.
// Uses only Node's built-in fetch — no npm packages required.

const cache = new Map();

/**
 * Fetch the median sold price (GBP) for an item from eBay UK sold listings.
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

  const url =
    `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(itemName)}&LH_Sold=1&LH_Complete=1&_sacat=0`;

  let html;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    html = await response.text();
  } catch (err) {
    console.warn(`[ebayScraper] fetch failed for "${itemName}":`, err.message);
    return null;
  }

  // Extract all £ price strings from the HTML
  const priceRegex = /£([\d,]+(?:\.\d+)?)/g;
  const prices = [];
  let match;
  while ((match = priceRegex.exec(html)) !== null) {
    const value = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(value) && value >= 5 && value <= 10000) {
      prices.push(value);
    }
  }

  if (prices.length < 3) {
    console.warn(
      `[ebayScraper] Too few prices found for "${itemName}" (${prices.length}). Returning null.`,
    );
    return null;
  }

  const median = computeMedian(prices);
  cache.set(key, median);
  return median;
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
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
