import { searchAlternatives } from "../../lib/stores/alternatives";
import { STORES } from "../../lib/stores/registry";
import type { StoreId } from "../../lib/types";

/** GET ?store=coto&q=leche&exclude=coto:123,coto:456 → what that store sells for the query. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const store = params.get("store") as StoreId | null;
  const query = params.get("q")?.trim() ?? "";
  if (!store || !(store in STORES) || !query) {
    return Response.json({ error: "Faltan store y q" }, { status: 400 });
  }

  const excluded = params.get("exclude")?.split(",").filter(Boolean);
  try {
    const offers = await searchAlternatives(store, query, excluded);
    return Response.json({ offers });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
