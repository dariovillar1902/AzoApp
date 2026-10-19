import type { ShoppingListItem } from "../types";

/**
 * Turns free text into list items: one per line or comma, with an optional
 * quantity in front ("2 leche", "2x leche", "x2 leche") or at the end
 * ("leche x2"). A size like "1l" or "500g" is kept in the query, not taken
 * as a quantity.
 */
export function parseShoppingList(text: string): ShoppingListItem[] {
  return text
    .split(/[\n,;]+/)
    .map((raw) => raw.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      let quantity = 1;
      let query = raw;

      const leading = query.match(/^(?:x\s*)?(\d{1,2})\s*(?:x\s+|x(?=[a-zA-Z])|u\s+|un\s+|\s+)(?=\D)/i);
      if (leading) {
        quantity = parseInt(leading[1], 10);
        query = query.slice(leading[0].length);
      } else {
        const trailing = query.match(/\s+x\s*(\d{1,2})$/i);
        if (trailing) {
          quantity = parseInt(trailing[1], 10);
          query = query.slice(0, trailing.index);
        }
      }

      return { query: query.trim(), quantity: Math.max(1, quantity) };
    })
    .filter((item) => item.query.length > 0);
}
