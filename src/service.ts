/**
 * x402-places — service layer.
 *
 * POI search and detail over the OpenStreetMap Overpass API (keyless, live by
 * default). Optional Yelp Fusion enrichment on /detail is env-gated by
 * YELP_API_KEY; without the key a deterministic fixture enrichment is returned,
 * clearly labeled source:"fixture".
 */

export interface Poi {
  id: string; // "node-123", "way-123", "relation-123"
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  category: string | null; // amenity/shop/leisure/tourism value
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  cuisine: string | null;
  tags: Record<string, string>;
}

export interface PlacesSearchResult {
  source: "overpass";
  query: {
    latitude: number;
    longitude: number;
    radiusM: number;
    category: string | null;
    limit: number;
  };
  count: number;
  places: Poi[];
  retrievedAt: string;
}

export interface YelpEnrichment {
  source: "yelp" | "fixture";
  rating: number;
  reviewCount: number;
  priceLevel: string | null;
  yelpUrl: string | null;
  reviews: { rating: number; text: string; author: string; createdAt: string }[];
  note?: string;
}

export interface PlaceDetailResult {
  source: "overpass";
  place: Poi;
  enrichment: YelpEnrichment;
  retrievedAt: string;
}

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

export function hasYelpKey(): boolean {
  return Boolean(process.env.YELP_API_KEY);
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Overpass refuses requests without an identifying User-Agent (HTTP 406), and
 * asks API consumers to declare one. Keep this honest and contactable.
 */
const USER_AGENT =
  process.env.OVERPASS_USER_AGENT ??
  "x402-places/0.1 (+https://github.com/nirholas/x402-places)";

async function overpass(query: string): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(Number(process.env.OVERPASS_TIMEOUT_MS ?? 30_000)),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Overpass request failed: ${res.status} ${detail}`);
  }
  const body = (await res.json()) as { elements?: OverpassElement[] };
  return body.elements ?? [];
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter((p) => p && p.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function toPoi(el: OverpassElement): Poi {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;
  const category =
    tags.amenity ?? tags.shop ?? tags.leisure ?? tags.tourism ?? null;
  return {
    id: `${el.type}-${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name: tags.name ?? "(unnamed)",
    category,
    latitude: lat,
    longitude: lon,
    openingHours: tags.opening_hours ?? null,
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    address: buildAddress(tags),
    cuisine: tags.cuisine ?? null,
    tags,
  };
}

