import { describe, expect, it } from "vitest";
import { unitPrice } from "./format";

describe("unitPrice", () => {
  it("normalizes to kg, litre or unit", () => {
    expect(unitPrice({ price: 1500, sizeValue: 500, sizeUnit: "g" })).toBe("$3.000/kg");
    expect(unitPrice({ price: 1500, sizeValue: 900, sizeUnit: "ml" })).toBe("$1.667/l");
    expect(unitPrice({ price: 3000, sizeValue: 20, sizeUnit: "un" })).toBe("$150/u");
    expect(unitPrice({ price: 3000, sizeValue: 1, sizeUnit: "un" })).toBeNull();
    expect(unitPrice({ price: 3000, sizeValue: null, sizeUnit: null })).toBeNull();
  });
});
