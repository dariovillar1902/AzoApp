import { capLeft, discountFor, isActiveOn, isEligible, type CapUsage, type PlanDay, type UserProfile } from "../benefits/eligibility";
import type { Promotion } from "../benefits/types";
import { normalizeText } from "../core/normalize";
import { STORES } from "../stores/registry";
import type { StoreId } from "../types";
import type { ItemPlan } from "./plan";

export interface Rubro {
  id: string;
  label: string;
}

const RUBROS: (Rubro & { pattern: RegExp })[] = [
  { id: "pescaderia", label: "Pescadería", pattern: /\b(merluza|pescado|salmon|filet de|abadejo|lenguado|trucha|langostino|calamar|mariscos?|mejillon|pejerrey|corvina|atun fresco)\b/ },
  { id: "carniceria", label: "Carnicería", pattern: /\b(carne|asado|vacio|bife|milanesas?|picada|nalga|cuadril|matambre|peceto|bondiola|osobuco|entrana|chorizo|morcilla|roast ?beef|tapa de|colita)\b/ },
  { id: "granja", label: "Granja / pollería", pattern: /\b(pollo|pechuga|pata muslo|suprema|alitas|huevos?|maple)\b/ },
  { id: "verduleria", label: "Verdulería", pattern: /\b(tomates?|lechuga|papas?|cebollas?|zanahorias?|zapallo|zapallitos?|morron|acelga|espinaca|bananas?|manzanas?|naranjas?|mandarinas?|limon(es)?|frutillas?|peras?|palta|verduras?|frutas?|batata|choclo|berenjena|pepino)\b/ },
  { id: "panaderia", label: "Panadería", pattern: /\b(pan|facturas|medialunas|bizcochos|prepizza|pan rallado)\b/ },
  { id: "dietetica", label: "Dietética", pattern: /\b(almendras|nueces|frutos secos|mani|pasas|semillas|chia|granola|harina integral|avena)\b/ },
];

/** Neighborhood shop where an item is typically bought, if any ("filet de merluza" → pescadería). */
export function rubroFor(query: string): Rubro | null {
  const text = normalizeText(query);
  const hit = RUBROS.find((r) => r.pattern.test(text));
  return hit ? { id: hit.id, label: hit.label } : null;
}

/** Items you'd also find at a pharmacy, beyond what the pharmacy chains we compare returned. */
const PHARMACY_ITEMS =
  /\b(ibuprofeno|paracetamol|aspirina|actron|tafirol|shampoo|acondicionador|jabon|desodorante|pasta dental|dentifrico|cepillo|panales?|toallitas|protector solar|crema|algodon|curitas|alcohol|preservativos|leche de formula|nutrilon|nan|vitaminas?|toallas femeninas|tampones|repelente)\b/;

export function soldAtPharmacies(query: string, plan?: ItemPlan | null): boolean {
  if (PHARMACY_ITEMS.test(normalizeText(query))) return true;
  return (plan?.options ?? []).some((o) => STORES[o.store as StoreId]?.kind === "farmacia");
}

const DEFAULT_FUEL_AMOUNT = 40000;

/** "nafta $40000", "nafta 40.000" → 40000; anything else → a typical full tank. */
export function fuelAmount(query: string): number {
  const match = query.replace(/\./g, "").match(/\$?\s*(\d{4,7})/);
  const value = match ? parseInt(match[1], 10) : NaN;
  return Number.isFinite(value) && value >= 1000 ? value : DEFAULT_FUEL_AMOUNT;
}

export interface OtherShop {
  kind: "combustible" | "rubro" | "farmacia";
  /** "Pescadería", "YPF, Shell", "Farmalife". */
  label: string;
  promotion: Promotion;
  day: PlanDay;
  /** What the discount is computed on: the fuel load, or the item's cheapest shelf price at the chains. */
  baseAmount: number;
  saving: number;
  /** baseAmount - saving. For shops it's an estimate: we don't know their shelf price. */
  estimatedCost: number;
  /** The user has every source the promo needs. */
  owned: boolean;
  /** Estimated cost is below the best chain option. */
  cheaper: boolean;
}

