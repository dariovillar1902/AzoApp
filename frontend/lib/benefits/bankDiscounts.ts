import { fetchWithTimeout } from "../core/http";
import { stripAccents } from "../core/normalize";
import { CATALOG } from "./catalog";
import { sourceName } from "./sources";
import type { Promotion } from "./types";
import type { ScrapedDiscount } from "./scrapedPromos";

/** A benefit as shown in Explorar: what the banks publish, plus our curated catalog. */
export interface BankDiscount extends ScrapedDiscount {
  id: string;
  category: string;
  imageUrl: string | null;
  /** Sources needed to use it; Explorar's "Mis medios" filter checks the user has all of them. */
  requires: string[];
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Same list as the .NET ScraperHelpers.KnownStores. */
const KNOWN_STORES = [
  "Carrefour", "Coto", "Walmart", "Jumbo", "Disco", "Vea", "Día", "La Anónima", "Toledo", "Makro", "Changomas",
  "Musimundo", "Garbarino", "Fravega", "Cetrogar", "Megatone", "Apple", "Samsung",
  "Burger King", "McDonald's", "Mostaza", "Wendy's", "Starbucks", "TGI Fridays", "Hard Rock",
  "Cabify", "Rappi", "PedidosYa", "Uber Eats", "Mercado Libre",
  "Shell", "YPF", "Axion", "Puma", "Gulf",
  "Farmacity", "Dr. Ahorro", "Farmaplus", "Farmaonline",
  "Falabella", "Ripley", "Zara", "H&M", "Adidas", "Nike",
  "Despegar", "Booking", "Airbnb",
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Known store names in the text, whole words only ("todos los días" isn't the store "Día"). */
export function extractStores(text: string | null | undefined): string[] {
  if (!text) return [];
  return KNOWN_STORES.filter((store) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(store)}(?![\\p{L}\\p{N}])`, "iu").test(text));
}

const DAY_KEYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Weekdays named in a promo ("lunes a jueves", "sábados y domingos", "fin de semana"), Monday first. */
export function extractValidDays(text: string | null | undefined): string[] {
  if (!text) return [];
  const t = stripAccents(text.toLowerCase());
  const days = new Set<number>();
  const alt = DAY_KEYS.join("|");
  for (const range of t.matchAll(new RegExp(`\\b(${alt})s? a (${alt})s?\\b`, "g"))) {
    const to = DAY_KEYS.indexOf(range[2]);
    for (let i = DAY_KEYS.indexOf(range[1]); ; i = (i + 1) % 7) {
      days.add(i);
      if (i === to) break;
    }
  }
  DAY_KEYS.forEach((key, i) => {
    if (new RegExp(`\\b${key}s?\\b`).test(t)) days.add(i);
  });
  if (t.includes("fin de semana")) {
    days.add(6);
    days.add(0);
  }
  return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((i) => DAY_NAMES[i]);
}

function classify(text: string): { amount: number | null; category: string } {
  if (/\d+\s*x\s*\d+/i.test(text)) return { amount: null, category: "Promoción" };
  const pct = text.match(/(\d+)\s*%/);
  const category = /(cuotas|csi|sin inter)/i.test(text) ? "Financiación" : pct ? "Ahorro" : "Varios";
  return { amount: pct ? parseInt(pct[1], 10) : null, category };
}

/** Stable id from the bank and title, so the detail page can find it again after a refetch. */
function idFor(prefix: string, title: string): string {
  let hash = 5381;
  for (const ch of title) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `${prefix}-${hash.toString(36)}`;
}

function build(
  bank: { prefix: string; name: string; requires: string[] },
  raw: { title: string; description: string; imageUrl: string | null; url: string },
): BankDiscount {
  const text = `${raw.title} ${raw.description}`;
  const stores = extractStores(raw.description).length > 0 ? extractStores(raw.description) : extractStores(raw.title);
  return {
    id: idFor(bank.prefix, text),
    title: raw.title,
    description: raw.description,
    bankName: bank.name,
    ...classify(text),
    currency: "%",
    validDays: extractValidDays(text),
    url: raw.url,
    imageUrl: raw.imageUrl,
    expirationDate: null,
    scrapedAt: new Date().toISOString(),
    stores: stores.length > 0 ? stores : null,
    requires: bank.requires,
  };
}

async function getJson(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetchWithTimeout(url, { ...init, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers } }, 8000);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function fetchSantander(): Promise<BankDiscount[]> {
  const root = await getJson("https://www.santander.com.ar/bff-benefits/brands?page=1&limit=50");
  const items: any[] = root?.items ?? root?.brands ?? root?.data?.brands ?? [];
  const bank = { prefix: "santander", name: "Santander", requires: ["santander"] };
  return items.map((item) => {
    let image: string | null = item.desktopMinImage ?? item.mobileMinImage ?? item.desktopImage ?? item.images?.detail ?? item.images?.logo ?? null;
    if (image && !image.startsWith("http")) image = `https://www.santander.com.ar${image}`;
    return build(bank, {
      title: String(item.name ?? "Descuento Santander"),
      description: String(item.benefitDescription ?? ""),
      imageUrl: image,
      url: "https://www.santander.com.ar/personas/beneficios",
    });
  });
}

export async function fetchCiudad(): Promise<BankDiscount[]> {
  const headers = { Referer: "https://www.bancociudad.com.ar/institucional/beneficios/", Origin: "https://www.bancociudad.com.ar" };
  let root: any;
  try {
    root = await getJson("https://www.bancociudad.com.ar/beneficios_rest/beneficios/inicializacion", { headers });
  } catch {
    root = await getJson("https://www.bancociudad.com.ar/beneficios_rest/beneficios/busqueda", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
  }
  if (root?.mensaje === "ERROR") return [];
  const items: any[] = root?.beneficios ?? root?.items ?? (Array.isArray(root) ? root : []);
  const bank = { prefix: "ciudad", name: "Banco Ciudad", requires: ["ciudad"] };
  return items.map((item) => {
    const image = item.imagen ?? item.img_cuerpo;
    return build(bank, {
      title: String(item.titulo ?? item.nombre ?? "Descuento B. Ciudad"),
      description: String(item.descripcion ?? ""),
      imageUrl: image ? `https://www.bancociudad.com.ar${image}` : null,
      url: "https://www.bancociudad.com.ar/beneficios",
    });
  });
}

export async function fetchBbva(): Promise<BankDiscount[]> {
  const root = await getJson("https://go.bbva.com.ar/willgo/fgo/API/v3/communications?destacado=true&pager=0");
  const items: any[] = root?.data ?? [];
  const bank = { prefix: "bbva", name: "BBVA", requires: ["bbva"] };
  return items.map((item) =>
    build(bank, {
      title: String(item.cabecera ?? "Descuento BBVA"),
      description: String(item.subcabecera ?? ""),
      imageUrl: item.imagen ?? null,
      url: item.link ?? "https://www.bbva.com.ar",
    }),
  );
}

const DAY_NAME_BY_INDEX = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Our curated promos (súper, farmacia, nafta) as Explorar cards, so Nación, MODO, Mercado Pago… show up too. */
export function catalogDiscounts(promotions: Promotion[] = CATALOG, merchantNames: Record<string, string> = {}): BankDiscount[] {
  return promotions.map((p) => {
    const who = p.requires.length > 0 ? p.requires.map(sourceName).join(" + ") : "Cualquier medio";
    const where = p.merchants.map((m) => merchantNames[m] ?? m).join(", ");
    const conditions = [
      p.cap ? `Tope $${p.cap.amount.toLocaleString("es-AR")} por ${p.cap.per}` : "Sin tope",
      p.minPurchase ? `mínimo $${p.minPurchase.toLocaleString("es-AR")}` : null,
      p.payment,
      p.notes,
    ].filter(Boolean);
    return {
      id: `catalogo-${p.id}`,
      title: `${p.discountPct}% en ${where}`,
      description: conditions.join(". "),
      bankName: who,
      amount: p.discountPct,
      currency: "%",
      category: { combustible: "Combustible", farmacia: "Farmacia", comercios: "Comercios", supermercado: "Supermercado" }[p.category],
      validDays: p.daysOfWeek ? [...p.daysOfWeek].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_NAME_BY_INDEX[d]) : [],
      url: p.sourceUrl ?? null,
      imageUrl: null,
      expirationDate: p.validUntil ?? null,
      scrapedAt: p.checkedAt,
      stores: p.merchants.map((m) => merchantNames[m] ?? m),
      requires: p.requires,
    };
  });
}

export interface BankDiscountsResult {
  discounts: BankDiscount[];
  /** Banks whose site didn't answer this time. */
  failed: string[];
  fetchedAt: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { at: number; result: Promise<BankDiscountsResult> } | null = null;

/** Live benefits from the banks' own public APIs (what the .NET backend used to scrape), cached 30 min. */
export function fetchLiveBankDiscounts(): Promise<BankDiscountsResult> {
  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    const sources: [string, () => Promise<BankDiscount[]>][] = [
      ["Santander", fetchSantander],
      ["Banco Ciudad", fetchCiudad],
      ["BBVA", fetchBbva],
    ];
    const result = Promise.all(
      sources.map(async ([name, fetcher]) => {
        try {
          const list = await fetcher();
          return { name, list, ok: list.length > 0 };
        } catch (err) {
          console.warn(`bankDiscounts ${name}: ${(err as Error).message}`);
          return { name, list: [] as BankDiscount[], ok: false };
        }
      }),
    ).then((all) => ({
      discounts: all.flatMap((r) => r.list),
      failed: all.filter((r) => !r.ok).map((r) => r.name),
      fetchedAt: new Date().toISOString(),
    }));
    cache = { at: Date.now(), result };
    // Don't keep a total failure for 30 minutes.
    result.then((r) => {
      if (r.discounts.length === 0 && cache?.result === result) cache = null;
    });
  }
  return cache.result;
}

