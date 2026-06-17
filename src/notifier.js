import { loadSeen, saveSeen } from './seenListings.js';

const { DISCORD_WEBHOOK_URL } = process.env;

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

  const embed = {
    title: `${deal.matchedItem} — ${deal.price}`,
    url: deal.url,
    color,
    description: `**Profit: £${deal.estimatedProfitGBP}** after fees`,
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
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      console.warn(`[notifier] Discord returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.warn(`[notifier] Failed to send Discord message: ${err.message}`);
  }
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
