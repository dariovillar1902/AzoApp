import { DAY_NAMES, type PlanDay } from "../benefits/eligibility";
import { MERCHANT_NAMES } from "../benefits/catalog";
import { sourceName } from "../benefits/sources";
import type { Promotion } from "../benefits/types";
import { storeName } from "../stores/registry";
import type { ProductOffer } from "../types";

export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

/** "hoy", "mañana" or "jueves 22/10". `days[0]` is today. */
export function dayLabel(day: PlanDay, days: PlanDay[]): string {
  const index = days.findIndex((d) => d.date === day.date);
  if (index === 0) return "hoy";
  if (index === 1) return "mañana";
  const [, month, dom] = day.date.split("-");
  return `${DAY_NAMES[day.dow]} ${dom}/${month}`;
}

export function merchantName(id: string): string {
  return MERCHANT_NAMES[id] ?? storeName(id);
}

export function promoHeadline(p: Promotion): string {
  const who = p.requires.length > 0 ? p.requires.map(sourceName).join(" + ") : "Cualquier medio";
  return `${p.discountPct}% · ${who}`;
}

export function promoConditions(p: Promotion): string {
  const parts: string[] = [];
  if (p.daysOfWeek) parts.push(p.daysOfWeek.map((d) => DAY_NAMES[d]).join(", "));
  else parts.push("todos los días");
  parts.push(p.cap ? `tope ${money(p.cap.amount)}/${p.cap.per}` : "sin tope");
  if (p.minPurchase) parts.push(`mínimo ${money(p.minPurchase)}`);
  if (p.channel === "online") parts.push("solo online");
  if (p.channel === "presencial") parts.push("solo en local");
  if (p.validUntil) parts.push(`hasta ${p.validUntil.split("-").reverse().slice(0, 2).join("/")}`);
  return parts.join(" · ");
}

/** "$1.890/kg", "$950/l", "$120/u" — for comparing different package sizes. */
export function unitPrice(offer: Pick<ProductOffer, "price" | "sizeValue" | "sizeUnit">, price = offer.price): string | null {
  if (!offer.sizeValue || offer.sizeValue <= 0 || !offer.sizeUnit) return null;
  if (offer.sizeUnit === "un") return offer.sizeValue > 1 ? `${money(price / offer.sizeValue)}/u` : null;
  const perBase = (price / offer.sizeValue) * 1000;
  return `${money(perBase)}/${offer.sizeUnit === "g" ? "kg" : "l"}`;
}
