import { fetchWithTimeout } from "../core/http";
import { normalizeText } from "../core/normalize";
import type { CapPeriod, PromoCategory, Promotion } from "./types";

/** Shape of `GET /api/discounts` on the .NET backend (DiscountApp.Core.Entities.Discount). */
export interface ScrapedDiscount {
  id: number;
  title: string;
  description: string | null;
  bankName: string | null;
  amount: number | null;
  currency: string | null;
  validDays: string[] | null;
  url: string | null;
  expirationDate: string | null;
  scrapedAt: string;
  stores: string[] | null;
}

/** Scraper `BankName` → the sources it needs. Scrapers for sources we don't model are left out. */
const BANK_SOURCES: Record<string, string[]> = {
  "Banco Nación": ["nacion"],
  Santander: ["santander"],
  "Banco Ciudad": ["ciudad"],
  "Club La Nacion": ["clublanacion"],
  BBVA: ["bbva"],
};

/** Store names as ScraperHelpers.KnownStores spells them → merchant id and category. */
const MERCHANTS: Record<string, { id: string; category: PromoCategory }> = {
  carrefour: { id: "carrefour", category: "supermercado" },
  coto: { id: "coto", category: "supermercado" },
  dia: { id: "dia", category: "supermercado" },
  jumbo: { id: "jumbo", category: "supermercado" },
  disco: { id: "disco", category: "supermercado" },
  vea: { id: "vea", category: "supermercado" },
  changomas: { id: "changomas", category: "supermercado" },
  farmacity: { id: "farmacity", category: "farmacia" },
  ypf: { id: "ypf", category: "combustible" },
  shell: { id: "shell", category: "combustible" },
  axion: { id: "axion", category: "combustible" },
};

const DAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function parseCap(text: string): { amount: number; per: CapPeriod } | undefined {
  const match = text.match(/tope(?: de reintegro| de devoluci[oó]n)?\s*(?:de\s*)?\$\s*([\d.]+)(?:[^.$]{0,30}?(semana|mes|compra|transacci))?/i);
  if (!match) return undefined;
  const amount = parseInt(match[1].replace(/\./g, ""), 10);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = match[2]?.toLowerCase();
  const per: CapPeriod = unit === "semana" ? "semana" : unit === "compra" || unit === "transacci" ? "compra" : "mes";
  return { amount, per };
}

/**
 * Converts discounts the .NET scrapers read from the banks' own sites into
 * planner promotions. Only keeps what the planner can use safely: a
 * percentage, a chain we know, and explicit days (or an explicit "todos los
 * días") — a promo with no stated day is more likely missing data than valid
 * every day.
 */
export function promotionsFromScraped(discounts: ScrapedDiscount[]): Promotion[] {
  const today = new Date().toISOString().slice(0, 10);
  return discounts.flatMap((d): Promotion[] => {
    const requires = d.bankName ? BANK_SOURCES[d.bankName] : undefined;
    if (!requires || d.currency !== "%" || d.amount === null || d.amount <= 0 || d.amount > 80) return [];

    const merchants = (d.stores ?? []).map((s) => MERCHANTS[normalizeText(s).replace(/\s/g, "")]).filter(Boolean);
    if (merchants.length === 0) return [];

    const text = `${d.title} ${d.description ?? ""}`;
    const days = (d.validDays ?? []).map((day) => DAY_INDEX[normalizeText(day)]).filter((i) => i !== undefined);
    const everyDay = /todos los d[ií]as/i.test(text);
    if (days.length === 0 && !everyDay) return [];

    return [
      {
        id: `banco-${d.id}`,
        requires,
        category: merchants[0].category,
        merchants: [...new Set(merchants.map((m) => m.id))],
        daysOfWeek: days.length > 0 ? [...new Set(days)] : undefined,
        discountPct: d.amount,
        cap: parseCap(text),
        payment: d.description ?? undefined,
        validUntil: d.expirationDate?.slice(0, 10),
        confidence: "verificar",
        checkedAt: d.scrapedAt?.slice(0, 10) ?? today,
        sourceUrl: d.url ?? undefined,
        notes: d.title,
        origin: "banco-live",
      },
    ];
  });
}

/**
 * Reads the .NET backend's scraped discounts when DISCOUNTS_API_URL is set
 * (e.g. http://localhost:5075). Without it, or if it's down, the planner
 * just uses the catalog and Coto's live promos.
 */
export async function fetchScrapedPromotions(): Promise<Promotion[]> {
  const base = process.env.DISCOUNTS_API_URL;
  if (!base) return [];
  const res = await fetchWithTimeout(`${base.replace(/\/$/, "")}/api/discounts`, {}, 5000);
  if (!res.ok) return [];
  return promotionsFromScraped((await res.json()) as ScrapedDiscount[]);
}
