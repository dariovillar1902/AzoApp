import { afterEach, describe, expect, it, vi } from "vitest";
import { planForUser } from "./service";

/** Minimal VTEX catalog response. */
function vtex(products: [name: string, price: number][]) {
  return products.map(([name, price], i) => ({
    productId: String(i),
    productName: name,
    brand: null,
    link: `https://example.com/${i}`,
    items: [
      {
        itemId: "1",
        measurementUnit: "un",
        unitMultiplier: 1,
        images: [],
        sellers: [{ sellerId: "1", addToCartLink: "", commertialOffer: { Price: price, ListPrice: price, AvailableQuantity: 10, IsAvailable: true } }],
      },
    ],
  }));
}

const CATALOGS: Record<string, Record<string, [string, number][]>> = {
  "diaonline.supermercadosdia.com.ar": {
    leche: [["Leche Entera La Serenísima 1 L", 1500]],
    yerba: [["Yerba Mate Playadito 1 Kg", 5000]],
  },
  "www.carrefour.com.ar": {
    leche: [["Leche Entera La Serenísima 1 L", 1400]],
    yerba: [["Yerba Mate Playadito 1 Kg", 5200]],
  },
  "www.farmacity.com": {
    ibuprofeno: [["Ibuprofeno 400 mg x 20 comprimidos", 3000]],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("planForUser", () => {
  it("searches the stores, matches products and builds a plan with the user's promos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        const query = url.searchParams.get("ft") ?? "";
        const catalog = CATALOGS[url.host];
        if (!catalog) return new Response("blocked", { status: 503 });
        const hits = Object.entries(catalog).find(([key]) => query.includes(key))?.[1] ?? [];
        return Response.json(vtex(hits));
      }),
    );

    const result = await planForUser({
      items: [
        { query: "leche entera 1l", quantity: 10 },
        { query: "yerba 1kg", quantity: 6 },
        { query: "ibuprofeno 400", quantity: 1 },
      ],
      profile: { sources: ["nacion", "modo"] },
      stores: ["dia", "carrefour", "farmacity", "coto"],
      // Thursday 22/10/2026 10:00 in Buenos Aires.
      now: new Date("2026-10-22T13:00:00Z"),
    });

    expect(result.storesFailed).toEqual(["coto"]);
    expect(result.notFound).toEqual([]);

    // 10 × 1.500 + 6 × 5.000 = 45.000 at Día clears BNA+MODO's $35.000 minimum on Friday (20%, cap $20.000).
    const dia = result.stops.find((s) => s.store === "dia")!;
    expect(dia.lines.map((l) => l.item.query)).toEqual(["leche entera 1l", "yerba 1kg"]);
    expect(dia.day).toEqual({ date: "2026-10-23", dow: 5 });
    expect(dia.total).toBe(36000);

    expect(result.stops.find((s) => s.store === "farmacity")?.lines[0].offer.name).toContain("Ibuprofeno");
  });

  it("skips offers the user rejected and uses a per-store query when given", async () => {
    const searched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const query = new URL(input).searchParams.get("ft") ?? "";
        searched.push(query);
        return Response.json(
          vtex([
            ["Leche Entera La Serenísima 1 L", 1500],
            ["Leche Entera Sancor 1 L", 1300],
          ]),
        );
      }),
    );

    const result = await planForUser({
      items: [{ query: "leche entera 1l sin marca", quantity: 1, excludedOfferIds: ["dia:1-1"], queryBySite: { dia: "leche serenisima" } }],
      profile: { sources: [] },
      stores: ["dia"],
      now: new Date("2026-10-22T13:00:00Z"),
    });

    expect(searched).toEqual(["leche serenisima"]);
    expect(result.stops[0].lines[0].offer.name).toBe("Leche Entera La Serenísima 1 L");
    expect(result.items[0].item.query).toBe("leche entera 1l sin marca");
  });
});
