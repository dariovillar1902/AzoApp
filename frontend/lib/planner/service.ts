import { CATALOG } from "../benefits/catalog";
import { fetchCotoLivePromotions } from "../benefits/cotoLive";
import { fetchScrapedPromotions } from "../benefits/scrapedPromos";
import { isEligible, upcomingDays, type CapUsage, type UserProfile } from "../benefits/eligibility";
import type { PromoCategory, Promotion } from "../benefits/types";
import { excludeOffers } from "../core/exclusions";
import { pickBestOffer } from "../core/matching";
import { normalizeText, stripSizeForSearch } from "../core/normalize";
import { STORE_IDS, STORES } from "../stores/registry";
import type { MatchedItem, ProductOffer, ShoppingListItem, StoreId } from "../types";
import { planShopping, type PlanResult } from "./plan";

const CACHE_TTL_MS = 30 * 60 * 1000;
const searchCache = new Map<string, { at: number; offers: Promise<ProductOffer[]> }>();
let cotoPromosCache: { at: number; promos: Promise<Promotion[]> } | null = null;

/** Store searches are cached for 30 minutes: lists get re-planned a lot while being edited. */
function cachedSearch(store: StoreId, query: string): Promise<ProductOffer[]> {
  const key = `${store}:${query}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.offers;

  const offers = STORES[store].search(query).catch((err: Error) => {
    console.error(`[${store}] error buscando "${query}": ${err.message}`);
    searchCache.delete(key);
    return [];
  });
  searchCache.set(key, { at: Date.now(), offers });
  return offers;
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
  storesSearched: StoreId[];
  storesFailed: StoreId[];
}

export async function planForUser(request: PlanRequest): Promise<PlanResponse> {
  const stores = (request.stores?.length ? request.stores : STORE_IDS).filter((s) => s in STORES);
  const allPromotions = await getAllPromotions();
  const promotions = allPromotions.filter((p) => isEligible(p, request.profile));

  const storesFailed = new Set<StoreId>(stores);
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
          const candidates = await cachedSearch(store, stripSizeForSearch(query));
          if (candidates.length > 0) storesFailed.delete(store);
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

  return { ...result, hints, storesSearched: stores, storesFailed: [...storesFailed] };
}
