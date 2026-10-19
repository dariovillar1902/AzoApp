import { describe, expect, it } from "vitest";
import type { ProductOffer, ShoppingListItem } from "../types";
import { pickBestOffer } from "./matching";
import { extractSize, tokenize } from "./normalize";

function offer(name: string, overrides: Partial<ProductOffer> = {}): ProductOffer {
  const size = extractSize(name);
  return {
    site: "coto",
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

const request = (query: string): ShoppingListItem => ({ query, quantity: 1 });

describe("tokenize", () => {
  it("drops punctuation-only tokens such as the trailing dots in some Coto names", () => {
    expect(tokenize("Tierra Fertilizada X 5l . . .")).toEqual(["tierra", "fertilizada", "x", "5l"]);
  });
});

describe("pickBestOffer size sanity", () => {
  it("rejects candidates whose size is an order of magnitude off the requested one", () => {
    // "tierra 5kg" must not match a 300g deodorant or a 25kg waterproofing product.
    const result = pickBestOffer(request("tierra 5kg"), [
      offer("Desodorante en Polvo Tierra Aire Pur Magnolia 300g"),
      offer("Casaseca Frentes Impermeabilizante 25 Kg Color Tierra"),
    ]);

    expect(result.offer).toBeNull();
  });

  it("still picks a candidate whose size matches", () => {
    const result = pickBestOffer(request("tierra 5kg"), [
      offer("Desodorante en Polvo Tierra Aire Pur Magnolia 300g"),
      offer("Tierra negra para plantas bolsa 5 kg"),
    ]);

    expect(result.offer?.name).toBe("Tierra negra para plantas bolsa 5 kg");
  });

  it("keeps accepting reasonably close sizes", () => {
    const result = pickBestOffer(request("leche entera 1l"), [
      offer("Leche entera larga vida 900 ml"),
    ]);

    expect(result.offer?.name).toBe("Leche entera larga vida 900 ml");
  });

  it("does not penalize anything when the request has no size", () => {
    const result = pickBestOffer(request("suavizante para ropa"), [
      offer("Suavizante para ropa Comfort 450 ml"),
    ]);

    expect(result.offer?.name).toBe("Suavizante para ropa Comfort 450 ml");
  });
});
