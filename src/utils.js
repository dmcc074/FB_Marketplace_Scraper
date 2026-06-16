export function randomDelay(min = 1000, max = 4000) {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
}

export function randomTypingDelay() {
  return 30 + Math.random() * 70;
}

const US_STATE_SUFFIX = /,\s*[A-Z]{2}$/;

export function isUKListing(listing) {
  if (listing.price && /^\$/.test(listing.price)) return false;
  if (listing.location && US_STATE_SUFFIX.test(listing.location)) return false;
  return true;
}

export function deduplicateById(listings) {
  const map = new Map();
  for (const listing of listings) {
    if (listing.id) map.set(listing.id, listing);
  }
  return Array.from(map.values());
}
