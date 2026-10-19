import type { ProductOffer } from "../types";
import { extractSize } from "../core/normalize";
import { fetchWithTimeout } from "../core/http";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Public Constructor.io client key used by coto.com.ar's own storefront (safe
// to reuse client-side, same as any public search widget key).
const COTO_KEY = "key_r6xzz4IAoTWcipni";
const COTO_CLIENT = "cio-fe-web-coto-4.4.0";
// Store code used across the whole catalog for the generic "online" listing.
const ONLINE_STORE = "200";

interface CotoDiscount {
  takingText: string | null;
  discountText: string | null;
  discountPrice: string | null;
}

interface CotoPriceEntry {
  store: string;
  listPrice: number;
}

interface CotoResultData {
  id: string;
  url: string;
  price: CotoPriceEntry[];
  sku_display_name: string;
  product_brand: string | null;
  product_format: string | null;
  store_availability: string[];
  product_list_price: number;
  product_large_image_url: string | null;
  discounts: CotoDiscount[];
}

interface CotoResult {
  data: CotoResultData;
}

interface CotoSearchResponse {
  response?: { results: CotoResult[] };
}

function parseMoney(text: string | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function bestDiscount(discounts: CotoDiscount[]): {
  minQty: number;
  unitPrice: number;
  label: string;
} | null {
  for (const d of discounts) {
    const unitPrice = parseMoney(d.discountPrice);
    if (unitPrice === null) continue;
    const match = d.takingText?.match(/(\d+)/);
    const minQty = match ? parseInt(match[1], 10) : 1;
    return { minQty, unitPrice, label: d.discountText ?? d.takingText ?? "" };
  }
  return null;
}

export async function searchCoto(
  query: string,
  limit = 20,
): Promise<ProductOffer[]> {
  const instanceId = "00000000-0000-4000-8000-000000000000";
  const url =
    `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/${encodeURIComponent(query)}` +
    `?key=${COTO_KEY}&num_results_per_page=${limit}&c=${COTO_CLIENT}&i=${instanceId}&s=1` +
    `&pre_filter_expression=${encodeURIComponent(JSON.stringify({ name: "store_availability", value: ONLINE_STORE }))}`;

  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (res.status !== 200) {
    throw new Error(`coto: busqueda fallo con status ${res.status}`);
  }

  const json = (await res.json()) as CotoSearchResponse;
  const results = json.response?.results ?? [];
  const offers: ProductOffer[] = [];

  for (const { data } of results) {
    const priceEntry =
      data.price.find((p) => p.store === ONLINE_STORE) ?? data.price[0];
    if (!priceEntry) continue;

    const size = extractSize(
      `${data.sku_display_name} ${data.product_format ?? ""}`,
    );
    const promo = bestDiscount(data.discounts ?? []);
    const regularPrice = data.product_list_price ?? priceEntry.listPrice;
    // A promo with no (or a 1-unit) buy condition is already the real price
    // you'd pay for a single unit, so fold it straight into price/listPrice.
    // Ones that need "Llevando 3" etc. stay conditional (see promoMinQty).
    const isUnconditionalDiscount = promo !== null && promo.minQty <= 1;

    offers.push({
      site: "coto",
      id: data.id,
      name: data.sku_display_name,
      brand: data.product_brand,
      sizeText: size?.sizeText ?? data.product_format ?? null,
      sizeValue: size?.value ?? null,
      sizeUnit: size?.unit ?? null,
      price: isUnconditionalDiscount ? promo.unitPrice : regularPrice,
      listPrice: isUnconditionalDiscount ? regularPrice : null,
      inStock: data.store_availability.includes(ONLINE_STORE),
      url: `https://www.coto.com.ar/productos/${data.url}`,
      addToCartUrl: null,
      imageUrl: data.product_large_image_url,
      promoMinQty: isUnconditionalDiscount ? undefined : promo?.minQty,
      promoUnitPrice: isUnconditionalDiscount ? undefined : promo?.unitPrice,
      promoLabel: promo?.label,
    });
  }

  return offers;
}
