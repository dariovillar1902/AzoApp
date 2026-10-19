import type { ProductOffer, StoreId } from "../types";
import { extractSize } from "../core/normalize";
import { fetchWithTimeout } from "../core/http";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

interface VtexCommertialOffer {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
  IsAvailable: boolean;
}

interface VtexSeller {
  sellerId: string;
  addToCartLink: string;
  commertialOffer: VtexCommertialOffer;
}

interface VtexItem {
  itemId: string;
  measurementUnit: string;
  unitMultiplier: number;
  images: { imageUrl: string }[];
  sellers: VtexSeller[];
}

interface VtexProduct {
  productId: string;
  productName: string;
  brand: string | null;
  link: string;
  items: VtexItem[];
}

/**
 * The "before" price, when it's believable. Cencosud's stores (Jumbo, Disco,
 * Vea) fill ListPrice with an unrelated figure ~80x the real price (e.g.
 * 214876 for a $2.600 milk); trusting it would make every product look ~99%
 * off and skew both matching and the fake-discount warning.
 */
export function plausibleListPrice(price: number, listPrice: number): number | null {
  return listPrice > price && listPrice <= price * 3 ? listPrice : null;
}

/**
 * Searches a VTEX-powered storefront's classic (legacy) search API. Both
 * Carrefour Argentina and Dia Argentina run on VTEX, so this is shared.
 */
export async function searchVtex(
  baseUrl: string,
  site: StoreId,
  query: string,
  limit = 20,
): Promise<ProductOffer[]> {
  const url = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=${limit - 1}`;

  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (res.status !== 200 && res.status !== 206) {
    throw new Error(`${site}: busqueda fallo con status ${res.status}`);
  }

  const products = (await res.json()) as VtexProduct[];
  const offers: ProductOffer[] = [];

  for (const product of products) {
    for (const item of product.items ?? []) {
      const seller = item.sellers?.[0];
      if (!seller) continue;
      const offer = seller.commertialOffer;
      const size = extractSize(product.productName);

      offers.push({
        site,
        id: `${product.productId}-${item.itemId}`,
        name: product.productName,
        brand: product.brand ?? null,
        sizeText: size?.sizeText ?? null,
        sizeValue: size?.value ?? null,
        sizeUnit: size?.unit ?? null,
        price: offer.Price,
        listPrice: plausibleListPrice(offer.Price, offer.ListPrice),
        inStock: offer.IsAvailable && offer.AvailableQuantity > 0,
        url: product.link,
        addToCartUrl: seller.addToCartLink ?? null,
        imageUrl: item.images?.[0]?.imageUrl ?? null,
      });
    }
  }

  return offers;
}
