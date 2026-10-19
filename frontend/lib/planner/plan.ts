import { bestPromotion, capPeriodKey, type AppliedPromotion, type CapUsage, type PlanDay } from "../benefits/eligibility";
import type { Promotion } from "../benefits/types";
import type { MatchedItem, ProductOffer, ShoppingListItem, StoreId } from "../types";

export interface PlannerInput {
  items: ShoppingListItem[];
  /** For each store, one MatchedItem per entry of `items`, in the same order. */
  matches: Partial<Record<StoreId, MatchedItem[]>>;
  /** Promotions the user can actually use (already filtered by eligibility). */
  promotions: Promotion[];
  /** Days we may schedule a purchase on, today first. */
  days: PlanDay[];
  /** ARS an extra store visit is "worth" to the user; 0 = only price matters. */
  storePenalty?: number;
  /** What the user already used of each monthly/weekly cap (see capPeriodKey). */
  capUsage?: CapUsage;
}

export interface ItemOption {
  store: StoreId;
  offer: ProductOffer;
  isSubstitute: boolean;
  day: PlanDay;
  listCost: number;
  promotion: AppliedPromotion | null;
  cost: number;
}

export interface ItemPlan {
  item: ShoppingListItem;
  /** Cheapest store+day buying only this item. */
  best: ItemOption | null;
  /** Cheapest store if bought today. */
  bestToday: ItemOption | null;
  /** Best option per store, cheapest first. */
  options: ItemOption[];
}

export interface StopLine {
  itemIndex: number;
  item: ShoppingListItem;
  offer: ProductOffer;
  isSubstitute: boolean;
  substituteReason?: string;
  listCost: number;
}

export interface DayQuote {
  day: PlanDay;
  promotion: AppliedPromotion | null;
  total: number;
}

export interface StoreStop {
  store: StoreId;
  day: PlanDay;
  lines: StopLine[];
  subtotal: number;
  promotion: AppliedPromotion | null;
  total: number;
  /** Same basket priced on every planning day, to show "if you can't go that day". */
  byDay: DayQuote[];
}

export interface OneStopOption {
  store: StoreId;
  /** total plus, for each missing item, its cheapest price elsewhere: what ranks the options. */
  estimatedTotal: number;
  day: PlanDay;
  found: number;
  missing: number;
  subtotal: number;
  promotion: AppliedPromotion | null;
  total: number;
}

export interface PlanResult {
  days: PlanDay[];
  items: ItemPlan[];
  stops: StoreStop[];
  /** Indexes of items no store carried. */
  notFound: number[];
  total: number;
  /** What the same items would cost at list price in the stores chosen (savings = this - total). */
  listTotal: number;
  oneStop: OneStopOption[];
}

function lineCost(offer: ProductOffer, quantity: number): number {
  const unit =
    offer.promoMinQty !== undefined && offer.promoUnitPrice !== undefined && quantity >= offer.promoMinQty
      ? offer.promoUnitPrice
      : offer.price;
  return unit * quantity;
}

function quoteBasket(
  store: StoreId,
  subtotal: number,
  days: PlanDay[],
  promotions: Promotion[],
  used: CapUsage = {},
): DayQuote[] {
  return days.map((day) => {
    const promotion = bestPromotion(store, subtotal, day, promotions, used);
    return { day, promotion, total: subtotal - (promotion?.discount ?? 0) };
  });
}

/** Lowest total; ties go to the earliest day so we never make the user wait for nothing. */
function cheapestQuote(quotes: DayQuote[]): DayQuote {
  return quotes.reduce((best, q) => (q.total < best.total - 0.005 ? q : best));
}

function offerFor(input: PlannerInput, store: StoreId, index: number): MatchedItem | null {
  const match = input.matches[store]?.[index];
  return match?.offer ? match : null;
}

