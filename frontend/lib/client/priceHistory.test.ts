import { describe, expect, it } from "vitest";
import type { PlanResponse } from "../planner/service";
import type { ProductOffer } from "../types";
import { priceInsight, recordPlan, type PriceHistory } from "./priceHistory";

function offer(price: number, listPrice: number | null = null): ProductOffer {
  return {
    site: "dia",
    id: "leche",
    name: "Leche 1 L",
    brand: null,
    sizeText: null,
    sizeValue: null,
    sizeUnit: null,
    price,
    listPrice,
    inStock: true,
    url: "",
    addToCartUrl: null,
    imageUrl: null,
  };
}

const planWith = (o: ProductOffer) => ({ items: [{ options: [{ offer: o }] }] }) as unknown as PlanResponse;

describe("price history", () => {
  it("keeps one point per day per product", () => {
    let history: PriceHistory = {};
    history = recordPlan(history, planWith(offer(1000)), "2026-10-01");
    history = recordPlan(history, planWith(offer(1100)), "2026-10-01");
    history = recordPlan(history, planWith(offer(1200)), "2026-10-05");
    expect(history["dia:leche"].points.map((p) => p.price)).toEqual([1100, 1200]);
  });

  it("reports the lowest price seen, the change and fake 'before' prices", () => {
    let history: PriceHistory = {};
    history = recordPlan(history, planWith(offer(1000)), "2026-10-01");
    history = recordPlan(history, planWith(offer(1200)), "2026-10-10");

    const insight = priceInsight(history, offer(1300, 2000), "2026-10-19");
    expect(insight.lowest?.date).toBe("2026-10-01");
    expect(insight.changePct).toBe(8);
    expect(insight.inflatedListPrice).toBe(true);

    expect(priceInsight(history, offer(1000, 1250), "2026-10-19").inflatedListPrice).toBeUndefined();
    expect(priceInsight({}, offer(1000), "2026-10-19")).toEqual({});
  });
});
