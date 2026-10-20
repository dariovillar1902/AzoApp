import type { ProductOffer } from "../types";
import { extractSize } from "../core/normalize";
import { fetchWithTimeout } from "../core/http";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

interface MlApiResult {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  permalink: string;
  thumbnail: string | null;
  available_quantity?: number;
}

function offer(id: string, name: string, price: number, listPrice: number | null, url: string, imageUrl: string | null): ProductOffer {
  const size = extractSize(name);
  return {
    site: "mercadolibre",
    id,
    name,
    brand: null,
    sizeText: size?.sizeText ?? null,
    sizeValue: size?.value ?? null,
    sizeUnit: size?.unit ?? null,
    price,
    listPrice: listPrice && listPrice > price ? listPrice : null,
    inStock: true,
    url,
    addToCartUrl: null,
    imageUrl,
  };
}

async function searchApi(query: string): Promise<ProductOffer[]> {
  const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=30`;
  const res = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`mercadolibre api ${res.status}`);
  const json = (await res.json()) as { results?: MlApiResult[] };
  return (json.results ?? []).map((r) => offer(r.id, r.title, r.price, r.original_price, r.permalink, r.thumbnail));
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function fraction(chunk: string): number | null {
  const match = chunk.match(/andes-money-amount__fraction[^>]*>([\d.]+)</);
  return match ? parseInt(match[1].replace(/\./g, ""), 10) : null;
}

/** Parses the server-rendered results page ("poly-card" product cards). */
export function parseListing(html: string): ProductOffer[] {
  const offers: ProductOffer[] = [];
  for (const card of html.split(/class="[^"]*poly-card[ "]/).slice(1)) {
    const title = card.match(/poly-component__title[^>]*>(?:<a[^>]*>)?([^<]+)</);
    const href = card.match(/href="(https:\/\/[^"]*mercadolibre\.com\.ar[^"]*)"/);
    const current = card.split(/poly-price__current/)[1];
    const previous = card.match(/andes-money-amount--previous[\s\S]*?andes-money-amount__fraction[^>]*>([\d.]+)</);
    const price = current ? fraction(current) : fraction(card);
    if (!title || !href || !price) continue;
    const url = decode(href[1]).split("#")[0];
    const id = url.match(/MLA-?\d+/)?.[0]?.replace("-", "") ?? url;
    const image = card.match(/<img[^>]+(?:data-src|src)="(https:\/\/http2\.mlstatic\.com[^"]+)"/);
    offers.push(offer(id, decode(title[1]), price, previous ? parseInt(previous[1].replace(/\./g, ""), 10) : null, url, image?.[1] ?? null));
  }
  return offers;
}

async function searchListing(query: string): Promise<ProductOffer[]> {
  const slug = query.trim().toLowerCase().replace(/\s+/g, "-");
  const res = await fetchWithTimeout(`https://listado.mercadolibre.com.ar/${encodeURIComponent(slug).replace(/%2D/g, "-")}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "es-AR" },
  });
  if (!res.ok) throw new Error(`mercadolibre listado ${res.status} (${res.url})`);
  const html = await res.text();
  if (!html.includes("poly-card")) console.warn(`mercadolibre: ${res.url} → ${html.match(/<title>([^<]*)/)?.[1] ?? html.length}`);
  return parseListing(html);
}

/**
 * Mercado Libre (incl. its Supermercado). The public search API now often
 * asks for a token, so when it refuses we read the results page instead.
 */
export async function searchMercadoLibre(query: string): Promise<ProductOffer[]> {
  try {
    const offers = await searchApi(query);
    if (offers.length > 0) return offers;
  } catch (err) {
    console.warn(`mercadolibre: ${(err as Error).message}, trying the results page`);
  }
  const offers = await searchListing(query);
  if (offers.length === 0) console.warn(`mercadolibre: results page had no product cards for "${query}"`);
  return offers;
}