function planItem(input: PlannerInput, index: number): ItemPlan {
  const item = input.items[index];
  const options: ItemOption[] = [];
  let bestToday: ItemOption | null = null;

  for (const store of Object.keys(input.matches) as StoreId[]) {
    const match = offerFor(input, store, index);
    if (!match) continue;
    const offer = match.offer!;
    const listCost = lineCost(offer, item.quantity);
    const quotes = quoteBasket(store, listCost, input.days, input.promotions, input.capUsage);
    const toOption = (q: DayQuote): ItemOption => ({
      store,
      offer,
      isSubstitute: match.isSubstitute,
      day: q.day,
      listCost,
      promotion: q.promotion,
      cost: q.total,
    });
    options.push(toOption(cheapestQuote(quotes)));
    const today = toOption(quotes[0]);
    if (!bestToday || today.cost < bestToday.cost) bestToday = today;
  }

  options.sort((a, b) => a.cost - b.cost);
  return { item, best: options[0] ?? null, bestToday, options };
}

type Assignment = (StoreId | null)[];

function buildStops(input: PlannerInput, assignment: Assignment): StoreStop[] {
  const byStore = new Map<StoreId, StopLine[]>();
  assignment.forEach((store, itemIndex) => {
    if (!store) return;
    const match = offerFor(input, store, itemIndex)!;
    const item = input.items[itemIndex];
    const lines = byStore.get(store) ?? [];
    lines.push({
      itemIndex,
      item,
      offer: match.offer!,
      isSubstitute: match.isSubstitute,
      substituteReason: match.substituteReason,
      listCost: lineCost(match.offer!, item.quantity),
    });
    byStore.set(store, lines);
  });

  // A monthly/weekly cap is one budget for the whole trip: Farmacity and
  // Farmaplus on the same MODO promo can't both get the full tope. Visits
  // that stand to save the most claim their promo first.
  const baskets = [...byStore.entries()].map(([store, lines]) => {
    const subtotal = lines.reduce((sum, l) => sum + l.listCost, 0);
    const standalone = cheapestQuote(quoteBasket(store, subtotal, input.days, input.promotions, input.capUsage));
    return { store, lines, subtotal, potential: subtotal - standalone.total };
  });
  baskets.sort((a, b) => b.potential - a.potential);

  const used: CapUsage = { ...input.capUsage };
  return baskets.map(({ store, lines, subtotal }) => {
    const byDay = quoteBasket(store, subtotal, input.days, input.promotions, used);
    const chosen = cheapestQuote(byDay);
    if (chosen.promotion) {
      const key = capPeriodKey(chosen.promotion.promotion, chosen.day);
      if (key) used[key] = (used[key] ?? 0) + chosen.promotion.discount;
    }
    return { store, day: chosen.day, lines, subtotal, promotion: chosen.promotion, total: chosen.total, byDay };
  });
}

function score(input: PlannerInput, assignment: Assignment): number {
  const stops = buildStops(input, assignment);
  const penalty = (input.storePenalty ?? 0) * Math.max(0, stops.length - 1);
  return stops.reduce((sum, s) => sum + s.total, 0) + penalty;
}

/**
 * Splits the list into store visits. Starts from each item's individually
 * cheapest store, then hill-climbs: moving one item, or a whole visit, to
 * another store is kept when it lowers the trip's total. This is what lets a
 * basket cross a promo's minimum purchase, or skip a visit that only saved a
 * few pesos (when `storePenalty` is set).
 */