/** Escape a value for use inside an Overpass quoted string. */
function esc(v: string): string {
  return v.replace(/[\\"]/g, "\\$&");
}

/**
 * Search POIs around a point via Overpass (live).
 *
 * category matches any of amenity/shop/leisure/tourism; when omitted, any
 * named element with an amenity tag is returned.
 */
export async function searchPlaces(
  latitude: number,
  longitude: number,
  radiusM: number,
  category: string | null,
  limit: number,
): Promise<PlacesSearchResult> {
  const around = `(around:${radiusM},${latitude},${longitude})`;
  const filters = category
    ? ["amenity", "shop", "leisure", "tourism"]
        .map((k) => `nwr["${k}"="${esc(category)}"]["name"]${around};`)
        .join("\n  ")
    : `nwr["amenity"]["name"]${around};`;
  const query = `[out:json][timeout:25];
(
  ${filters}
);
out tags center ${Math.min(limit * 3, 200)};`;
  const elements = await overpass(query);
  const places = elements
    .filter((e) => e.tags?.name)
    .slice(0, limit)
    .map(toPoi);
  return {
    source: "overpass",
    query: { latitude, longitude, radiusM, category, limit },
    count: places.length,
    places,
    retrievedAt: new Date().toISOString(),
  };
}

/** Parse an id like "node-123" into its parts, or null if malformed. */
export function parsePoiId(
  id: string,
): { osmType: "node" | "way" | "relation"; osmId: number } | null {
  const m = /^(node|way|relation)-(\d+)$/.exec(id);
  if (!m) return null;
  return { osmType: m[1] as "node" | "way" | "relation", osmId: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// Yelp enrichment (env-gated) with deterministic fixture fallback.
// ---------------------------------------------------------------------------

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixture data — used when YELP_API_KEY is unset.
const FIXTURE_REVIEW_TEXTS = [
  "Solid spot. Service was quick and the atmosphere was relaxed.",
  "Came here twice in one week. The staff remembered us the second time.",
  "Good value for the neighborhood; portions are generous.",
  "A bit crowded at peak hours but worth the wait.",
  "Exactly what the reviews promised. Would bring visitors here.",
];

function fixtureEnrichment(place: Poi): YelpEnrichment {
  const rand = mulberry32(seedFrom(place.id));
  const reviewCount = 12 + Math.floor(rand() * 480);
  const rating = Number((3 + rand() * 2).toFixed(1));
  const reviews = Array.from({ length: 3 }, (_, i) => ({
    rating: Math.max(1, Math.min(5, Math.round(rating + (rand() - 0.5) * 2))),
    text: FIXTURE_REVIEW_TEXTS[Math.floor(rand() * FIXTURE_REVIEW_TEXTS.length)],
    author: `demo_user_${Math.floor(rand() * 900) + 100}`,
    createdAt: new Date(1700000000000 + Math.floor(rand() * 5e10)).toISOString(),
  }));
  return {
    source: "fixture",
    rating,
    reviewCount,
    priceLevel: ["$", "$$", "$$$"][Math.floor(rand() * 3)],
    yelpUrl: null,
    reviews,
    note: "Deterministic fixture enrichment — set YELP_API_KEY for live Yelp data.",
  };
}

interface YelpBusiness {
  id: string;
  rating?: number;
  review_count?: number;
  price?: string;
  url?: string;
}

async function yelpEnrichment(place: Poi): Promise<YelpEnrichment> {
  const key = process.env.YELP_API_KEY!;
  const headers = { Authorization: `Bearer ${key}` };
  if (place.latitude == null || place.longitude == null) {
    return fixtureEnrichment(place);
  }
  const params = new URLSearchParams({
    term: place.name,
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    radius: "150",
    limit: "1",
  });
  const matchRes = await fetch(
    `https://api.yelp.com/v3/businesses/search?${params}`,
    { headers },
  );
  if (!matchRes.ok) {
    throw new Error(`Yelp search failed: ${matchRes.status}`);
  }
  const matchBody = (await matchRes.json()) as { businesses?: YelpBusiness[] };
  const biz = matchBody.businesses?.[0];
  if (!biz) {
    return {
      source: "yelp",
      rating: 0,
      reviewCount: 0,
      priceLevel: null,
      yelpUrl: null,
      reviews: [],
      note: "No Yelp match found for this place.",
    };
  }
  interface YelpReview {
    rating?: number;
    text?: string;
    user?: { name?: string };
    time_created?: string;
  }
  let reviews: YelpEnrichment["reviews"] = [];
  const revRes = await fetch(
    `https://api.yelp.com/v3/businesses/${biz.id}/reviews`,
    { headers },
  );
  if (revRes.ok) {
    const revBody = (await revRes.json()) as { reviews?: YelpReview[] };
    reviews = (revBody.reviews ?? []).map((r) => ({
      rating: r.rating ?? 0,
      text: r.text ?? "",
      author: r.user?.name ?? "unknown",
      createdAt: r.time_created ?? "",
    }));
  }
  return {
    source: "yelp",
    rating: biz.rating ?? 0,
    reviewCount: biz.review_count ?? 0,
    priceLevel: biz.price ?? null,
    yelpUrl: biz.url ?? null,
    reviews,
  };
}

/** Full record for one POI (live Overpass) + Yelp/fixture enrichment. */
export async function placeDetail(
  osmType: "node" | "way" | "relation",
  osmId: number,
): Promise<PlaceDetailResult | null> {
  const query = `[out:json][timeout:25];
${osmType}(${osmId});
out tags center 1;`;
  const elements = await overpass(query);
  if (elements.length === 0) return null;
  const place = toPoi(elements[0]);
  const enrichment = hasYelpKey()
    ? await yelpEnrichment(place)
    : fixtureEnrichment(place);
  return {
    source: "overpass",
    place,
    enrichment,
    retrievedAt: new Date().toISOString(),
  };
}
