import { describe, expect, it } from "vitest";
import type { PlanResponse } from "../planner/service";
import { planToText } from "./shareText";

describe("planToText", () => {
  it("lists each visit with its day, promo and products", () => {
    const days = [{ date: "2026-10-19", dow: 1 }, { date: "2026-10-20", dow: 2 }, { date: "2026-10-23", dow: 5 }];
    const plan = {
      days,
      stops: [
        {
          store: "dia",
          day: days[2],
          subtotal: 45000,
          total: 36000,
          byDay: [],
          promotion: {
            discount: 9000,
            promotion: { id: "x", requires: ["nacion", "modo"], category: "supermercado", merchants: ["dia"], discountPct: 20, payment: "BNA+ MODO", confidence: "confirmada", checkedAt: "" },
          },
          lines: [{ itemIndex: 0, item: { query: "leche", quantity: 10 }, offer: { name: "Leche 1 L" }, isSubstitute: false, listCost: 15000 }],
        },
      ],
      items: [{ item: { query: "leche", quantity: 10 } }, { item: { query: "nafta", quantity: 1 } }],
      notFound: [1],
      total: 36000,
      listTotal: 45000,
    } as unknown as PlanResponse;

    expect(planToText(plan)).toBe(
      [
        "🛒 Día — viernes 23/10 — $36.000",
        "   20% · Banco Nación + MODO (BNA+ MODO): −$9.000",
        "   • 10× Leche 1 L $15.000",
        "",
        "Sin encontrar: nafta",
        "Total: $36.000 (ahorro $9.000)",
      ].join("\n"),
    );
  });
});
