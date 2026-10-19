import { describe, expect, it } from "vitest";
import { CATALOG } from "../benefits/catalog";
import { applyReceipts, matchReceipt, parseReceipts } from "./receipts";

describe("parseReceipts", () => {
  it("reads amount, date, merchant and sources from refund notices", () => {
    const text = [
      "Mercado Pago\nTe devolvimos $ 2.500,50 por tu compra en Farmacity el 21/10/2026.",
      "MODO · Banco Nación\n¡Recibiste tu reintegro! $20.000 en DIA - 23/10/26",
      "Hola! Tu resumen está listo.",
    ].join("\n\n");

    expect(parseReceipts(text, "2026-10-19")).toEqual([
      { amount: 2500.5, date: "2026-10-21", merchant: "farmacity", sources: ["mercadopago"] },
      { amount: 20000, date: "2026-10-23", merchant: "dia", sources: expect.arrayContaining(["modo", "nacion"]) },
    ]);
  });

  it("defaults to today when there's no date", () => {
    expect(parseReceipts("Reintegro de $1.000 en Coto", "2026-10-19")[0].date).toBe("2026-10-19");
  });
});

describe("matching receipts to promos", () => {
  it("finds the capped promo for that merchant, day and payment method", () => {
    const [mp] = parseReceipts("Mercado Pago: te devolvimos $2.500 en Farmacity el 21/10/2026", "2026-10-19");
    expect(matchReceipt(mp, CATALOG)?.id).toBe("mp-farmacity-miercoles");

    const [bna] = parseReceipts("MODO Banco Nación: reintegro $20.000 en Día 23/10/2026", "2026-10-19");
    expect(matchReceipt(bna, CATALOG)?.id).toBe("bna-dia-vie-sab");
  });

  it("adds the refund to that promo's cap window", () => {
    const receipts = parseReceipts("Mercado Pago: te devolvimos $2.500 en Farmacity el 21/10/2026", "2026-10-19");
    const { usage, applied } = applyReceipts({ "mp-farmacity-miercoles@2026-10": 1000 }, receipts, CATALOG);
    expect(usage).toEqual({ "mp-farmacity-miercoles@2026-10": 3500 });
    expect(applied[0].promotion?.id).toBe("mp-farmacity-miercoles");
  });

  it("leaves unmatched refunds alone", () => {
    const receipts = parseReceipts("Te devolvimos $500 en Jumbo el 20/10/2026", "2026-10-19");
    const { usage, applied } = applyReceipts({}, receipts, CATALOG);
    expect(usage).toEqual({});
    expect(applied[0].promotion).toBeNull();
  });
});