function optimizeAssignment(input: PlannerInput, itemPlans: ItemPlan[]): Assignment {
  const assignment: Assignment = itemPlans.map((p) => p.best?.store ?? null);
  const candidates = itemPlans.map((p) => p.options.map((o) => o.store));
  let current = score(input, assignment);

  for (let pass = 0; pass < 25; pass++) {
    let improved = false;

    for (let i = 0; i < assignment.length; i++) {
      for (const store of candidates[i]) {
        if (store === assignment[i]) continue;
        const previous = assignment[i];
        assignment[i] = store;
        const next = score(input, assignment);
        if (next < current - 0.5) {
          current = next;
          improved = true;
        } else {
          assignment[i] = previous;
        }
      }
    }

    // Whole-visit moves, also to stores not visited yet: that's how a basket
    // reaches a minimum purchase no single item clears on its own.
    const visited = [...new Set(assignment.filter((s): s is StoreId => s !== null))];
    const allStores = Object.keys(input.matches) as StoreId[];
    for (const from of visited) {
      for (const to of allStores) {
        if (from === to) continue;
        const moving = assignment.map((s, i) => (s === from ? i : -1)).filter((i) => i >= 0);
        if (!moving.every((i) => candidates[i].includes(to))) continue;
        const trial = assignment.map((s) => (s === from ? to : s));
        const next = score(input, trial);
        if (next < current - 0.5) {
          trial.forEach((s, i) => (assignment[i] = s));
          current = next;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return assignment;
}

function oneStopOptions(input: PlannerInput, itemPlans: ItemPlan[]): OneStopOption[] {
  return (Object.keys(input.matches) as StoreId[])
    .map((store) => {
      let subtotal = 0;
      let found = 0;
      input.items.forEach((item, i) => {
        const match = offerFor(input, store, i);
        if (!match) return;
        found++;
        subtotal += lineCost(match.offer!, item.quantity);
      });
      const best = cheapestQuote(quoteBasket(store, subtotal, input.days, input.promotions, input.capUsage));
      // A store missing an item isn't cheaper for it: you still have to buy it somewhere.
      const missingCost = input.items.reduce(
        (sum, _, i) => sum + (offerFor(input, store, i) ? 0 : (itemPlans[i].best?.cost ?? 0)),
        0,
      );
      return {
        store,
        estimatedTotal: best.total + missingCost,
        day: best.day,
        found,
        missing: input.items.length - found,
        subtotal,
        promotion: best.promotion,
        total: best.total,
      };
    })
    .filter((o) => o.found > 0)
    .sort((a, b) => a.missing - b.missing || a.estimatedTotal - b.estimatedTotal);
}

/** A match costing this many times the cheapest store's is a different product (e.g. infant formula for "leche"). */
const OUTLIER_RATIO = 3;

function withoutOutliers(input: PlannerInput): PlannerInput {
  const stores = Object.keys(input.matches) as StoreId[];
  const matches: Partial<Record<StoreId, MatchedItem[]>> = {};
  for (const store of stores) matches[store] = [...input.matches[store]!];

  input.items.forEach((item, i) => {
    const costs = stores
      .map((store) => offerFor(input, store, i))
      .filter((m): m is MatchedItem => m !== null)
      .map((m) => lineCost(m.offer!, item.quantity));
    if (costs.length < 2) return;
    const cheapest = Math.min(...costs);
    for (const store of stores) {
      const match = offerFor(input, store, i);
      if (match && lineCost(match.offer!, item.quantity) > cheapest * OUTLIER_RATIO) {
        matches[store]![i] = { ...match, offer: null, score: 0 };
      }
    }
  });
  return { ...input, matches };
}

export function planShopping(rawInput: PlannerInput): PlanResult {
  const input = withoutOutliers(rawInput);
  const items = input.items.map((_, i) => planItem(input, i));
  const assignment = optimizeAssignment(input, items);
  const stops = buildStops(input, assignment).sort(
    (a, b) => a.day.date.localeCompare(b.day.date) || b.total - a.total,
  );

  return {
    days: input.days,
    items,
    stops,
    notFound: assignment.map((s, i) => (s === null ? i : -1)).filter((i) => i >= 0),
    total: stops.reduce((sum, s) => sum + s.total, 0),
    listTotal: stops.reduce((sum, s) => sum + s.subtotal, 0),
    oneStop: oneStopOptions(input, items),
  };
}
