import { describe, expect, it } from "vitest";
import type { ProductOffer } from "../types";
import { excludeOffers, offerKey } from "./exclusions";

function makeOffer(overrides: Partial<ProductOffer>): ProductOffer {
  return {
    site: "coto",
    id: "1",
    name: "Producto",
    brand: null,
    sizeText: null,
    sizeValue: null,
    sizeUnit: null,
    price: 100,
    listPrice: null,
    inStock: true,
    url: "https://example.com",
    addToCartUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("offerKey", () => {
  it("prefixes the id with the site so equal ids on different sites don't collide", () => {
    expect(offerKey(makeOffer({ site: "coto", id: "42" }))).toBe("coto:42");
    expect(offerKey(makeOffer({ site: "dia", id: "42" }))).not.toBe(
      offerKey(makeOffer({ site: "coto", id: "42" })),
    );
  });
});

describe("excludeOffers", () => {
  const a = makeOffer({ id: "a" });
  const b = makeOffer({ id: "b" });

  it("returns every candidate when nothing is excluded", () => {
    expect(excludeOffers([a, b], undefined)).toEqual([a, b]);
    expect(excludeOffers([a, b], [])).toEqual([a, b]);
  });

  it("drops only the candidates whose key is excluded", () => {
    expect(excludeOffers([a, b], ["coto:a"])).toEqual([b]);
  });

  it("ignores excluded keys that belong to another site", () => {
    expect(excludeOffers([a, b], ["dia:a"])).toEqual([a, b]);
  });

  it("does not mutate the input array", () => {
    const input = [a, b];
    excludeOffers(input, ["coto:a"]);
    expect(input).toEqual([a, b]);
  });
});
