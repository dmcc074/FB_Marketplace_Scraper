# FB Marketplace Scraper — Belfast

> A personal side project I built to automate finding profitable tech resell deals on Facebook Marketplace in Belfast. I got tired of manually checking listings every day and missing good deals, so I decided to automate the whole thing.

---

## What Is This?

This is a Node.js scraper that automatically searches Facebook Marketplace in Belfast for underpriced tech items — GPUs, CPUs, iPhones, MacBooks, consoles — and calculates how much profit you could make flipping them on eBay. If a deal clears your minimum profit threshold, it fires a Discord notification with all the details.

I built this as a personal project to learn more about web scraping, automation, and working with real-world messy data. It ended up being a lot more complex than I expected (Facebook really doesn't want you scraping it), but I learned a tonne along the way.

**What it does in plain English:**
1. Logs into your Facebook account
2. Searches Belfast Marketplace for a list of tech keywords
3. Filters out anything not in Northern Ireland
4. For each potentially profitable listing, visits the actual listing page to read the full description
5. Calculates estimated eBay resale value, fees, and profit
6. Sends Discord notifications for new deals
7. Saves everything to JSON/CSV files
8. Provides a local web dashboard to browse results and track purchases

---

## Features

- **Automated scraping** — runs on a schedule (every N hours) without any manual input
- **Profit analysis** — built-in resale price guide for 100+ tech items with condition multipliers
- **Description validation** — visits each matched listing's page to confirm the item is what the title claims (catches accessories misidentified as the actual device)
- **NI location filter** — whitelist of ~60 NI towns; Facebook's radius parameter doesn't actually restrict results reliably so results from Aberdeen, Bristol, London etc. were slipping through
- **Accessory filter** — rejects screen protectors, cases, chargers etc. that mention a device model but aren't the device itself
- **Bundle filter** — rejects GPUs/CPUs listed as part of a full gaming PC (can't value those accurately)
- **Discord notifications** — rich embeds with listing photo, profit breakdown, description snippet, and a direct link
- **Seen listings persistence** — only notifies you once per listing, not every run
- **Portfolio tracker** — track what you've bought, listed on eBay, and sold; calculates actual vs estimated profit
- **Web dashboard** — local single-page app to browse deals, all listings, and your portfolio
- **Email digest** — optional daily HTML email summary (requires SMTP config)
- **Rate limiting** — randomised delays between requests with automatic retry on Discord 429s
- **CSV + JSON output** — all results saved locally for further analysis

---

## Tech Stack

| Tool | Why |
|---|---|
| [Node.js](https://nodejs.org/) | Main runtime — ES modules throughout |
| [Puppeteer](https://pptr.dev/) | Headless Chrome for scraping Facebook (can't use plain `fetch` — it's all client-side rendered) |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable management |
| [fast-csv](https://c2fo.github.io/fast-csv/) | Writing results to CSV |
| [nodemailer](https://nodemailer.com/) | Email digest |
| Discord Webhooks | Notifications — no library needed, just a `POST` request |
| Vanilla Node.js `http` | Dashboard server — deliberately avoided Express to keep dependencies minimal |

---

## Project Structure

```
fb-scraper/
├── src/
│   ├── index.js            # Entry point — orchestrates the full run and scheduler
│   ├── browser.js          # Launches Puppeteer with the right options
│   ├── auth.js             # Facebook login and cookie persistence
│   ├── scraper.js          # Searches a keyword, scrolls, returns listing cards
│   ├── extractor.js        # Pulls title/price/location/condition from a listing card element
│   ├── listingDetail.js    # Visits individual listing pages to get the full description
│   ├── profitAnalyser.js   # Core logic — matches listings to the RESALE_GUIDE, calculates profit
│   ├── ebayScraper.js      # (Optional) Fetches live eBay UK sold prices
│   ├── notifier.js         # Sends Discord webhook embeds with rate limiting and 429 retry
│   ├── seenListings.js     # Persists seen listing IDs so we don't re-notify
│   ├── emailDigest.js      # Sends HTML email summary via nodemailer
│   ├── output.js           # Saves results to JSON and CSV files
│   ├── serve.js            # Minimal HTTP server for the dashboard and portfolio API
│   └── utils.js            # randomDelay, RateLimiter, isUKListing, isNIListing
├── dashboard/
│   └── index.html          # Single-page dashboard (vanilla JS, no framework)
├── data/                   # Auto-created — stores JSON/CSV output and portfolio
│   ├── results_latest.json
│   ├── profit_latest.json
│   ├── seen.json
│   └── portfolio.json
├── cookies/                # Auto-created — stores FB session cookies
├── .env                    # Your config (NOT committed to git)
├── .env.example            # Template to copy from
└── package.json
```

---

## Setup

### Prerequisites

- Node.js v18 or later
- A Facebook account (I use a dedicated account for this — keeps the main account safe)
- A Discord server with a webhook URL (optional but highly recommended)

### Install

```bash
git clone https://github.com/dmcc074/FB_Marketplace_Scraper.git
cd FB_Marketplace_Scraper
npm install
```

Puppeteer doesn't always bundle Chrome automatically. If the scraper errors on first run:

```bash
npx puppeteer browsers install chrome
```

### Configure

Create a `.env` file in the project root:

```env
# ── Facebook ──────────────────────────────────────────────────
FB_EMAIL=your_facebook_email@gmail.com
FB_PASSWORD=your_facebook_password

# ── Scraper options ───────────────────────────────────────────
HEADLESS=true            # false = watch the browser (useful for debugging)
SCROLL_ROUNDS=3          # How many times to scroll per keyword search
CITY_SLUG=belfast        # Facebook Marketplace city slug
RADIUS=30                # Search radius in km (FB doesn't always respect this — the NI filter handles it)

# ── Profit thresholds ─────────────────────────────────────────
MIN_PROFIT_GBP=40        # Minimum estimated profit to flag a deal
MIN_ROI_PERCENT=15       # Minimum return on investment %

# ── Live eBay prices ──────────────────────────────────────────
USE_LIVE_PRICES=false    # eBay blocks scrapers aggressively — leave false

# ── Scheduling ────────────────────────────────────────────────
RUN_INTERVAL_HOURS=12    # 0 = run once and exit

# ── Discord notifications (optional) ─────────────────────────
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_here

# ── Email digest (optional — leave blank to disable) ──────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password   # Gmail: use an App Password, not your real password
EMAIL_TO=your_email@gmail.com

# ── Rate limiting (increase if getting throttled) ─────────────
FB_DETAIL_DELAY_MIN_MS=2000
FB_DETAIL_DELAY_MAX_MS=4000
```

> **Gmail App Password:** Go to Google Account → Security → 2-Step Verification → App passwords. Generate one for "Mail". Use that as `EMAIL_PASS`.

---

## Running

### Run the scraper once

```bash
npm start
```

### Run on a schedule

Set `RUN_INTERVAL_HOURS=12` in `.env` — it loops indefinitely, sleeping between runs. Press `Ctrl+C` to stop.

### Start the dashboard

```bash
npm run dashboard
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The dashboard reads from the last scrape's output files, so run the scraper first.

---

## How It Works

### The Scraping Problem

Facebook Marketplace is entirely client-side rendered — a plain `fetch` or `curl` just returns a blank HTML shell. Puppeteer launches a real headless Chrome browser, which executes all of Facebook's JavaScript the same way a human would.

The browser logs in with your credentials on first run and saves the session cookies to disk. Subsequent runs reuse those cookies so it doesn't have to log in every time (Facebook gets suspicious if you log in too often from a headless browser).

**The search URL format that actually works:**

```
https://www.facebook.com/marketplace/belfast/search/?query=rtx+3070&radius=30&daysSinceListed=30
```

Using `/marketplace/belfast/` as a path prefix (a city slug) makes Facebook route the search server-side by city. I found that using lat/lon URL parameters was being overridden by my account's location. The city slug approach bypasses that.

### Location Filtering

Even with `radius=30`, Facebook was returning listings from all over the UK — Aberdeen, Bristol, London, Cardiff, you name it. I ended up scrapping the radius as the primary filter and instead built a **whitelist** of ~60 Northern Ireland town names. After scraping, any listing whose location doesn't match a recognisable NI place name gets dropped. This cut my results from ~650 down to ~375 in testing, all correctly local.

### Profit Analysis

For each listing that survives location filtering:

1. The title is tested against an **accessory filter** — listings for phone cases, screen protectors, chargers etc. that mention a device model are rejected before any further processing
2. The listing's page is fetched to get the **full description** (with a 2–4s rate-limited delay between each)
3. The combined title + description is matched against the **RESALE_GUIDE** — 100+ product patterns, ordered most-specific first within each category
4. A **bundle filter** rejects GPU/CPU components listed as part of a full PC (title or description mentions "gaming PC", "full setup", etc.)
5. **Condition** is detected from keywords in the combined text (`faulty`, `like_new`, `new`, `used`)
6. A **condition multiplier** is applied to the base resale estimate
7. **eBay fees** (~12.8% + estimated £10 postage) are deducted: `net = price × 0.872 − 10`
8. Listings below `MIN_PROFIT_GBP` or `MIN_ROI_PERCENT` are dropped

**Condition multipliers:**

| Condition | Detected by | Multiplier |
|---|---|---|
| New / sealed | "brand new", "BNIB", "sealed", "new in box" | 1.05× |
| Like new | "like new", "mint", "immaculate", "barely used" | 0.95× |
| Used | (default) | 1.00× |
| Faulty | "faulty", "broken", "for parts", "cracked", "water damage" | 0.35× |

### Rate Limiting

Three separate `RateLimiter` instances (from `utils.js`) enforce randomised delays:

| Target | Delay | Why |
|---|---|---|
| FB listing page fetches | 2–4s | Avoid triggering Facebook's bot detection |
| Discord webhook sends | 1.5–2.5s + 429 backoff | Discord rate limit is 30 req/min per webhook |
| eBay fetch (if enabled) | 3–6s | eBay blocks rapid requests |

The `RateLimiter` tracks the *earliest allowed next call time*, so if a page naturally takes longer than the gap (slow load), the next call proceeds immediately without stacking delays.

### Dashboard

A minimal HTTP server in `serve.js` (no Express — just Node's built-in `http` module) serves a single-page dashboard. Three tabs:

- **Top Deals** — grouped by search keyword, colour-coded by profit level, with the listing description visible on hover and a "Buy" button to add to portfolio
- **Portfolio** — tracks each purchase through its lifecycle: Purchased → Listed → Sold; actual profit is calculated as `soldPrice × 0.872 − 10 − buyPrice`
- **All Listings** — searchable/filterable table of every scraped listing from the last run

---

## Resale Guide Coverage

The `RESALE_GUIDE` in `profitAnalyser.js` covers estimated UK eBay sold prices for:

**GPUs**
- NVIDIA RTX 30 series (3050 → 3090 Ti)
- NVIDIA RTX 40 series (4050 → 4090)
- AMD RX 6000 series (6600 → 6950 XT)
- AMD RX 7000 series (7600 → 7900 XTX)

**CPUs**
- Intel Core 12th gen (i5-12600K, i7-12700K, i9-12900K)
- Intel Core 13th gen (i5-13600K, i7-13700K, i9-13900K)
- Intel Core 14th gen (i5-14600K, i7-14700K, i9-14900K)
- AMD Ryzen 5000 series (5600 → 5950X, 5800X3D)
- AMD Ryzen 7000 series (7600 → 7950X3D, 7800X3D)

**RAM:** DDR4 and DDR5 in 8/16/32/64GB

**Apple**
- iPhones 12 through 16 (all Pro/Plus/Mini variants)
- iPad Pro 11" and 12.9"/13"
- iPad Air 4th gen, M1, M2
- iPad mini 6
- MacBook Air M1, M2, M3
- MacBook Pro M-chip 13", 14", 16"

*(Intel MacBooks excluded — resale values are too inconsistent to estimate reliably)*

**Consoles**
- PS5 (disc and digital)
- Xbox Series X and Series S
- Nintendo Switch and Switch OLED
- Steam Deck and Steam Deck OLED

**Laptops:** Dell XPS 13/15, ThinkPad X1 Carbon

> Prices are static estimates based on UK eBay sold listings at time of writing. Update `RESALE_GUIDE` periodically as the market shifts.

---

## Things I Ran Into Building This

Some problems that took longer than expected to solve:

**Facebook ignoring location** — lat/lon URL parameters were being overridden by the account's saved location (mine was set to San Francisco from creating the account). Switching to the city-slug URL format fixed it.

**Title showing as price** — Facebook's listing cards have multiple `<span dir="auto">` elements with no distinguishing attributes. Some listings show a "was price" alongside the current price, so the second price was being picked up as the title. Fixed by filtering out *all* price-like spans before selecting the title.

**Mainland UK results everywhere** — as above, the `radius` parameter does basically nothing. Built a whitelist filter instead.

**False positives from accessories** — a PaperFeel Screen Protector for iPad Pro 11" was showing up as a profitable "iPad Pro 11" at £5 with £438 estimated profit. The fix was an accessory keyword filter on the listing title, checked before doing anything else.

**Discord rate limiting** — sending 20+ embeds back-to-back hits the rate limit fast. Added a 1.5–2.5s gap between sends and proper handling of the `retry_after` value in 429 responses.

---

## Known Limitations

- **Facebook session expiry** — cookies last a few days. If the scraper stops finding listings, delete the `cookies/` folder and let it re-login.
- **Headless detection** — Facebook occasionally serves a CAPTCHA to headless browsers. Running with `HEADLESS=false` and completing it manually usually clears the block.
- **Static resale prices** — market values drift. Worth updating `RESALE_GUIDE` every few months.
- **eBay live prices** — eBay returns 403 for scraper requests. The static guide is the reliable path unless you get an eBay API key.
- **Dashboard not mobile-friendly** — works fine on desktop, haven't got round to responsive design.
- **No proxy support** — if your IP gets soft-banned by Facebook, you'd need to add proxy rotation, which isn't implemented.

---

## Ideas for Future

- [ ] eBay Finding API for accurate live sold prices
- [ ] Price history — chart how listings' prices change over time
- [ ] Multi-city support (Derry, Dublin, etc.)
- [ ] Auto-draft eBay listing from a portfolio entry
- [ ] Mobile-friendly dashboard
- [ ] Proxy rotation to avoid IP-level blocks
- [ ] Telegram as an alternative notification channel

---

## Disclaimer

This project was built purely for personal educational use. Web scraping may violate Facebook's Terms of Service — use it responsibly, don't hammer their servers, and don't use it for anything you wouldn't be comfortable explaining to someone. The profit estimates are just that — estimates based on historical eBay sold prices. Always do your own research before spending money.

---

## License

MIT — do whatever you want with it, just don't blame me if you lose money on a dodgy RTX 3070.