interface Context {
  profile: UserProfile;
  days: PlanDay[];
  capUsage?: CapUsage;
  merchantNames?: Record<string, string>;
}

function bestDay(promo: Promotion, amount: number, owned: boolean, ctx: Context): { day: PlanDay; saving: number } | null {
  let best: { day: PlanDay; saving: number } | null = null;
  for (const day of ctx.days) {
    if (!isActiveOn(promo, day)) continue;
    const saving = discountFor(promo, amount, owned ? capLeft(promo, day, ctx.capUsage ?? {}) : undefined);
    if (!best || saving > best.saving) best = { day, saving };
  }
  return best;
}

function rank(shops: OtherShop[], maxNotOwned: number): OtherShop[] {
  const owned = shops.filter((s) => s.owned).sort((a, b) => b.saving - a.saving);
  const others = shops.filter((s) => !s.owned).sort((a, b) => b.saving - a.saving).slice(0, maxNotOwned);
  return [...owned, ...others];
}

/**
 * Shops outside the chains we price, with a promo that could make them the
 * better buy: fuel stations for "nafta", neighborhood shops for "filet de
 * merluza", pharmacies we don't compare for pharmacy items. Promos the user
 * can't use yet are included (`owned: false`) so they see what they're missing.
 */
export function otherShopsFor(
  query: string,
  plan: ItemPlan | null,
  promotions: Promotion[],
  ctx: Context,
  isFuel: boolean,
): OtherShop[] {
  const name = (promo: Promotion) => promo.merchants.map((m) => ctx.merchantNames?.[m] ?? m).join(", ");
  const visible = promotions.filter((p) => !p.audience || (ctx.profile.audiences ?? []).includes(p.audience));
  const build = (promo: Promotion, kind: OtherShop["kind"], label: string, amount: number, chainBest: number | null): OtherShop | null => {
    const owned = isEligible(promo, ctx.profile);
    const best = bestDay(promo, amount, owned, ctx);
    if (!best) return null;
    const estimatedCost = amount - best.saving;
    return {
      kind,
      label,
      promotion: promo,
      day: best.day,
      baseAmount: amount,
      saving: best.saving,
      estimatedCost,
      owned,
      cheaper: chainBest !== null && best.saving > 0 && estimatedCost < chainBest - 0.5,
    };
  };

  if (isFuel) {
    const amount = fuelAmount(query);
    const shops = visible
      .filter((p) => p.category === "combustible")
      .map((p) => build(p, "combustible", name(p), amount, null))
      .filter((s): s is OtherShop => s !== null);
    return rank(shops, 4);
  }

  // Reference: the item's cheapest shelf price at the chains (no promo) — what a neighborhood shop is likely to charge.
  const shelf = plan?.options.length ? Math.min(...plan.options.map((o) => o.listCost)) : null;
  const chainBest = plan?.best?.cost ?? null;
  const amount = shelf ?? 0;
  const shops: OtherShop[] = [];

  const rubro = rubroFor(query);
  if (rubro) {
    for (const p of visible.filter((p) => p.category === "comercios" && p.rubros?.includes(rubro.id))) {
      const shop = build(p, "rubro", `${rubro.label} (${name(p)})`, amount, chainBest);
      if (shop) shops.push(shop);
    }
  }

  if (soldAtPharmacies(query, plan)) {
    // Pharmacy chains we already price show up as regular options; here only the ones we can't search.
    for (const p of visible.filter((p) => p.category === "farmacia" && p.merchants.every((m) => !(m in STORES)))) {
      const shop = build(p, "farmacia", name(p), amount, chainBest);
      if (shop) shops.push(shop);
    }
  }

  return rank(shops, 2);
}
