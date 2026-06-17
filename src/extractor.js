export async function extractListing(elementHandle, keyword) {
  const data = await elementHandle.evaluate(el => {
    const href = el.getAttribute('href') ?? '';
    const id = href.match(/\/item\/(\d+)\//)?.[1] ?? null;
    if (!id) return null;

    const url = 'https://www.facebook.com' + href;

    const spans = [...el.querySelectorAll('span[dir="auto"]')]
      .map(s => s.innerText.trim())
      .filter(Boolean);

    const isPrice = s => /^[£$][\d,]+/.test(s) || s === 'Free';
    const price = spans.find(isPrice) ?? null;
    const nonPriceSpans = spans.filter(s => !isPrice(s));
    const location = nonPriceSpans[nonPriceSpans.length - 1] ?? null;
    const title = nonPriceSpans.find(s => s !== location) ?? null;
    const image = el.querySelector('img[src*="fbcdn.net"]')?.src ?? null;

    const t = (title ?? '').toLowerCase();
    let condition = 'used';
    if (/faulty|broken|spares|for parts|not working|damaged|untested|cracked|dead/.test(t)) {
      condition = 'faulty';
    } else if (/brand new|bnib|sealed|new in box/.test(t)) {
      condition = 'new';
    } else if (/like new|mint|pristine|barely used|immaculate/.test(t)) {
      condition = 'like_new';
    }

    return { id, title, price, location, url, image, condition };
  });

  if (!data) return null;

  return {
    ...data,
    keyword,
    scrapedAt: new Date().toISOString(),
  };
}
