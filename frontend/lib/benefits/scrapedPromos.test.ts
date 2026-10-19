import { describe, expect, it } from "vitest";
import { promotionsFromScraped, type ScrapedDiscount } from "./scrapedPromos";

const base: ScrapedDiscount = {
  id: 7,
  title: "Coto",
  description: "20% de reintegro los viernes con BNA+ MODO. Tope de reintegro $15.000 por mes",
  bankName: "Banco Nación",
  amount: 20,
  currency: "%",
  validDays: ["Viernes"],
  url: "https://semananacion.com.ar/coto",
  expirationDate: null,
  scrapedAt: "2026-10-19T10:00:00Z",
  stores: ["Coto"],
};

describe("promotionsFromScraped", () => {
  it("maps a bank's scraped discount to a planner promotion", () => {
    expect(promotionsFromScraped([base])).toEqual([
      expect.objectContaining({
        id: "banco-7",
        requires: ["nacion"],
        merchants: ["coto"],
        category: "supermercado",
        daysOfWeek: [5],
        discountPct: 20,
        cap: { amount: 15000, per: "mes" },
        origin: "banco-live",
        confidence: "verificar",
      }),
    ]);
  });

  it("drops what the planner can't use safely", () => {
    expect(promotionsFromScraped([{ ...base, validDays: [] }])).toEqual([]); // no day stated
    expect(promotionsFromScraped([{ ...base, stores: ["Adidas"] }])).toEqual([]); // not a chain we price
    expect(promotionsFromScraped([{ ...base, bankName: "Swiss Medical" }])).toEqual([]);
    expect(promotionsFromScraped([{ ...base, amount: null }])).toEqual([]); // 2x1, cuotas
  });

  it("accepts an explicit 'todos los días' and weekly caps", () => {
    const [promo] = promotionsFromScraped([
      { ...base, validDays: [], stores: ["Día", "Changomas"], description: "15% todos los días, tope $5.000 por semana" },
    ]);
    expect(promo.daysOfWeek).toBeUndefined();
    expect(promo.merchants).toEqual(["dia", "changomas"]);
    expect(promo.cap).toEqual({ amount: 5000, per: "semana" });
  });
});
