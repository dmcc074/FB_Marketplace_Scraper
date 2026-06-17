import { fetchEbaySoldPrice } from './ebayScraper.js';

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
];

function parsePrice(priceStr) {
  if (!priceStr || priceStr === 'Free') return null;
  const digits = priceStr.replace(/,/g, '').match(/[\d.]+/);
  if (!digits) return null;
  return parseFloat(digits[0]);
}

function findMatch(title) {
  if (!title) return null;
  for (const entry of RESALE_GUIDE) {
    if (entry.pattern.test(title)) return entry;
  }
  return null;
}

// Returns { [keyword]: top10[] } — top 10 deals per keyword, sorted by profit.
export async function analyseProfit(listings) {
  const useLivePrices = process.env.USE_LIVE_PRICES === 'true';
  const byKeyword = {};

  for (const listing of listings) {
    const buyPrice = parsePrice(listing.price);
    if (!buyPrice || buyPrice <= 0) continue;

    const match = findMatch(listing.title);
    if (!match) continue;

    let baseResale = match.resale;
    if (useLivePrices) {
      const livePrice = await fetchEbaySoldPrice(match.name);
      if (livePrice !== null) baseResale = livePrice;
    }

    const multiplier = CONDITION_MULTIPLIERS[listing.condition] ?? 1.0;
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
