import { describe, expect, it } from "vitest";
import { parseShoppingList } from "./parseList";
import { categoryHintFor } from "./service";

describe("parseShoppingList", () => {
  it("splits by line and comma and reads quantities", () => {
    expect(parseShoppingList("2 leche entera 1l\nyerba x2, - 3x fideos\n\nx4 yogur")).toEqual([
      { query: "leche entera 1l", quantity: 2 },
      { query: "yerba", quantity: 2 },
      { query: "fideos", quantity: 3 },
      { query: "yogur", quantity: 4 },
    ]);
  });

  it("doesn't mistake a size for a quantity", () => {
    expect(parseShoppingList("1l lavandina\n500g arroz")).toEqual([
      { query: "1l lavandina", quantity: 1 },
      { query: "500g arroz", quantity: 1 },
    ]);
  });
});

describe("categoryHintFor", () => {
  it("flags fuel", () => {
    expect(categoryHintFor("Nafta súper")).toBe("combustible");
    expect(categoryHintFor("papel higiénico")).toBeNull();
  });
});
