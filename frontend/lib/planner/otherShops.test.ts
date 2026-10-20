import { describe, expect, it } from "vitest";
import { CATALOG } from "../benefits/catalog";
import { DEFAULT_SOURCE_IDS } from "../benefits/sources";
import { upcomingDays } from "../benefits/eligibility";
import { fuelAmount, otherShopsFor, rubroFor } from "./otherShops";
import type { ItemPlan } from "./plan";

const days = upcomingDays(new Date("2026-10-20T15:00:00Z")); // martes
const ctx = { profile: { sources: DEFAULT_SOURCE_IDS }, days };

describe("rubroFor", () => {
  it("knows where an item is usually bought", () => {
    expect(rubroFor("filet de merluza")?.id).toBe("pescaderia");
    expect(rubroFor("1kg vacío")?.id).toBe("carniceria");
    expect(rubroFor("tomate perita")?.id).toBe("verduleria");
    expect(rubroFor("yerba 1kg")).toBeNull();
  });
});

describe("fuel", () => {
  it("reads the load amount", () => {
    expect(fuelAmount("nafta $40.000")).toBe(40000);
    expect(fuelAmount("nafta 25000")).toBe(25000);
    expect(fuelAmount("nafta")).toBe(40000);
  });

  it("lists the user's fuel promos first, best saving first, with a day for each", () => {
    const shops = otherShopsFor("nafta $50000", null, CATALOG, ctx, true);
    const owned = shops.filter((s) => s.owned);
    expect(owned.length).toBeGreaterThan(3);
    expect(owned[0].promotion.id).toBe("bna-combustible-viernes"); // 20% de 50.000 = 10.000, justo el tope
    expect(owned.map((s) => s.saving)).toEqual([...owned.map((s) => s.saving)].sort((a, b) => b - a));
    expect(shops.findIndex((s) => !s.owned)).toBeGreaterThanOrEqual(owned.length);
    expect(shops.find((s) => s.promotion.id === "santander-ypf-jueves")?.day.dow).toBe(4);
  });
});

describe("neighborhood shops", () => {
  const plan = {
    item: { query: "filet de merluza", quantity: 1 },
    best: { cost: 9000, listCost: 10000 },
    bestToday: null,
    options: [{ store: "carrefour", listCost: 10000 }],
  } as unknown as ItemPlan;

  it("offers a fishmonger promo, estimated from the chains' shelf price, marked as not owned", () => {
    const shops = otherShopsFor("filet de merluza", plan, CATALOG, ctx, false);
    expect(shops.length).toBeGreaterThan(0);
    expect(shops.every((s) => s.kind === "rubro" && !s.owned)).toBe(true);
    const best = shops[0];
    expect(best.baseAmount).toBe(10000);
    expect(best.estimatedCost).toBeLessThan(9000);
    expect(best.cheaper).toBe(true);
  });

  it("is marked owned once the user has the source", () => {
    const shops = otherShopsFor("filet de merluza", plan, CATALOG, { ...ctx, profile: { sources: [...DEFAULT_SOURCE_IDS, "cuentadni"] } }, false);
    expect(shops[0].owned).toBe(true);
  });
});
