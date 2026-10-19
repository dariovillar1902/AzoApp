import { DEFAULT_SOURCE_IDS } from "../../lib/benefits/sources";
import { parseShoppingList } from "../../lib/planner/parseList";
import { planForUser } from "../../lib/planner/service";
import type { ShoppingListItem, StoreId } from "../../lib/types";

interface PlanBody {
  /** Free text ("2 leche\nyerba") or already-parsed items. */
  text?: string;
  items?: ShoppingListItem[];
  sources?: string[];
  audiences?: string[];
  stores?: StoreId[];
  storePenalty?: number;
}

export async function POST(request: Request): Promise<Response> {
  let body: PlanBody;
  try {
    body = (await request.json()) as PlanBody;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  return plan(body);
}

/** GET ?text=2 leche%0Ayerba[&sources=nacion,modo] — same as POST, handy for links and quick checks. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  return plan({
    text: params.get("text") ?? "",
    sources: params.get("sources")?.split(",").filter(Boolean),
  });
}

async function plan(body: PlanBody): Promise<Response> {
  const items = (body.items ?? parseShoppingList(body.text ?? ""))
    .filter((i) => typeof i.query === "string" && i.query.trim().length > 0)
    .map((i) => ({ ...i, query: i.query.trim(), quantity: Math.max(1, Math.round(i.quantity || 1)) }))
    .slice(0, 40);
  if (items.length === 0) {
    return Response.json({ error: "La lista está vacía" }, { status: 400 });
  }

  const result = await planForUser({
    items,
    profile: { sources: body.sources ?? DEFAULT_SOURCE_IDS, audiences: body.audiences },
    stores: body.stores,
    storePenalty: body.storePenalty,
  });
  return Response.json(result);
}
