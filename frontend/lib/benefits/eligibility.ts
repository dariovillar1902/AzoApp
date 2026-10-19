import type { Promotion } from "./types";

export interface UserProfile {
  /** Source ids the user has (see sources.ts). */
  sources: string[];
  /** Segments the user belongs to, e.g. "jubilados". Promos for other segments are ignored. */
  audiences?: string[];
}

export interface PlanDay {
  /** YYYY-MM-DD in Buenos Aires time. */
  date: string;
  /** 0 = Sunday ... 6 = Saturday. */
  dow: number;
}

const BA_TZ = "America/Argentina/Buenos_Aires";
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Today plus the following `count - 1` days, as calendar dates in Buenos Aires. */
export function upcomingDays(now: Date = new Date(), count = 7): PlanDay[] {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const days: PlanDay[] = [];
  for (let i = 0; i < count; i++) {
    const parts = fmt.formatToParts(new Date(now.getTime() + i * 86_400_000));
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    days.push({
      date: `${get("year")}-${get("month")}-${get("day")}`,
      dow: DOW_SHORT.indexOf(get("weekday")),
    });
  }
  return days;
}

export function isEligible(promo: Promotion, profile: UserProfile): boolean {
  if (promo.audience && !(profile.audiences ?? []).includes(promo.audience)) return false;
  return promo.requires.every((source) => profile.sources.includes(source));
}

export function isActiveOn(promo: Promotion, day: PlanDay): boolean {
  if (promo.daysOfWeek && !promo.daysOfWeek.includes(day.dow)) return false;
  if (promo.validFrom && day.date < promo.validFrom) return false;
  if (promo.validUntil && day.date > promo.validUntil) return false;
  return true;
}

/**
 * Discount in ARS for spending `amount` in one purchase; 0 when below the
 * minimum purchase. `capLeft` overrides the cap when part of it is used up.
 */
export function discountFor(promo: Promotion, amount: number, capLeft?: number): number {
  if (promo.minPurchase && amount < promo.minPurchase) return 0;
  const raw = amount * (promo.discountPct / 100);
  const cap = capLeft ?? promo.cap?.amount;
  return cap === undefined ? raw : Math.max(0, Math.min(raw, cap));
}

/**
 * Which cap window a purchase on `day` counts against: "2026-10" for monthly
 * caps, the Monday of that week for weekly ones. Per-purchase caps (and
 * uncapped promos) never accumulate, so they have no key.
 */
export function capPeriodKey(promo: Promotion, day: PlanDay): string | null {
  if (promo.cap?.per === "mes") return `${promo.id}@${day.date.slice(0, 7)}`;
  if (promo.cap?.per === "semana") {
    const [y, m, d] = day.date.split("-").map(Number);
    const monday = new Date(Date.UTC(y, m - 1, d - ((day.dow + 6) % 7)));
    return `${promo.id}@${monday.toISOString().slice(0, 10)}`;
  }
  return null;
}

/** ARS of each cap window already used, keyed by `capPeriodKey`. */
export type CapUsage = Record<string, number>;

export function capLeft(promo: Promotion, day: PlanDay, used: CapUsage): number | undefined {
  const key = capPeriodKey(promo, day);
  if (!key || !promo.cap) return undefined;
  return Math.max(0, promo.cap.amount - (used[key] ?? 0));
}

export interface AppliedPromotion {
  promotion: Promotion;
  discount: number;
}

/**
 * Best single promotion for spending `amount` at `merchant` on `day`, given
 * what's already used of each cap. Bank promos don't stack, so we never add
 * two together.
 */
export function bestPromotion(
  merchant: string,
  amount: number,
  day: PlanDay,
  promotions: Promotion[],
  used: CapUsage = {},
): AppliedPromotion | null {
  let best: AppliedPromotion | null = null;
  for (const promotion of promotions) {
    if (!promotion.merchants.includes(merchant) || !isActiveOn(promotion, day)) continue;
    const discount = discountFor(promotion, amount, capLeft(promotion, day, used));
    if (discount > 0 && (!best || discount > best.discount)) best = { promotion, discount };
  }
  return best;
}
