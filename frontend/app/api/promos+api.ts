import { CATALOG_UPDATED, MERCHANT_NAMES } from "../../lib/benefits/catalog";
import { getAllPromotions } from "../../lib/planner/service";

/** Every known promotion; the client filters by the user's profile (it's not stored server-side). */
export async function GET(): Promise<Response> {
  const promotions = await getAllPromotions();
  return Response.json({ updated: CATALOG_UPDATED, merchantNames: MERCHANT_NAMES, promotions });
}
