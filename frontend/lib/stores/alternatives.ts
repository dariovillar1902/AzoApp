import { excludeOffers, offerKey } from "../core/exclusions";
import { SIZE_MISMATCH_RATIO, sizeRatio } from "../core/matching";
import { extractSize, stripSizeForSearch, tokenizeWithoutSize, tokenMatches } from "../core/normalize";
import type { ProductOffer, StoreId } from "../types";
import { STORES } from "./registry";

const DEFAULT_LIMIT = 8;
/** Never fan out to more than this many searches for one lookup. */
const MAX_SEARCHES = 4;

/**
 * Orders raw search results by how much of the query they share (most words
 * first), then by how close their size is to the requested one. Unlike the
 * automatic matcher this applies no acceptance threshold: it's meant to show
 * a person what the store actually sells so they can pick the right product.
 */
export function rankAlternatives(
  query: string,
  offers: ProductOffer[],
  limit = DEFAULT_LIMIT,
): ProductOffer[] {
  const size = extractSize(query);
  const queryTokens = [...new Set(tokenizeWithoutSize(query))];
  const seen = new Set<string>();
  const scored: { offer: ProductOffer; overlap: number; closeness: number; index: number }[] = [];

  offers.forEach((offer, index) => {
    if (!offer.inStock) return;
    const key = offerKey(offer);
    if (seen.has(key)) return;
    seen.add(key);

    const nameTokens = tokenizeWithoutSize(`${offer.brand ?? ""} ${offer.name}`);
    const overlap = queryTokens.filter((t) => nameTokens.some((n) => tokenMatches(t, n))).length;
    if (overlap === 0) return;

    // A size we can't compare (0) beats one in the same unit but far off (-1).
    const ratio = sizeRatio(size?.value ?? null, size?.unit ?? null, offer);
    const closeness = ratio === null ? 0 : ratio < SIZE_MISMATCH_RATIO ? -1 : ratio;
    scored.push({ offer, overlap, closeness, index });
  });

  scored.sort((a, b) => b.overlap - a.overlap || b.closeness - a.closeness || a.index - b.index);
  return scored.slice(0, limit).map((s) => s.offer);
}

/**
 * Lists the products a store actually carries for a query, including the
 * ones a strict all-words search would miss: besides the full query it also
 * searches each word on its own (stores' search engines usually require
 * every word, so a descriptive query often finds nothing).
 */
export async function searchAlternatives(
  store: StoreId,
  query: string,
  excludedKeys?: string[],
  limit = DEFAULT_LIMIT,
): Promise<ProductOffer[]> {
  const full = stripSizeForSearch(query);
  if (!full) return [];

  const searches = [...new Set([full, ...full.split(" ")])].slice(0, MAX_SEARCHES);
  const settled = await Promise.allSettled(searches.map((term) => STORES[store].search(term)));

  if (settled.every((r) => r.status === "rejected")) {
    throw new Error(`${store}: no se pudo consultar el sitio`);
  }

  const offers = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return rankAlternatives(query, excludeOffers(offers, excludedKeys), limit);
}
