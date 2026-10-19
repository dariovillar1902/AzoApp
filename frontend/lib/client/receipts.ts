import { MERCHANT_NAMES } from "../benefits/catalog";
import { detectRequiredSources } from "../benefits/cotoLive";
import { capPeriodKey, isActiveOn, type CapUsage, type PlanDay } from "../benefits/eligibility";
import type { Promotion } from "../benefits/types";
import { normalizeText } from "../core/normalize";
import { STORES } from "../stores/registry";

export interface ParsedReceipt {
  /** ARS refunded/discounted. */
  amount: number;
  /** YYYY-MM-DD; today when the text has no date. */
  date: string;
  merchant: string | null;
  sources: string[];
}

/** "$ 1.234,56" / "$1234" / "ARS 1.234" → 1234.56 */
function parseArs(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/[.,]/g, "");
  return parseFloat(normalized);
}

const AMOUNT_RE =
  /(?:reintegro|devolvimos|devoluci[oó]n|reintegramos|ahorraste|descuento aplicado|bonificaci[oó]n)[^$\d]{0,40}(?:\$|ars)\s*([\d.,]+)/i;

const MERCHANT_IDS = [...Object.keys(STORES), ...Object.keys(MERCHANT_NAMES)];

function merchantIn(text: string): string | null {
  const normalized = ` ${normalizeText(text)} `;
  for (const id of MERCHANT_IDS) {
    const name = normalizeText((STORES as Record<string, { name: string }>)[id]?.name ?? MERCHANT_NAMES[id] ?? id);
    if (normalized.includes(` ${name} `) || normalized.includes(` ${id} `)) return id;
  }
  return null;
}

function dateIn(text: string, today: string): string {
  const match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (!match) return today;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/**
 * Reads a refund notice pasted from Mercado Pago, MODO or a bank ("Te
 * devolvimos $1.500 por tu compra en COTO el 17/10/2026"). Several receipts
 * can be pasted at once separated by a blank line.
 */
export function parseReceipts(text: string, today: string): ParsedReceipt[] {
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk): ParsedReceipt[] => {
      const amount = chunk.match(AMOUNT_RE);
      if (!amount) return [];
      const value = parseArs(amount[1]);
      if (!Number.isFinite(value) || value <= 0) return [];
      return [{ amount: value, date: dateIn(chunk, today), merchant: merchantIn(chunk), sources: detectRequiredSources(chunk) ?? [] }];
    });
}

function dayOf(date: string): PlanDay {
  const [y, m, d] = date.split("-").map(Number);
  return { date, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/**
 * The capped promotion a refund most likely belongs to: same merchant,
 * active that day, and every source the receipt names is one the promo
 * needs (a Mercado Pago receipt can't be the BNA+ MODO promo).
 */
export function matchReceipt(receipt: ParsedReceipt, promotions: Promotion[]): Promotion | null {
  const day = dayOf(receipt.date);
  const candidates = promotions.filter(
    (p) =>
      p.cap &&
      p.cap.per !== "compra" &&
      (!receipt.merchant || p.merchants.includes(receipt.merchant)) &&
      isActiveOn(p, day) &&
      receipt.sources.every((s) => ["visa", "mastercard", "amex"].includes(s) || p.requires.includes(s)),
  );
  // Prefer the promo that names the most of the receipt's sources, then the bigger one.
  candidates.sort(
    (a, b) =>
      receipt.sources.filter((s) => b.requires.includes(s)).length - receipt.sources.filter((s) => a.requires.includes(s)).length ||
      b.discountPct - a.discountPct,
  );
  return candidates[0] ?? null;
}

export interface AppliedReceipt {
  receipt: ParsedReceipt;
  promotion: Promotion | null;
}

/** Adds each matched refund to its promo's cap window. */
export function applyReceipts(
  usage: CapUsage,
  receipts: ParsedReceipt[],
  promotions: Promotion[],
): { usage: CapUsage; applied: AppliedReceipt[] } {
  const next = { ...usage };
  const applied = receipts.map((receipt) => {
    const promotion = matchReceipt(receipt, promotions);
    const key = promotion && capPeriodKey(promotion, dayOf(receipt.date));
    if (key) next[key] = (next[key] ?? 0) + receipt.amount;
    return { receipt, promotion };
  });
  return { usage: next, applied };
}
