import { randomDelay, randomTypingDelay } from './utils.js';

export async function ensureLoggedIn(page, email, password) {
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });

  if (!page.url().includes('/login')) {
    console.log('[auth] Already logged in, session restored.');
    return;
  }

  console.log('[auth] Not logged in — starting login flow.');

  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

  await page.type('#email', email, { delay: randomTypingDelay() });
  await page.type('#pass', password, { delay: randomTypingDelay() });

  await randomDelay(1000, 2500);
  await page.click('[name="login"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  const url = page.url();

  if (url.includes('/checkpoint/')) {
    console.error('[auth] Login challenge or 2FA detected. Please log in manually in a non-headless browser run (set HEADLESS=false), complete the challenge, then re-run.');
    process.exit(1);
  }

  const hasCaptcha = await page.$('iframe[src*="captcha"]');
  if (hasCaptcha) {
    console.error('[auth] CAPTCHA detected on login page. Please complete it manually (set HEADLESS=false) then re-run.');
    process.exit(1);
  }

  console.log('[auth] Login successful.');
}
