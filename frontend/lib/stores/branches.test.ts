import { describe, expect, it } from "vitest";
import { directionsUrl, nearestBranches } from "./branches";

// Around Plaza Italia, Palermo.
const HERE = { lat: -34.5809, lon: -58.4209 };

describe("nearestBranches", () => {
  it("keeps the closest branch per chain and recognizes brand spellings", () => {
    const result = nearestBranches(
      [
        { lat: -34.585, lon: -58.42, tags: { shop: "supermarket", name: "Coto", "addr:street": "Avenida Santa Fe", "addr:housenumber": "3400" } },
        { lat: -34.6, lon: -58.43, tags: { shop: "supermarket", name: "Coto" } },
        { center: { lat: -34.582, lon: -58.422 }, tags: { shop: "supermarket", brand: "Día", name: "Supermercado Día" } },
        { lat: -34.581, lon: -58.421, tags: { amenity: "pharmacy", brand: "Farmacity" } },
        { lat: -34.581, lon: -58.421, tags: { shop: "supermarket", name: "Disco Gourmet" } },
        { lat: -34.581, lon: -58.421, tags: { shop: "supermarket", name: "Super Día y Noche" } },
        { lat: -34.581, lon: -58.421, tags: { shop: "convenience", name: "Kiosco" } },
      ],
      HERE.lat,
      HERE.lon,
    );

    expect(Object.keys(result).sort()).toEqual(["coto", "dia", "disco", "farmacity"]);
    expect(result.coto?.address).toBe("Avenida Santa Fe 3400");
    expect(result.coto?.distanceM).toBeGreaterThan(400);
    expect(result.coto?.distanceM).toBeLessThan(600);
    expect(result.dia?.lat).toBe(-34.582);
  });

  it("links to the platform's maps app", () => {
    expect(directionsUrl({ lat: 1, lon: 2 }, "ios")).toBe("https://maps.apple.com/?daddr=1,2");
    expect(directionsUrl({ lat: 1, lon: 2 }, "android")).toContain("google.com/maps");
  });
});
