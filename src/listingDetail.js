import { randomDelay } from './utils.js';

// Fingerprint of Facebook's cookie consent wall — used to detect and reject it.
const CONSENT_FINGERPRINT = 'We use cookies and similar technologies';

/**
 * If the current page is the Facebook cookie consent wall, attempt to dismiss
 * it by clicking "Allow all cookies". Returns true if it was handled.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<boolean>}
 */
async function dismissConsentWall(page) {
  const isConsentPage = await page.evaluate(
    fp => document.body?.innerText?.includes(fp),
    CONSENT_FINGERPRINT,
  ).catch(() => false);

  if (!isConsentPage) return false;

  console.log('[listingDetail] Cookie consent wall detected — attempting to dismiss.');

  // Try the "Allow all cookies" button first, then any primary/accept button.
  const selectors = [
    'button[data-cookiebanner="accept_button"]',
    'button[title="Allow all cookies"]',
    '[aria-label="Allow all cookies"]',
    // Generic: any button whose visible label contains "Allow" or "Accept"
    'button',
  ];

  for (const sel of selectors) {
    try {
      const buttons = await page.$$(sel);
      for (const btn of buttons) {
        const label = await btn.evaluate(el => el.innerText?.trim() ?? '');
        if (/allow all|accept all|accept cookies/i.test(label)) {
          await btn.click();
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 })
            .catch(() => randomDelay(1500, 2500));
          console.log('[listingDetail] Consent dismissed.');
          return true;
        }
      }
    } catch {
      // selector not found — try next
    }
  }

  console.warn('[listingDetail] Could not find a dismiss button for the consent wall.');
  return false;
}

/**
 * Visit a Facebook Marketplace listing page and extract the seller's description.
 * Returns { description: string|null }.
 */
export async function fetchListingDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(800, 1500);

    // Handle the cookie consent wall if Facebook intercepted the navigation.
    const wasConsent = await dismissConsentWall(page);
    if (wasConsent) {
      // Re-navigate to the listing now that consent is stored in the profile.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await randomDelay(800, 1500);
    }

    return await page.evaluate((consentFp) => {
      const spans = [...document.querySelectorAll('span[dir="auto"]')]
        .map(s => s.innerText.trim())
        .filter(s => s.length > 25);

      const isPrice   = s => /^[£$€]/.test(s);
      const isDate    = s =>
        /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s) ||
        /(listed|ago|today|yesterday|just now)/i.test(s.slice(0, 40));
      const isNav     = s =>
        /(Marketplace|Messenger|Facebook|See more|See less|Report|Share|Save)/i.test(s) &&
        s.length < 40;
      const isConsent = s => s.includes(consentFp);

      const candidates = spans.filter(
        s => !isPrice(s) && !isDate(s) && !isNav(s) && !isConsent(s),
      );

      candidates.sort((a, b) => b.length - a.length);

      const description = candidates.slice(0, 4).join('\n').slice(0, 600).trim();
      return { description: description || null };
    }, CONSENT_FINGERPRINT);
  } catch {
    return { description: null };
  }
}
