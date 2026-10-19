import { offerKey } from "../core/exclusions";
import type { PlanResponse } from "../planner/service";
import type { ProductOffer } from "../types";

export interface PricePoint {
  date: string;
  price: number;
  listPrice: number | null;
}

/** Prices seen per product (offerKey), at most one point per day. */
export type PriceHistory = Record<string, { name: string; points: PricePoint[] }>;

const MAX_POINTS = 90;

/** Adds every product priced in a plan (all stores, not just the chosen ones) to the history. */
export function recordPlan(history: PriceHistory, plan: PlanResponse, date: string): PriceHistory {
  const next: PriceHistory = { ...history };
  for (const itemPlan of plan.items) {
    for (const option of itemPlan.options) {
      const offer = option.offer;
      const key = offerKey(offer);
      const entry = next[key] ?? { name: offer.name, points: [] };
      const points = entry.points.filter((p) => p.date !== date);
      points.push({ date, price: offer.price, listPrice: offer.listPrice });
      points.sort((a, b) => a.date.localeCompare(b.date));
      next[key] = { name: offer.name, points: points.slice(-MAX_POINTS) };
    }
  }
  return next;
}

export interface PriceInsight {
  /** Lowest price seen before today, when lower than today's. */
  lowest?: PricePoint;
  /** % change vs. the last day we saw it (positive = more expensive). */
  changePct?: number;
  /** The store shows a "before" price higher than anything we ever saw it charge: the discount is likely fake. */
  inflatedListPrice?: boolean;
}

export function priceInsight(history: PriceHistory, offer: ProductOffer, today: string): PriceInsight {
  const past = (history[offerKey(offer)]?.points ?? []).filter((p) => p.date < today);
  if (past.length === 0) return {};

  const insight: PriceInsight = {};
  const lowest = past.reduce((a, b) => (b.price < a.price ? b : a));
  if (lowest.price < offer.price - 0.5) insight.lowest = lowest;

  const last = past[past.length - 1];
  const change = ((offer.price - last.price) / last.price) * 100;
  if (Math.abs(change) >= 1) insight.changePct = Math.round(change);

  const highestSeen = Math.max(...past.map((p) => p.price));
  if (offer.listPrice && offer.listPrice > highestSeen * 1.1) insight.inflatedListPrice = true;

  return insight;
}
