import { catalogDiscounts, fetchLiveBankDiscounts } from "../../lib/benefits/bankDiscounts";
import { CATALOG, CATALOG_UPDATED, MERCHANT_NAMES } from "../../lib/benefits/catalog";

/** Explorar: benefits the banks publish today plus the curated catalog. */
export async function GET(): Promise<Response> {
  const live = await fetchLiveBankDiscounts();
  return Response.json({
    discounts: [...catalogDiscounts(CATALOG, MERCHANT_NAMES), ...live.discounts],
    failed: live.failed,
    fetchedAt: live.fetchedAt,
    catalogUpdated: CATALOG_UPDATED,
  });
}
