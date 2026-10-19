import { describe, expect, it } from "vitest";
import { capPeriodKey, type PlanDay } from "../benefits/eligibility";
import type { Promotion } from "../benefits/types";
import type { MatchedItem, ProductOffer, ShoppingListItem, StoreId } from "../types";
import { planShopping } from "./plan";

// Monday 19/10/2026 through Sunday 25/10/2026.
const DAYS: PlanDay[] = [
  { date: "2026-10-19", dow: 1 },
  { date: "2026-10-20", dow: 2 },
  { date: "2026-10-21", dow: 3 },
  { date: "2026-10-22", dow: 4 },
  { date: "2026-10-23", dow: 5 },
  { date: "2026-10-24", dow: 6 },
  { date: "2026-10-25", dow: 0 },
];

function offer(site: StoreId, name: string, price: number): ProductOffer {
  return {
    site,
    id: `${site}-${name}`,
    name,
    brand: null,
    sizeText: null,
    sizeValue: null,
    sizeUnit: null,
    price,
    listPrice: null,
    inStock: true,
    url: "https://example.com",
    addToCartUrl: null,
    imageUrl: null,
  };
}

function promo(overrides: Partial<Promotion> & Pick<Promotion, "id" | "merchants" | "discountPct">): Promotion {
  return { requires: [], category: "supermercado", confidence: "confirmada", checkedAt: "2026-10-19", ...overrides };
}

/** prices[store][i] = price of item i at that store, or null when the store doesn't carry it. */
function matchesFrom(items: ShoppingListItem[], prices: Partial<Record<StoreId, (number | null)[]>>) {
  const matches: Partial<Record<StoreId, MatchedItem[]>> = {};
  for (const [store, row] of Object.entries(prices) as [StoreId, (number | null)[]][]) {
    matches[store] = items.map((item, i) => ({
      requested: item,
      offer: row[i] === null ? null : offer(store, item.query, row[i]!),
      score: 1,
      isSubstitute: false,
    }));
  }
  return matches;
}

const items = (...queries: string[]): ShoppingListItem[] => queries.map((query) => ({ query, quantity: 1 }));

