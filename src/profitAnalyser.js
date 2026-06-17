import { fetchEbaySoldPrice } from './ebayScraper.js';
import { fetchListingDetail } from './listingDetail.js';
import { RateLimiter } from './utils.js';

// Delay between visiting individual FB listing pages for descriptions.
// FB will throttle/block if pages are fetched too rapidly.
const FB_DETAIL_MIN_MS = parseInt(process.env.FB_DETAIL_DELAY_MIN_MS ?? '2000', 10);
const FB_DETAIL_MAX_MS = parseInt(process.env.FB_DETAIL_DELAY_MAX_MS ?? '4000', 10);
const detailLimiter = new RateLimiter(FB_DETAIL_MIN_MS, FB_DETAIL_MAX_MS);

const CONDITION_MULTIPLIERS = {
  new:      1.05,
  like_new: 0.95,
  used:     1.0,
  faulty:   0.35,
};

const RESALE_GUIDE = [
  // --- GPUs: RTX 40 series ---
  { pattern: /rtx\s*4090/i,              name: 'RTX 4090',          resale: 950 },
  { pattern: /rtx\s*4080\s*super/i,      name: 'RTX 4080 Super',    resale: 720 },
  { pattern: /rtx\s*4080/i,              name: 'RTX 4080',          resale: 680 },
  { pattern: /rtx\s*4070\s*ti\s*super/i, name: 'RTX 4070 Ti Super', resale: 530 },
  { pattern: /rtx\s*4070\s*ti/i,         name: 'RTX 4070 Ti',       resale: 490 },
  { pattern: /rtx\s*4070\s*super/i,      name: 'RTX 4070 Super',    resale: 410 },
  { pattern: /rtx\s*4070/i,              name: 'RTX 4070',          resale: 360 },
  { pattern: /rtx\s*4060\s*ti/i,         name: 'RTX 4060 Ti',       resale: 275 },
  { pattern: /rtx\s*4060/i,              name: 'RTX 4060',          resale: 205 },
  { pattern: /rtx\s*4050/i,              name: 'RTX 4050',          resale: 165 },

  // --- GPUs: RTX 30 series ---
  { pattern: /rtx\s*3090\s*ti/i,         name: 'RTX 3090 Ti',       resale: 660 },
  { pattern: /rtx\s*3090/i,              name: 'RTX 3090',          resale: 560 },
  { pattern: /rtx\s*3080\s*ti/i,         name: 'RTX 3080 Ti',       resale: 440 },
  { pattern: /rtx\s*3080/i,              name: 'RTX 3080',          resale: 390 },
  { pattern: /rtx\s*3070\s*ti/i,         name: 'RTX 3070 Ti',       resale: 290 },
  { pattern: /rtx\s*3070/i,              name: 'RTX 3070',          resale: 255 },
  { pattern: /rtx\s*3060\s*ti/i,         name: 'RTX 3060 Ti',       resale: 205 },
  { pattern: /rtx\s*3060/i,              name: 'RTX 3060',          resale: 165 },
  { pattern: /rtx\s*3050/i,              name: 'RTX 3050',          resale: 115 },

  // --- GPUs: RX 7000 series ---
  { pattern: /rx\s*7900\s*xtx/i,         name: 'RX 7900 XTX',       resale: 720 },
  { pattern: /rx\s*7900\s*xt/i,          name: 'RX 7900 XT',        resale: 510 },
  { pattern: /rx\s*7800\s*xt/i,          name: 'RX 7800 XT',        resale: 340 },
  { pattern: /rx\s*7700\s*xt/i,          name: 'RX 7700 XT',        resale: 250 },
  { pattern: /rx\s*7600/i,               name: 'RX 7600',           resale: 175 },

  // --- GPUs: RX 6000 series ---
  { pattern: /rx\s*6950\s*xt/i,          name: 'RX 6950 XT',        resale: 390 },
  { pattern: /rx\s*6900\s*xt/i,          name: 'RX 6900 XT',        resale: 350 },
  { pattern: /rx\s*6800\s*xt/i,          name: 'RX 6800 XT',        resale: 290 },
  { pattern: /rx\s*6800/i,               name: 'RX 6800',           resale: 250 },
  { pattern: /rx\s*6700\s*xt/i,          name: 'RX 6700 XT',        resale: 195 },
  { pattern: /rx\s*6600\s*xt/i,          name: 'RX 6600 XT',        resale: 145 },
  { pattern: /rx\s*6600/i,               name: 'RX 6600',           resale: 125 },

  // --- CPUs: Intel 14th gen ---
  { pattern: /i9[- ]?14900k/i,           name: 'Core i9-14900K',    resale: 460 },
  { pattern: /i7[- ]?14700k/i,           name: 'Core i7-14700K',    resale: 330 },
  { pattern: /i5[- ]?14600k/i,           name: 'Core i5-14600K',    resale: 210 },

  // --- CPUs: Intel 13th gen ---
  { pattern: /i9[- ]?13900k/i,           name: 'Core i9-13900K',    resale: 390 },
  { pattern: /i7[- ]?13700k/i,           name: 'Core i7-13700K',    resale: 280 },
  { pattern: /i5[- ]?13600k/i,           name: 'Core i5-13600K',    resale: 195 },

  // --- CPUs: Intel 12th gen ---
  { pattern: /i9[- ]?12900k/i,           name: 'Core i9-12900K',    resale: 290 },
  { pattern: /i7[- ]?12700k/i,           name: 'Core i7-12700K',    resale: 210 },
  { pattern: /i5[- ]?12600k/i,           name: 'Core i5-12600K',    resale: 145 },

  // --- CPUs: AMD Ryzen 7000 ---
  { pattern: /ryzen\s*9\s*7950x3d/i,     name: 'Ryzen 9 7950X3D',   resale: 600 },
  { pattern: /ryzen\s*9\s*7950x/i,       name: 'Ryzen 9 7950X',     resale: 490 },
  { pattern: /ryzen\s*9\s*7900x/i,       name: 'Ryzen 9 7900X',     resale: 330 },
  { pattern: /ryzen\s*7\s*7800x3d/i,     name: 'Ryzen 7 7800X3D',   resale: 340 },
  { pattern: /ryzen\s*7\s*7700x/i,       name: 'Ryzen 7 7700X',     resale: 250 },
  { pattern: /ryzen\s*5\s*7600x/i,       name: 'Ryzen 5 7600X',     resale: 195 },
  { pattern: /ryzen\s*5\s*7600/i,        name: 'Ryzen 5 7600',      resale: 175 },

  // --- CPUs: AMD Ryzen 5000 ---
  { pattern: /ryzen\s*9\s*5950x/i,       name: 'Ryzen 9 5950X',     resale: 310 },
  { pattern: /ryzen\s*9\s*5900x/i,       name: 'Ryzen 9 5900X',     resale: 210 },
  { pattern: /ryzen\s*7\s*5800x3d/i,     name: 'Ryzen 7 5800X3D',   resale: 260 },
  { pattern: /ryzen\s*7\s*5800x/i,       name: 'Ryzen 7 5800X',     resale: 175 },
  { pattern: /ryzen\s*7\s*5700x/i,       name: 'Ryzen 7 5700X',     resale: 135 },
  { pattern: /ryzen\s*5\s*5600x/i,       name: 'Ryzen 5 5600X',     resale: 125 },
  { pattern: /ryzen\s*5\s*5600/i,        name: 'Ryzen 5 5600',      resale: 105 },

  // --- RAM: DDR5 ---
  { pattern: /ddr5[\s\S]{0,25}64\s*gb|64\s*gb[\s\S]{0,25}ddr5/i, name: '64GB DDR5', resale: 170 },
  { pattern: /ddr5[\s\S]{0,25}32\s*gb|32\s*gb[\s\S]{0,25}ddr5/i, name: '32GB DDR5', resale: 95  },
  { pattern: /ddr5[\s\S]{0,25}16\s*gb|16\s*gb[\s\S]{0,25}ddr5/i, name: '16GB DDR5', resale: 58  },

  // --- RAM: DDR4 ---
  { pattern: /ddr4[\s\S]{0,25}64\s*gb|64\s*gb[\s\S]{0,25}ddr4/i, name: '64GB DDR4', resale: 90  },
  { pattern: /ddr4[\s\S]{0,25}32\s*gb|32\s*gb[\s\S]{0,25}ddr4/i, name: '32GB DDR4', resale: 62  },
  { pattern: /ddr4[\s\S]{0,25}16\s*gb|16\s*gb[\s\S]{0,25}ddr4/i, name: '16GB DDR4', resale: 38  },
  { pattern: /ddr4[\s\S]{0,25}8\s*gb|8\s*gb[\s\S]{0,25}ddr4/i,   name: '8GB DDR4',  resale: 22  },

  // --- iPhones ---
  { pattern: /iphone\s*16\s*pro\s*max/i,  name: 'iPhone 16 Pro Max',  resale: 1050 },
  { pattern: /iphone\s*16\s*pro/i,        name: 'iPhone 16 Pro',      resale: 900  },
  { pattern: /iphone\s*16\s*plus/i,       name: 'iPhone 16 Plus',     resale: 780  },
  { pattern: /iphone\s*16/i,              name: 'iPhone 16',          resale: 680  },
  { pattern: /iphone\s*15\s*pro\s*max/i,  name: 'iPhone 15 Pro Max',  resale: 900  },
  { pattern: /iphone\s*15\s*pro/i,        name: 'iPhone 15 Pro',      resale: 760  },
  { pattern: /iphone\s*15\s*plus/i,       name: 'iPhone 15 Plus',     resale: 650  },
  { pattern: /iphone\s*15/i,              name: 'iPhone 15',          resale: 560  },
  { pattern: /iphone\s*14\s*pro\s*max/i,  name: 'iPhone 14 Pro Max',  resale: 680  },
  { pattern: /iphone\s*14\s*pro/i,        name: 'iPhone 14 Pro',      resale: 560  },
  { pattern: /iphone\s*14\s*plus/i,       name: 'iPhone 14 Plus',     resale: 460  },
  { pattern: /iphone\s*14/i,              name: 'iPhone 14',          resale: 400  },
  { pattern: /iphone\s*13\s*pro\s*max/i,  name: 'iPhone 13 Pro Max',  resale: 520  },
  { pattern: /iphone\s*13\s*pro/i,        name: 'iPhone 13 Pro',      resale: 430  },
  { pattern: /iphone\s*13\s*mini/i,       name: 'iPhone 13 mini',     resale: 280  },
  { pattern: /iphone\s*13/i,              name: 'iPhone 13',          resale: 340  },
  { pattern: /iphone\s*12\s*pro\s*max/i,  name: 'iPhone 12 Pro Max',  resale: 360  },
  { pattern: /iphone\s*12\s*pro/i,        name: 'iPhone 12 Pro',      resale: 290  },
  { pattern: /iphone\s*12/i,              name: 'iPhone 12',          resale: 230  },

  // --- iPads (Gen 8+ and Air 4th gen+ only — older models not worth flipping) ---
  { pattern: /ipad\s*pro\s*13|ipad\s*pro\s*12\.9/i,         name: 'iPad Pro 12.9"',  resale: 700 },
  { pattern: /ipad\s*pro\s*11/i,                             name: 'iPad Pro 11"',    resale: 520 },
  { pattern: /ipad\s*air\s*m2|ipad\s*air\s*[\(,\s]?2024/i,  name: 'iPad Air M2',     resale: 460 },
  { pattern: /ipad\s*air\s*m1|ipad\s*air\s*5th/i,           name: 'iPad Air M1',     resale: 360 },
  { pattern: /ipad\s*air\s*4th/i,                            name: 'iPad Air 4th Gen',resale: 280 },
  { pattern: /ipad\s*mini\s*6/i,                             name: 'iPad mini 6',     resale: 320 },
  { pattern: /ipad\s*(10th|9th|8th)\s*gen/i,                 name: 'iPad (Modern)',   resale: 220 },

  // --- MacBooks (M-chip only — Intel models are low value and unpredictable) ---
  { pattern: /macbook\s*pro\s*16.*m[1-4]|macbook\s*pro.*m[1-4].*16/i, name: 'MacBook Pro 16" M-chip', resale: 1500 },
  { pattern: /macbook\s*pro\s*14.*m[1-4]|macbook\s*pro.*m[1-4].*14/i, name: 'MacBook Pro 14" M-chip', resale: 1200 },
  { pattern: /macbook\s*pro.*m[1-4]/i,    name: 'MacBook Pro M-chip', resale: 900  },
  { pattern: /macbook\s*air\s*m3/i,       name: 'MacBook Air M3',     resale: 980  },
  { pattern: /macbook\s*air\s*m2/i,       name: 'MacBook Air M2',     resale: 820  },
  { pattern: /macbook\s*air\s*m1/i,       name: 'MacBook Air M1',     resale: 640  },

  // --- Consoles ---
  { pattern: /ps5\s*digital|playstation\s*5\s*digital/i, name: 'PS5 Digital', resale: 290 },
  { pattern: /ps5|playstation\s*5/i,      name: 'PS5',                resale: 340  },
  { pattern: /xbox\s*series\s*x/i,        name: 'Xbox Series X',      resale: 310  },
  { pattern: /xbox\s*series\s*s/i,        name: 'Xbox Series S',      resale: 180  },
  { pattern: /nintendo\s*switch\s*oled/i, name: 'Nintendo Switch OLED', resale: 220 },
  { pattern: /nintendo\s*switch/i,        name: 'Nintendo Switch',    resale: 170  },
  { pattern: /steam\s*deck\s*oled/i,      name: 'Steam Deck OLED',    resale: 480  },
  { pattern: /steam\s*deck/i,             name: 'Steam Deck',         resale: 330  },

  // --- Laptops ---
  { pattern: /dell\s*xps\s*15/i,          name: 'Dell XPS 15',        resale: 900  },
  { pattern: /dell\s*xps\s*13/i,          name: 'Dell XPS 13',        resale: 650  },
  { pattern: /thinkpad\s*x1\s*carbon/i,   name: 'ThinkPad X1 Carbon', resale: 700  },
  { pattern: /thinkpad\s*x1/i,            name: 'ThinkPad X1',        resale: 580  },
];

function parsePrice(priceStr) {
  if (!priceStr || priceStr === 'Free') return null;
  const digits = priceStr.replace(/,/g, '').match(/[\d.]+/);
  if (!digits) return null;
  return parseFloat(digits[0]);
}

// Applied to the TITLE only — descriptions can mention accessories without being one
const ACCESSORY_TITLE_PATTERN = /screen.?protector|tempered.?glass|glass.?film|screen.?guard|paperfeel|\bcase\b|\bcover\b|sleeve|folio|\bcharger\b|charging.?cable|usb.?cable|\badapter\b|\bstand\b|\bmount\b|\bdock\b|\bhub\b|\bholder\b|\bstylus\b|\bpencil\b|\bskin\b|decal|\bbumper\b|\bpouch\b|\bbag\b|\bstrap\b|\bband\b|\brepair\b|spare.?part|replacement.?screen|replacement.?kit|screen.?replacement/i;

// A GPU/CPU component being sold as part of a full PC — we can't value the whole system
const BUNDLE_PATTERN = /gaming\s*pc\b|full\s*(setup|system|build|rig)|complete\s*(setup|system|build|pc)|desktop\s*(pc|computer|setup)|with\s*(24|27|32)[""]?\s*monitor|includes?\s*(monitor|keyboard|mouse)/i;
const COMPONENT_PATTERN = /\brtx\b|\brx\s*\d{4}|\bgpu\b|graphics\s*card|\bryzen\b|\bi[3579][- ]\d{4}[a-z]*\b|\bcpu\b|\bprocessor\b/i;

function isAccessoryTitle(title) {
  return ACCESSORY_TITLE_PATTERN.test(title ?? '');
}

// Find the RESALE_GUIDE entry that matches a piece of text (no accessory check here)
function findPatternInText(text) {
  if (!text) return null;
  for (const entry of RESALE_GUIDE) {
    if (entry.pattern.test(text)) return entry;
  }
  return null;
}

// Returns the best (most specific) match from title + description combined.
// Description can reveal exact model when title is vague ("Laptop" → desc says "MacBook Air M2").
// If both title and description match, prefer the one that appears earlier in RESALE_GUIDE
// (entries are ordered most-specific first within each product family).
function findBestMatch(title, description) {
  if (isAccessoryTitle(title)) return null;

  const titleMatch = findPatternInText(title);
  const descMatch  = findPatternInText(description);

  if (!titleMatch && !descMatch) return null;
  if (!titleMatch) return descMatch;
  if (!descMatch)  return titleMatch;

  const titleIdx = RESALE_GUIDE.indexOf(titleMatch);
  const descIdx  = RESALE_GUIDE.indexOf(descMatch);

  // Lower index = earlier in the guide = more specific pattern defined first
  const best = descIdx <= titleIdx ? descMatch : titleMatch;
  if (titleMatch !== descMatch) {
    console.log(`[profit] Match refined by description: "${titleMatch.name}" → "${best.name}"`);
  }
  return best;
}

// Condition keywords to detect from description
const CONDITION_KEYWORDS = {
  faulty:   /faulty|broken|spares|for parts|not working|damaged|untested|cracked|dead|snapped|bent|water.?damage/i,
  new:      /brand new|bnib|sealed|new in box|unopened/i,
  like_new: /like new|mint|pristine|barely used|immaculate|perfect condition|hardly used/i,
};

function detectCondition(text) {
  if (!text) return null;
  if (CONDITION_KEYWORDS.faulty.test(text))   return 'faulty';
  if (CONDITION_KEYWORDS.new.test(text))      return 'new';
  if (CONDITION_KEYWORDS.like_new.test(text)) return 'like_new';
  return null;
}

// Returns { [keyword]: top10[] } — top 10 deals per keyword, sorted by profit.
export async function analyseProfit(listings, page = null) {
  const useLivePrices = process.env.USE_LIVE_PRICES === 'true';
  const byKeyword = {};

  for (const listing of listings) {
    const buyPrice = parsePrice(listing.price);
    if (!buyPrice || buyPrice <= 0) continue;

    // Quick title-only accessory check before spending time fetching the page
    if (isAccessoryTitle(listing.title)) continue;

    // Fetch the listing description page to validate and refine the match
    let description = null;
    if (page && listing.url) {
      await detailLimiter.wait();
      console.log(`[profit] Fetching description for: ${listing.title}`);
      const detail = await fetchListingDetail(page, listing.url);
      description = detail?.description ?? null;
    }

    // Find best match using combined title + description
    const match = findBestMatch(listing.title, description);
    if (!match) continue;

    // Bundle filter: if a GPU/CPU component is listed as part of a full PC, skip it —
    // we can't accurately value the whole system
    const combinedText = [listing.title, description].filter(Boolean).join(' ');
    if (COMPONENT_PATTERN.test(combinedText) && BUNDLE_PATTERN.test(combinedText)) {
      console.log(`[profit] Filtered (component in PC bundle): ${listing.title}`);
      continue;
    }

    // Detect condition from combined title + description
    const detectedCondition = detectCondition(combinedText);
    const condition = detectedCondition ?? listing.condition ?? 'used';

    let baseResale = match.resale;
    if (useLivePrices) {
      const livePrice = await fetchEbaySoldPrice(match.name);
      if (livePrice !== null) baseResale = livePrice;
    }

    const multiplier = CONDITION_MULTIPLIERS[condition] ?? 1.0;
    const adjustedResale = Math.round(baseResale * multiplier);

    // eBay UK fee ~12.8% + estimated £10 postage
    const netResale = Math.round(adjustedResale * 0.872 - 10);
    const profit = netResale - buyPrice;
    const minProfit = parseInt(process.env.MIN_PROFIT_GBP ?? '50', 10);
    const minRoi = parseFloat(process.env.MIN_ROI_PERCENT ?? '20');
    const roi = (profit / buyPrice) * 100;
    if (profit < minProfit || roi < minRoi) continue;

    const keyword = listing.keyword ?? 'unknown';
    if (!byKeyword[keyword]) byKeyword[keyword] = [];

    byKeyword[keyword].push({
      ...listing,
      condition,
      description,
      matchedItem: match.name,
      estimatedResaleGBP: adjustedResale,
      netAfterFeesGBP: netResale,
      estimatedProfitGBP: profit,
      roiPercent: Math.round(roi * 10) / 10,
    });
  }

  for (const keyword of Object.keys(byKeyword)) {
    byKeyword[keyword] = byKeyword[keyword]
      .sort((a, b) => b.estimatedProfitGBP - a.estimatedProfitGBP)
      .slice(0, 10);
  }

  return byKeyword;
}
