import { catalogDiscounts, fetchLiveBankDiscounts } from "../../../lib/benefits/bankDiscounts";
import { CATALOG, MERCHANT_NAMES } from "../../../lib/benefits/catalog";

export async function GET(_request: Request, { id }: { id: string }): Promise<Response> {
  const live = await fetchLiveBankDiscounts();
  const found = [...catalogDiscounts(CATALOG, MERCHANT_NAMES), ...live.discounts].find((d) => d.id === id);
  return found ? Response.json(found) : Response.json({ error: "No encontrado" }, { status: 404 });
}
