import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, '../cookies/chrome-profile');

export async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false',
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  page.setDefaultNavigationTimeout(30000);

  return { browser, page };
}
