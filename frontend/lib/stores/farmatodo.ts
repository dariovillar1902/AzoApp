import type { ProductOffer } from "../types";
import { extractSize } from "../core/normalize";
import { fetchWithTimeout } from "../core/http";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Farmatodo runs a custom Next.js storefront (no VTEX-style JSON search API).
// The search results page is server-rendered with plain HTML product cards,
// so we scrape those instead of hitting a JSON endpoint. There's no product
// detail link or stock flag in this markup, so `url` falls back to the
// search page and `inStock` is assumed true (out-of-stock items don't seem
// to show a price at all in this view).
const CARD_RE =
  /product-card-placeholder__name">([^<]+)<\/p><div class="product-card-placeholder__prices"><p class="product-card-placeholder__price">\$([\d.,]+)/g;

function parseArgentinePrice(text: string): number {
  // "$42.522" -> 42522 (dot is a thousands separator here, no decimals shown)
  return parseFloat(text.replace(/\./g, "").replace(",", "."));
}

export async function searchFarmatodo(query: string): Promise<ProductOffer[]> {
  const searchUrl = `https://www.farmatodo.com.ar/buscar?product=${encodeURIComponent(query)}&departamento=Todos&filtros=`;

  const res = await fetchWithTimeout(searchUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });

  if (!res.ok) {
    throw new Error(`farmatodo: busqueda fallo con status ${res.status}`);
  }

  const html = await res.text();
  const offers: ProductOffer[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = CARD_RE.exec(html)) !== null) {
    const name = match[1].replace(/&amp;/g, "&").trim();
    const price = parseArgentinePrice(match[2]);
    if (!Number.isFinite(price)) continue;

    const size = extractSize(name);

    offers.push({
      site: "farmatodo",
      id: `${index++}-${name}`,
      name,
      brand: null,
      sizeText: size?.sizeText ?? null,
      price,
      listPrice: null,
      sizeValue: size?.value ?? null,
      sizeUnit: size?.unit ?? null,
      inStock: true,
      url: searchUrl,
      addToCartUrl: null,
      imageUrl: null,
    });
  }

  return offers;
}
