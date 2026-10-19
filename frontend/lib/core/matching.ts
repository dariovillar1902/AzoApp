import type { MatchedItem, ProductOffer, ShoppingListItem } from "../types";
import {
  containmentSimilarity,
  extractSize,
  jaccardSimilarity,
  tokenizeWithoutSize,
  tokenMatches,
} from "./normalize";

const MIN_SCORE_TO_ACCEPT = 0.28;
const MIN_SCORE_FOR_EXACT = 0.55;
/** "más de 25%" per the user's own criterion for what counts as a deal worth steering toward. */
const BIG_DISCOUNT_THRESHOLD_PCT = 25;
/** How much a candidate's score is cut when it's missing the query's lead word (usually the product type, e.g. "broches" vs "suavizante"). */
const MISSING_LEAD_WORD_PENALTY = 0.35;
/**
 * How close two candidates' scores need to be to count as "equally good
 * matches" for the query. Only within this band do we let a big discount
 * break the tie — a query specific enough to clearly single out one product
 * (e.g. a named brand/line) should get that product, discount or not.
 */
const TIE_SCORE_MARGIN = 0.1;

/**
 * Below this closeness (smaller size / bigger size) the candidate is a
 * different kind of product, not a different package of the same one —
 * e.g. asking for "tierra 5kg" and getting a 300g deodorant or 25kg of wall
 * paint. The text score alone can't tell, since the query is a single word.
 */
export const SIZE_MISMATCH_RATIO = 0.25;
const SIZE_MISMATCH_PENALTY = 0.35;

/** 1 = same size, → 0 as they diverge; null when the sizes can't be compared (missing or different unit). */
export function sizeRatio(
  requestedSizeValue: number | null,
  requestedSizeUnit: string | null,
  offer: ProductOffer,
): number | null {
  if (requestedSizeValue === null || requestedSizeUnit === null) return null;
  if (offer.sizeValue === null || offer.sizeUnit !== requestedSizeUnit) return null;
  return (
    Math.min(offer.sizeValue, requestedSizeValue) /
    Math.max(offer.sizeValue, requestedSizeValue)
  );
}

function sizeScore(
  requestedSizeValue: number | null,
  requestedSizeUnit: string | null,
  offer: ProductOffer,
): number {
  if (requestedSizeValue === null || requestedSizeUnit === null) return 0.5; // neutral, no size requested
  return sizeRatio(requestedSizeValue, requestedSizeUnit, offer) ?? 0;
}

function scoreOffer(
  requestTokens: string[],
  requestedSizeValue: number | null,
  requestedSizeUnit: string | null,
  offer: ProductOffer,
): number {
  const offerTokens = tokenizeWithoutSize(`${offer.brand ?? ""} ${offer.name}`);
  const textScore = Math.max(
    jaccardSimilarity(requestTokens, offerTokens),
    containmentSimilarity(requestTokens, offerTokens) * 0.85,
  );
  const szScore = sizeScore(requestedSizeValue, requestedSizeUnit, offer);
  // text similarity matters most, size match is a strong secondary signal
  let score = textScore * 0.7 + szScore * 0.3;

  // The first content word of a short grocery query is almost always the
  // product type itself ("broches", "suavizante", "papel"...). If it's
  // nowhere in the candidate, generic filler words matching alone (e.g. both
  // mentioning "ropa") shouldn't be enough to call it the same product.
  if (
    requestTokens.length > 0 &&
    !offerTokens.some((t) => tokenMatches(requestTokens[0], t))
  ) {
    score *= MISSING_LEAD_WORD_PENALTY;
  }

  const ratio = sizeRatio(requestedSizeValue, requestedSizeUnit, offer);
  if (ratio !== null && ratio < SIZE_MISMATCH_RATIO) {
    score *= SIZE_MISMATCH_PENALTY;
  }

  return score;
}

/** % markdown already baked into the offer's own price (not a conditional bulk promo). */
function discountPctOf(offer: ProductOffer): number {
  if (offer.listPrice && offer.listPrice > offer.price) {
    return ((offer.listPrice - offer.price) / offer.listPrice) * 100;
  }
  return 0;
}

/**
 * Picks the best candidate for a requested item out of a site's search
 * results, preferring in-stock products that match brand/size closely.
 *
 * When the query is generic enough that several in-stock candidates match it
 * about equally well (e.g. "suavizante para ropa" with no brand given), one
 * carrying a big everyday discount (25%+, the user's own bar for "worth
 * steering me toward") is preferred over the others — the same way a
 * shopper eyeballing a shelf of near-identical products would grab the one
 * on sale. A query specific enough to clearly single out one product (a
 * named brand/line that scores well ahead of the rest) keeps that product
 * regardless of what else is on sale. Falls back to the closest in-stock
 * substitute when the best textual match is out of stock, and reports why a
 * substitution happened either way.
 */
export function pickBestOffer(
  requested: ShoppingListItem,
  candidates: ProductOffer[],
): MatchedItem {
  const size = extractSize(requested.query);
  const requestTokens = tokenizeWithoutSize(requested.query);

  const scored = candidates
    .map((offer) => ({
      offer,
      score: scoreOffer(requestTokens, size?.value ?? null, size?.unit ?? null, offer),
      discountPct: discountPctOf(offer),
    }))
    .filter((c) => c.score >= MIN_SCORE_TO_ACCEPT)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { requested, offer: null, score: 0, isSubstitute: false };
  }

  const topMatch = scored[0];
  const inStock = scored.filter((c) => c.offer.inStock);

  if (inStock.length === 0) {
    return { requested, offer: null, score: 0, isSubstitute: false };
  }

  const tiedContenders = inStock.filter((c) => c.score >= inStock[0].score - TIE_SCORE_MARGIN);
  const bigDiscounts = tiedContenders.filter((c) => c.discountPct >= BIG_DISCOUNT_THRESHOLD_PCT);

  if (bigDiscounts.length > 0) {
    const chosen = [...bigDiscounts].sort((a, b) => b.discountPct - a.discountPct)[0];
    return {
      requested,
      offer: chosen.offer,
      score: chosen.score,
      isSubstitute: chosen.offer !== topMatch.offer,
      substituteReason:
        chosen.offer !== topMatch.offer
          ? `Se priorizo por tener ${chosen.discountPct.toFixed(0)}% de descuento sobre otras opciones igual de parecidas al pedido.`
          : undefined,
    };
  }

  const best = inStock[0];
  if (best.offer === topMatch.offer) {
    return {
      requested,
      offer: best.offer,
      score: best.score,
      isSubstitute: best.score < MIN_SCORE_FOR_EXACT,
      substituteReason:
        best.score < MIN_SCORE_FOR_EXACT
          ? "No se encontro una coincidencia exacta; se eligio el producto mas parecido disponible."
          : undefined,
    };
  }

  // Best textual match is out of stock: `best` is the closest in-stock alternative.
  return {
    requested,
    offer: best.offer,
    score: best.score,
    isSubstitute: true,
    substituteReason: `"${topMatch.offer.name}" esta sin stock; se reemplazo por un producto similar.`,
  };
}
