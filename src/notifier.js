import { loadSeen, saveSeen } from './seenListings.js';
import { RateLimiter } from './utils.js';

const { DISCORD_WEBHOOK_URL } = process.env;

// Discord webhooks: 30 requests/minute cap. Stay well under with a 1.5–2.5s gap.
const discordLimiter = new RateLimiter(1500, 2500);

function buildEmbed(deal) {
  const profit = Number(deal.estimatedProfitGBP);
  let color;
  if (profit >= 100) {
    color = 0x4CAF82; // green
  } else if (profit >= 50) {
    color = 0xF0A500; // amber
  } else {
    color = 5025666; // default blue
  }

  const descSnippet = deal.description
    ? deal.description.slice(0, 200).replace(/\n+/g, ' ').trim()
    : null;

  const embed = {
    title: `${deal.matchedItem} — ${deal.price}`,
    url: deal.url,
    color,
    description: [
      `**Profit: £${deal.estimatedProfitGBP}** after fees`,
      descSnippet ? `\n> ${descSnippet}` : null,
    ].filter(Boolean).join('\n'),
    fields: [
      { name: 'Buy Price',      value: String(deal.price),                inline: true },
      { name: 'Est. Resale',    value: `£${deal.estimatedResaleGBP}`,     inline: true },
      { name: 'Net After Fees', value: `£${deal.netAfterFeesGBP}`,        inline: true },
      { name: 'Condition',      value: String(deal.condition ?? 'used'),   inline: true },
      { name: 'Location',       value: String(deal.location ?? 'Unknown'), inline: true },
      { name: 'Keyword',        value: String(deal.keyword),               inline: true },
    ],
    footer: { text: 'Belfast FB Marketplace' },
  };

  if (deal.image && typeof deal.image === 'string' && deal.image.trim() !== '') {
    embed.image = { url: deal.image };
  }

  return embed;
}

async function sendEmbed(embed) {
  const MAX_RETRIES = 4;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await discordLimiter.wait();
    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (res.status === 429) {
        // Discord tells us exactly how long to wait
        const body = await res.json().catch(() => ({}));
        const retryAfterMs = Math.ceil((body.retry_after ?? 2) * 1000);
        console.warn(`[notifier] Rate limited by Discord — waiting ${retryAfterMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, retryAfterMs));
        continue;
      }
      if (!res.ok) {
        console.warn(`[notifier] Discord returned ${res.status}: ${await res.text()}`);
      }
      return;
    } catch (err) {
      const backoff = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s, 8s
      console.warn(`[notifier] Send failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message} — retrying in ${backoff}ms`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  console.warn('[notifier] Gave up sending embed after max retries.');
}

export async function notifyDeals(dealsByKeyword) {
  if (!DISCORD_WEBHOOK_URL) return;

  const seenSet = await loadSeen();

  for (const deals of Object.values(dealsByKeyword)) {
    for (const deal of deals) {
      if (seenSet.has(String(deal.id))) continue;

      seenSet.add(String(deal.id));
      await sendEmbed(buildEmbed(deal));
    }
  }

  await saveSeen(seenSet);
}
