import type { ProductOffer } from "../types";
import { normalizeText } from "./normalize";

/** Stable identifier for an offer across requests (ids alone can repeat between sites). */
export function offerKey(offer: Pick<ProductOffer, "site" | "id">): string {
  return `${offer.site}:${offer.id}`;
}

/**
 * Same product by name within one store. VTEX stores list several SKUs of a
 * product under the same name, so rejecting one by id would just surface its
 * twin; rejecting by name takes them all out.
 */
export function offerNameKey(offer: Pick<ProductOffer, "site" | "name">): string {
  return `${offer.site}:name:${normalizeText(offer.name)}`;
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
  return candidates.filter((offer) => !excluded.has(offerKey(offer)) && !excluded.has(offerNameKey(offer)));
}
