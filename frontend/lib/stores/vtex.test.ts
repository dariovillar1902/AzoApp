import { describe, expect, it } from "vitest";
import { extractSize } from "../core/normalize";
import { plausibleListPrice } from "./vtex";

// Real responses seen on 19/10/2026.
describe("store data quirks", () => {
  it("ignores Cencosud's bogus list prices but keeps real markdowns", () => {
    expect(plausibleListPrice(2600, 214876)).toBeNull(); // Jumbo, Leche Milkaut 1 L
    expect(plausibleListPrice(2239.2, 2799)).toBe(2799); // Carrefour, Ilolay 20% off
    expect(plausibleListPrice(2385, 2385)).toBeNull();
  });

  it("reads pharmacy pack sizes", () => {
    expect(extractSize("Ibuprofeno 400 x 20 Comp")).toMatchObject({ value: 20, unit: "un" });
    expect(extractSize("Ibupirac Ibuprofeno 600 mg Pfizer Caja x 20 Cápsulas")).toMatchObject({ value: 20, unit: "un" });
    expect(extractSize("Té Green Hills x 25 saquitos")).toMatchObject({ value: 25, unit: "un" });
  });
});
