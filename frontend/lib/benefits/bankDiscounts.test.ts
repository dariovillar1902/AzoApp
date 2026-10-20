import { describe, expect, it } from "vitest";
import { catalogDiscounts, extractStores, extractValidDays } from "./bankDiscounts";
import { promotionsFromScraped } from "./scrapedPromos";

describe("bank discount text parsing (port of ScraperHelpers)", () => {
  it("reads day ranges and weekends", () => {
    expect(extractValidDays("Lunes a jueves 20% en Carrefour")).toEqual(["Lunes", "Martes", "Miércoles", "Jueves"]);
    expect(extractValidDays("Sábados y domingos")).toEqual(["Sábado", "Domingo"]);
    expect(extractValidDays("todos los días")).toEqual([]);
  });

  it("matches stores as whole words only", () => {
    expect(extractStores("30% en Día y Coto, todos los días")).toEqual(["Coto", "Día"]);
    expect(extractStores("todos los dias")).toEqual([]);
  });
});

describe("catalogDiscounts", () => {
  it("turns catalog promos into Explorar cards the planner can read back", () => {
    const cards = catalogDiscounts();
    const bna = cards.find((c) => c.id === "catalogo-bna-dia-vie-sab")!;
    expect(bna.requires).toEqual(["nacion", "modo"]);
    expect(bna.validDays).toEqual(["Viernes", "Sábado"]);
  });

  it("live bank cards become planner promos when they name a chain and days", () => {
    const promos = promotionsFromScraped([
      {
        id: "santander-x", title: "Carrefour", description: "25% los miércoles con tarjetas Santander. Tope de reintegro $20.000 por mes",
        bankName: "Santander", amount: 25, currency: "%", validDays: ["Miércoles"], url: null, expirationDate: null,
        scrapedAt: "2026-10-20T00:00:00Z", stores: ["Carrefour"],
      },
    ]);
    expect(promos).toHaveLength(1);
    expect(promos[0]).toMatchObject({ requires: ["santander"], merchants: ["carrefour"], daysOfWeek: [3], cap: { amount: 20000, per: "mes" } });
  });
});
