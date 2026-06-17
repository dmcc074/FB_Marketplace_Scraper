export function randomDelay(min = 1000, max = 4000) {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
}

export function randomTypingDelay() {
  return 30 + Math.random() * 70;
}

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

export function isUKListing(listing) {
  if (listing.price && /^\$/.test(listing.price)) return false;
  if (listing.location) {
    const match = listing.location.match(/,\s*([A-Z]{2})$/);
    if (match && US_STATES.has(match[1])) return false;
  }
  return true;
}

export function deduplicateById(listings) {
  const map = new Map();
  for (const listing of listings) {
    if (listing.id) map.set(listing.id, listing);
  }
  return Array.from(map.values());
}
