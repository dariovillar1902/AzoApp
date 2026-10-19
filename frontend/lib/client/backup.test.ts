import { describe, expect, it } from "vitest";
import { decodeBackup, encodeBackup } from "./backup";

describe("backup", () => {
  it("round-trips stored values, accents included", () => {
    const values = { "azoapp.settings.v1": '{"sources":["nacion"]}', "azoapp.list.v1": "2 leche\nyerba mañanera", "azoapp.prices.v1": null };
    expect(decodeBackup(encodeBackup(values))).toEqual({
      "azoapp.settings.v1": '{"sources":["nacion"]}',
      "azoapp.list.v1": "2 leche\nyerba mañanera",
    });
  });

  it("rejects other text", () => {
    expect(() => decodeBackup("hola")).toThrow("No es un respaldo");
  });
});
