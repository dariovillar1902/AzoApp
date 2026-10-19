import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { detectRequiredSources } from "./cotoLive";
import { discountFor, isEligible, upcomingDays } from "./eligibility";
import { DEFAULT_SOURCE_IDS, SOURCES } from "./sources";

describe("detectRequiredSources", () => {
  it("recognizes the user's banks and wallets", () => {
    expect(detectRequiredSources("BNA+ MODO Banco Nación Visa")?.sort()).toEqual(["modo", "nacion", "visa"]);
  });

  it("doesn't read 'Club La Nación' as Banco Nación", () => {
    expect(detectRequiredSources("Club La Nación")).toEqual(["clublanacion"]);
  });

  it("rejects promos from issuers the user doesn't have, even with a shared card network", () => {
    expect(detectRequiredSources("Banco Credicoop Visa crédito")).toBeNull();
  });

  it("treats a bare card network as generic", () => {
    expect(detectRequiredSources("Mastercard crédito")).toEqual(["mastercard"]);
  });
});

describe("eligibility", () => {
  const profile = { sources: DEFAULT_SOURCE_IDS };

  it("needs every required source", () => {
    const promo = CATALOG.find((p) => p.id === "bna-dia-vie-sab")!;
    expect(isEligible(promo, profile)).toBe(true);
    expect(isEligible(promo, { sources: ["nacion"] })).toBe(false);
  });

  it("hides segment promos unless the user opted in", () => {
    const promo = CATALOG.find((p) => p.audience === "jubilados")!;
    expect(isEligible(promo, profile)).toBe(false);
    expect(isEligible(promo, { ...profile, audiences: ["jubilados"] })).toBe(true);
  });

  it("caps and minimums", () => {
    const promo = CATALOG.find((p) => p.id === "bna-dia-vie-sab")!;
    expect(discountFor(promo, 30000)).toBe(0);
    expect(discountFor(promo, 50000)).toBe(10000);
    expect(discountFor(promo, 200000)).toBe(20000);
  });
});

describe("upcomingDays", () => {
  it("uses Buenos Aires dates", () => {
    // 02:00 UTC on the 20th is still the 19th (Monday) in Buenos Aires.
    const days = upcomingDays(new Date("2026-10-20T02:00:00Z"), 2);
    expect(days).toEqual([
      { date: "2026-10-19", dow: 1 },
      { date: "2026-10-20", dow: 2 },
    ]);
  });
});

describe("catalog", () => {
  it("only references known sources and has unique ids", () => {
    const known = new Set(SOURCES.map((s) => s.id));
    expect(CATALOG.flatMap((p) => p.requires).filter((s) => !known.has(s))).toEqual([]);
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
  });
});
