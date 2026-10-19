import { fetchWithTimeout } from "../core/http";
import { normalizeText } from "../core/normalize";
import type { StoreId } from "../types";

export interface Branch {
  store: StoreId;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  distanceM: number;
}

interface OsmElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** How each chain is spelled in OpenStreetMap's brand/name tags (accent-free, lower-case). Farmaonline is online-only. */
const BRAND_PATTERNS: Partial<Record<StoreId, RegExp>> = {
  carrefour: /\bcarrefour\b/,
  coto: /^(supermercado |hipermercado )?coto\b/,
  dia: /^(supermercado |supermercados )?dia\b/,
  jumbo: /\bjumbo\b/,
  disco: /^(supermercado )?disco\b/,
  vea: /^(supermercado |supermercados )?vea\b/,
  changomas: /\bchango ?mas\b|\bmas online\b/,
  farmacity: /\bfarmacity\b/,
  farmaplus: /\bfarma ?plus\b/,
  farmatodo: /\bfarmatodo\b/,
};

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

function storeFor(tags: Record<string, string>): StoreId | null {
  const label = normalizeText(tags.brand ?? tags.name ?? "");
  if (!label) return null;
  for (const [store, pattern] of Object.entries(BRAND_PATTERNS) as [StoreId, RegExp][]) {
    if (pattern.test(label)) return store;
  }
  return null;
}

/** Closest branch of each chain among OpenStreetMap results around (lat, lon). */
export function nearestBranches(elements: OsmElement[], lat: number, lon: number): Partial<Record<StoreId, Branch>> {
  const nearest: Partial<Record<StoreId, Branch>> = {};
  for (const el of elements) {
    const tags = el.tags ?? {};
    const store = storeFor(tags);
    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    if (!store || pLat === undefined || pLon === undefined) continue;

    const street = tags["addr:street"];
    const branch: Branch = {
      store,
      name: tags.name ?? tags.brand ?? store,
      address: street ? `${street}${tags["addr:housenumber"] ? ` ${tags["addr:housenumber"]}` : ""}` : null,
      lat: pLat,
      lon: pLon,
      distanceM: Math.round(distanceM(lat, lon, pLat, pLon)),
    };
    if (!nearest[store] || branch.distanceM < nearest[store]!.distanceM) nearest[store] = branch;
  }
  return nearest;
}

const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/** Supermarkets and pharmacies within `radiusM`, from OpenStreetMap's Overpass API (free, no key). */
export async function fetchNearbyBranches(lat: number, lon: number, radiusM: number): Promise<Partial<Record<StoreId, Branch>>> {
  const around = `around:${radiusM},${lat},${lon}`;
  const query = `[out:json][timeout:20];(nwr(${around})["shop"~"^(supermarket|convenience|chemist|department_store|wholesale)$"];nwr(${around})["amenity"="pharmacy"];);out center tags 400;`;

  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "AzoApp/1.0" } },
        20000,
      );
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      return nearestBranches(json.elements ?? [], lat, lon);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("overpass no disponible");
}

/** Directions link: Apple Maps on iOS, Google Maps elsewhere. */
export function directionsUrl(branch: Pick<Branch, "lat" | "lon">, platform: string): string {
  return platform === "ios"
    ? `https://maps.apple.com/?daddr=${branch.lat},${branch.lon}`
    : `https://www.google.com/maps/dir/?api=1&destination=${branch.lat},${branch.lon}`;
}
