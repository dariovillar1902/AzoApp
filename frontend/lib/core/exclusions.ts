import type { ProductOffer } from "../types";

/** Stable identifier for an offer across requests (ids alone can repeat between sites). */
export function offerKey(offer: Pick<ProductOffer, "site" | "id">): string {
  return `${offer.site}:${offer.id}`;
}

/**
 * Removes offers the user flagged as "not what I asked for". Returns a new
 * array; keys that belong to other sites are simply ignored.
 */
export function excludeOffers(
  candidates: ProductOffer[],
  excludedKeys: string[] | undefined,
): ProductOffer[] {
  if (!excludedKeys || excludedKeys.length === 0) return candidates;
  const excluded = new Set(excludedKeys);
  return candidates.filter((offer) => !excluded.has(offerKey(offer)));
}
