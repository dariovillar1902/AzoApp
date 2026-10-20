import { CATALOG, MERCHANT_NAMES } from "../benefits/catalog";
import { fetchCotoLivePromotions } from "../benefits/cotoLive";
import { fetchScrapedPromotions } from "../benefits/scrapedPromos";
import { isEligible, upcomingDays, type CapUsage, type UserProfile } from "../benefits/eligibility";
import type { PromoCategory, Promotion } from "../benefits/types";
import { excludeOffers } from "../core/exclusions";
import { pickBestOffer } from "../core/matching";
import { normalizeText, stripSizeForSearch } from "../core/normalize";
import { STORE_IDS, STORES } from "../stores/registry";
import type { MatchedItem, ProductOffer, ShoppingListItem, StoreId } from "../types";
import { otherShopsFor, type OtherShop } from "./otherShops";
import { planShopping, type PlanResult } from "./plan";

const CACHE_TTL_MS = 30 * 60 * 1000;
const searchCache = new Map<string, { at: number; result: Promise<SearchResult> }>();
let cotoPromosCache: { at: number; promos: Promise<Promotion[]> } | null = null;

interface SearchResult {
  offers: ProductOffer[];
  /** false when the store didn't answer (error, timeout, block), as opposed to answering "no results". */
  ok: boolean;
}

/** Store searches are cached for 30 minutes: lists get re-planned a lot while being edited. */
function cachedSearch(store: StoreId, query: string): Promise<SearchResult> {
  const key = `${store}:${query}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const result = STORES[store]
    .search(query)
    .then((offers) => ({ offers, ok: true }))
    .catch((err: Error) => {
      console.error(`[${store}] error buscando "${query}": ${err.message}`);
      searchCache.delete(key);
      return { offers: [], ok: false };
    });
  searchCache.set(key, { at: Date.now(), result });
  return result;
}

export function getAllPromotions(): Promise<Promotion[]> {
  if (!cotoPromosCache || Date.now() - cotoPromosCache.at > CACHE_TTL_MS) {
    const promos = Promise.all([
      fetchCotoLivePromotions().catch(() => [] as Promotion[]),
      fetchScrapedPromotions().catch(() => [] as Promotion[]),
    ]).then(([coto, banks]) => [...CATALOG, ...coto, ...banks]);
    cotoPromosCache = { at: Date.now(), promos };
  }
  return cotoPromosCache.promos;
}

/** Items you don't buy at a super or pharmacy but that still have bank promos (e.g. "nafta"). */
export function categoryHintFor(query: string): PromoCategory | null {
  const text = normalizeText(query);
  if (/\b(nafta|gasoil|diesel|combustible|gnc|infinia|v power|cargar)\b/.test(text)) return "combustible";
  return null;
}

/** EAN-8/UPC/EAN-13/GTIN-14, as read by the barcode scanner. */
export function isBarcode(query: string): boolean {
  return /^\d{8,14}$/.test(query.trim());
}

export interface PlanRequest {
  items: ShoppingListItem[];
  profile: UserProfile;
  stores?: StoreId[];
  storePenalty?: number;
  capUsage?: CapUsage;
  now?: Date;
}

export interface PlanResponse extends PlanResult {
  /** Promotions (eligible for the user) that apply to items we couldn't price, keyed by item index. */
  hints: Record<number, Promotion[]>;
  /** Fuel stations, neighborhood shops and pharmacies we don't price, with the promo that applies, keyed by item index. */
  otherShops: Record<number, OtherShop[]>;
  storesSearched: StoreId[];
  storesFailed: StoreId[];
}

export async function planForUser(request: PlanRequest): Promise<PlanResponse> {
  const stores = (request.stores?.length ? request.stores : STORE_IDS).filter((s) => s in STORES);
  const allPromotions = await getAllPromotions();
  const promotions = allPromotions.filter((p) => isEligible(p, request.profile));

  const storesFailed = new Set<StoreId>();
  const matches: Partial<Record<StoreId, MatchedItem[]>> = {};

  await Promise.all(
    stores.map(async (store) => {
      matches[store] = await Promise.all(
        request.items.map(async (item) => {
          // Fuel and the like are never on a super's shelf: don't let fuzzy matching invent one.
          if (categoryHintFor(item.query) === "combustible") {
            return { requested: item, offer: null, score: 0, isSubstitute: false };
          }
          // A product the user picked by hand on this store replaces the query for this store only.
          const query = item.queryBySite?.[store] ?? item.query;
          if (isBarcode(query)) {
            // A scanned EAN identifies one product: take the store's exact hit, no fuzzy matching.
            const { offers: candidates, ok } = await cachedSearch(store, query);
            if (!ok) storesFailed.add(store);
            const hit = excludeOffers(candidates, item.excludedOfferIds).find((o) => o.inStock) ?? null;
            return { requested: item, offer: hit, score: hit ? 1 : 0, isSubstitute: false };
          }
          const { offers: candidates, ok } = await cachedSearch(store, stripSizeForSearch(query));
          if (!ok) storesFailed.add(store);
          const match = pickBestOffer({ ...item, query }, excludeOffers(candidates, item.excludedOfferIds));
          return { ...match, requested: item };
        }),
      );
    }),
  );

  const result = planShopping({
    items: request.items,
    matches,
    promotions,
    days: upcomingDays(request.now),
    storePenalty: request.storePenalty,
    capUsage: request.capUsage,
  });

  const hints: Record<number, Promotion[]> = {};
  for (const index of result.notFound) {
    const category = categoryHintFor(request.items[index].query);
    if (category) hints[index] = promotions.filter((p) => p.category === category);
  }

  const otherShops: Record<number, OtherShop[]> = {};
  const ctx = { profile: request.profile, days: result.days, capUsage: request.capUsage, merchantNames: MERCHANT_NAMES };
  request.items.forEach((item, index) => {
    const shops = otherShopsFor(item.query, result.items[index] ?? null, allPromotions, ctx, categoryHintFor(item.query) === "combustible");
    if (shops.length > 0) otherShops[index] = shops;
  });

  return { ...result, hints, otherShops, storesSearched: stores, storesFailed: [...storesFailed] };
}
