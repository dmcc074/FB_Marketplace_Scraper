export async function extractListing(elementHandle, keyword) {
  const data = await elementHandle.evaluate(el => {
    const href = el.getAttribute('href') ?? '';
    const id = href.match(/\/item\/(\d+)\//)?.[1] ?? null;
    if (!id) return null;

    const url = 'https://www.facebook.com' + href;

    const spans = [...el.querySelectorAll('span[dir="auto"]')]
      .map(s => s.innerText.trim())
      .filter(Boolean);

    const title = spans[0] ?? null;
    const price = spans.find(s => /^[£$][\d,]+/.test(s) || s === 'Free') ?? spans[1] ?? null;
    const location = spans[spans.length - 1] ?? null;
    const image = el.querySelector('img[src*="fbcdn.net"]')?.src ?? null;

    return { id, title, price, location, url, image };
  });

  if (!data) return null;

  return {
    ...data,
    keyword,
    scrapedAt: new Date().toISOString(),
  };
}