describe("planShopping", () => {
  it("picks the store and weekday where a promo makes an item cheapest", () => {
    const list = items("leche");
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { coto: [1000], dia: [950] }),
      promotions: [promo({ id: "coto-mar", merchants: ["coto"], daysOfWeek: [2], discountPct: 25 })],
      days: DAYS,
    });

    expect(result.items[0].best?.store).toBe("coto");
    expect(result.items[0].best?.day.dow).toBe(2);
    expect(result.items[0].best?.cost).toBe(750);
    expect(result.items[0].bestToday?.store).toBe("dia");
  });

  it("prefers today when waiting doesn't save anything", () => {
    const list = items("arroz");
    const result = planShopping({ items: list, matches: matchesFrom(list, { dia: [500] }), promotions: [], days: DAYS });

    expect(result.stops[0].day.date).toBe("2026-10-19");
  });

  it("groups the list by store", () => {
    const list = items("leche", "ibuprofeno", "yerba");
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, {
        dia: [900, null, 3000],
        farmacity: [null, 2000, null],
        coto: [1000, null, 3500],
      }),
      promotions: [],
      days: DAYS,
    });

    expect(result.stops.map((s) => s.store).sort()).toEqual(["dia", "farmacity"]);
    expect(result.stops.find((s) => s.store === "dia")!.lines.map((l) => l.item.query)).toEqual(["leche", "yerba"]);
    expect(result.total).toBe(5900);
  });

  it("applies caps and minimum purchases to the whole basket, not item by item", () => {
    const list = items("a", "b");
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { dia: [20000, 20000], coto: [19000, 19000] }),
      promotions: [
        promo({ id: "dia-min", merchants: ["dia"], discountPct: 20, minPurchase: 35000, cap: { amount: 5000, per: "mes" } }),
      ],
      days: DAYS,
    });

    // Alone each item misses the $35.000 minimum (Coto wins per item), but together at Día:
    // 40.000 - min(8.000, 5.000) = 35.000 < Coto's 38.000.
    expect(result.items[0].best?.store).toBe("coto");
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0].store).toBe("dia");
    expect(result.stops[0].total).toBe(35000);
  });

  it("consolidates visits when the user values fewer stops", () => {
    const list = items("a", "b");
    const prices = { dia: [1000, 1100], coto: [1050, 1000] };

    const split = planShopping({ items: list, matches: matchesFrom(list, prices), promotions: [], days: DAYS });
    expect(split.stops).toHaveLength(2);

    const consolidated = planShopping({
      items: list,
      matches: matchesFrom(list, prices),
      promotions: [],
      days: DAYS,
      storePenalty: 500,
    });
    expect(consolidated.stops).toHaveLength(1);
  });

  it("respects promo validity dates", () => {
    const list = items("a");
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { dia: [1000] }),
      promotions: [promo({ id: "old", merchants: ["dia"], discountPct: 50, validUntil: "2026-10-18" })],
      days: DAYS,
    });

    expect(result.total).toBe(1000);
  });

  it("reports items no store carries and ranks one-stop options by coverage", () => {
    const list = items("a", "b");
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { dia: [100, null], coto: [300, 300] }),
      promotions: [],
      days: DAYS,
    });

    expect(result.notFound).toEqual([]);
    expect(result.oneStop[0].store).toBe("coto");
    expect(result.oneStop[1]).toMatchObject({ store: "dia", missing: 1 });

    const none = planShopping({ items: items("x"), matches: matchesFrom(items("x"), { dia: [null] }), promotions: [], days: DAYS });
    expect(none.notFound).toEqual([0]);
    expect(none.stops).toHaveLength(0);
  });

  it("shares a monthly cap between visits that use the same promo", () => {
    const list = items("a", "b");
    const shared = promo({ id: "modo", merchants: ["farmacity", "farmaplus"], discountPct: 50, cap: { amount: 1000, per: "mes" } });
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { farmacity: [4000, null], farmaplus: [null, 4000] }),
      promotions: [shared],
      days: DAYS,
    });

    // Two visits, one $1.000 budget: not $1.000 off each.
    expect(result.stops).toHaveLength(2);
    expect(result.listTotal - result.total).toBe(1000);
  });

  it("counts what the user already used of a cap", () => {
    const list = items("a");
    const capped = promo({ id: "mp", merchants: ["dia"], discountPct: 20, cap: { amount: 5000, per: "mes" } });
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { dia: [50000] }),
      promotions: [capped],
      days: DAYS,
      capUsage: { "mp@2026-10": 4000 },
    });

    expect(result.total).toBe(49000);
  });

  it("keys weekly caps by the week's Monday", () => {
    const weekly = promo({ id: "w", merchants: ["dia"], discountPct: 10, cap: { amount: 1, per: "semana" } });
    expect(capPeriodKey(weekly, { date: "2026-10-25", dow: 0 })).toBe("w@2026-10-19");
    expect(capPeriodKey(weekly, { date: "2026-10-19", dow: 1 })).toBe("w@2026-10-19");
    expect(capPeriodKey(promo({ id: "c", merchants: [], discountPct: 1, cap: { amount: 1, per: "compra" } }), DAYS[0])).toBeNull();
  });

  it("drops matches priced like a different product", () => {
    // Real case: Farmatodo matched "leche entera" to a $396.230 infant formula.
    const list = items("leche entera");
    const result = planShopping({
      items: list,
      matches: matchesFrom(list, { coto: [1939], dia: [1990], farmatodo: [396230] }),
      promotions: [],
      days: DAYS,
    });

    expect(result.items[0].options.map((o) => o.store)).toEqual(["coto", "dia"]);
    expect(result.oneStop.map((o) => o.store)).toEqual(["coto", "dia"]);
  });
});
