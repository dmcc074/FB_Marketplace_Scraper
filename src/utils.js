export function randomDelay(min = 1000, max = 4000) {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Ensures a minimum (randomised) gap between successive async calls.
 * Call limiter.wait() before each request — it blocks until the gap has elapsed.
 */
export class RateLimiter {
  constructor(minMs, maxMs) {
    this._min = minMs;
    this._max = maxMs ?? minMs;
    this._next = 0; // earliest timestamp the next call may proceed
  }

  async wait() {
    const now = Date.now();
    if (now < this._next) {
      await new Promise(r => setTimeout(r, this._next - now));
    }
    const jitter = this._min + Math.random() * (this._max - this._min);
    this._next = Date.now() + jitter;
  }
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

// Northern Ireland place names used as a whitelist.
// Facebook's radius parameter does not reliably restrict results to NI,
// so we filter post-scrape by checking whether the location string contains
// a recognisable NI town, suburb, or county reference.
const NI_PLACES = [
  // Cities / large towns
  'belfast','derry','londonderry','armagh','newry','lisburn','ballymena',
  'bangor','omagh','enniskillen','strabane','coleraine','limavady',
  // Medium towns
  'newtownabbey','carrickfergus','newtownards','antrim','dungannon',
  'cookstown','magherafelt','maghera','portadown','craigavon','lurgan',
  'downpatrick','kilkeel','rathfriland','ballyclare','larne','whitehead',
  'ballycastle','portrush','portstewart','castlederg','coalisland',
  'warrenpoint','bessbrook','crossmaglen','keady','markethill','tandragee',
  'banbridge','dromore','hillsborough','moira','crumlin','holywood',
  'donaghadee','ballynahinch','saintfield','castlewellan','newcastle',
  'strathfoyle','claudy','dungiven','bushmills','ballymoney','rasharkin',
  'kilrea','irvinestown','lisnaskea','fivemiletown','newtownstewart',
  // Belfast suburbs / areas
  'castlereagh','dundonald','carryduff','dunmurry','glengormley','finaghy',
  'sydenham','stranmillis',
];
const NI_PLACES_RE = new RegExp(NI_PLACES.join('|'), 'i');
const NI_COUNTY_RE = /northern ireland|county (antrim|down|armagh|tyrone|fermanagh|londonderry|derry)|co\.?\s*(antrim|down|armagh|tyrone|fermanagh|londonderry|derry)/i;
// NI town names that also exist in England/Scotland — require explicit disambiguation
const NI_AMBIGUOUS_EXCLUDE_RE = /newcastle.?upon.?tyne|newcastle.?tyne|tyne.?and.?wear|newcastle.?england/i;

export function isUKListing(listing) {
  if (listing.price && /^\$/.test(listing.price)) return false;
  if (listing.location) {
    const match = listing.location.match(/,\s*([A-Z]{2})$/);
    if (match && US_STATES.has(match[1])) return false;
  }
  return true;
}

// Whitelist filter — only keep listings with a recognisable NI location.
// Returns true if the location looks like it's in Northern Ireland (or has no location).
export function isNIListing(listing) {
  if (!listing.location) return true;
  if (NI_AMBIGUOUS_EXCLUDE_RE.test(listing.location)) return false;
  return NI_COUNTY_RE.test(listing.location) || NI_PLACES_RE.test(listing.location);
}

export function deduplicateById(listings) {
  const map = new Map();
  for (const listing of listings) {
    if (listing.id) map.set(listing.id, listing);
  }
  return Array.from(map.values());
}
