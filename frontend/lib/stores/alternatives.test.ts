import { describe, expect, it } from "vitest";
import type { ProductOffer } from "../types";
import { rankAlternatives } from "./alternatives";
import { extractSize } from "../core/normalize";

function offer(name: string, overrides: Partial<ProductOffer> = {}): ProductOffer {
  const size = extractSize(name);
  return {
    site: "carrefour",
    id: name,
    name,
    brand: null,
    sizeText: size?.sizeText ?? null,
    sizeValue: size?.value ?? null,
    sizeUnit: size?.unit ?? null,
    price: 1000,
    listPrice: null,
    inStock: true,
    url: "https://example.com",
    addToCartUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("rankAlternatives", () => {
  it("puts the candidates sharing the most query words first", () => {
    const ranked = rankAlternatives("bolsa de tierra para jardineria 5kg", [
      offer("Bolsa de residuos 50x70"),
      offer("Tierra fértil Landiner 5 L"),
      offer("Bolsa de tierra negra 5 kg"),
    ]);

    expect(ranked[0].name).toBe("Bolsa de tierra negra 5 kg");
  });

  it("breaks ties by how close the size is to the requested one", () => {
    const ranked = rankAlternatives("tierra 5kg", [
      offer("Tierra negra 25 kg"),
      offer("Tierra negra 5 kg"),
    ]);

    expect(ranked.map((o) => o.name)).toEqual(["Tierra negra 5 kg", "Tierra negra 25 kg"]);
  });

  it("ranks a wildly different size in the same unit below one whose size can't be compared", () => {
    // 5kg asked: 25kg of wall paint is a worse suggestion than soil sold by the litre.
    const ranked = rankAlternatives("tierra 5kg", [
      offer("Casaseca Frentes Impermeabilizante 25 Kg Color Tierra"),
      offer("Tierra fértil Carrefour sustrato universal 5 l."),
    ]);

    expect(ranked[0].name).toBe("Tierra fértil Carrefour sustrato universal 5 l.");
  });

  it("drops out-of-stock offers and offers sharing no word with the query", () => {
    const ranked = rankAlternatives("tierra", [
      offer("Tierra fértil agotada", { inStock: false }),
      offer("Vino tinto Malbec"),
      offer("Tierra fértil Landiner 5 L"),
    ]);

    expect(ranked.map((o) => o.name)).toEqual(["Tierra fértil Landiner 5 L"]);
  });

  it("returns each product once and respects the limit", () => {
    const dup = offer("Tierra fértil Landiner 5 L");
    const ranked = rankAlternatives(
      "tierra",
      [dup, dup, offer("Tierra A"), offer("Tierra B"), offer("Tierra C")],
      3,
    );

    expect(ranked).toHaveLength(3);
    expect(new Set(ranked.map((o) => o.id)).size).toBe(3);
  });
});
