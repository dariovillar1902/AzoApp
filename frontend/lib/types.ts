/** Chains whose online catalog we can search for live prices. */
export type StoreId =
  | "carrefour"
  | "coto"
  | "dia"
  | "jumbo"
  | "disco"
  | "vea"
  | "changomas"
  | "farmacity"
  | "farmaplus"
  | "farmaonline"
  | "farmatodo";

/** Kept as an alias so the matching code ported from comparador-precios-ar reads unchanged. */
export type SiteId = StoreId;

export type StoreKind = "super" | "farmacia";

export interface ProductOffer {
  site: StoreId;
  id: string;
  name: string;
  brand: string | null;
  sizeText: string | null;
  sizeValue: number | null;
  sizeUnit: "ml" | "g" | "un" | null;
  price: number;
  listPrice: number | null;
  inStock: boolean;
  url: string;
  addToCartUrl: string | null;
  imageUrl: string | null;
  /** "Llevando N" style promos: promoUnitPrice only applies from promoMinQty units onward. */
  promoMinQty?: number;
  promoUnitPrice?: number;
  promoLabel?: string;
}

export interface ShoppingListItem {
  query: string;
  quantity: number;
  /** Opaque client-side identifier, echoed back untouched in the results. */
  id?: string;
  /** Offer keys (see `offerKey`) the user flagged as "not what I asked for"; never picked for this item. */
  excludedOfferIds?: string[];
  /** Per-store replacement for `query`, e.g. the exact name of a product the user picked there. */
  queryBySite?: Partial<Record<StoreId, string>>;
}

export interface MatchedItem {
  requested: ShoppingListItem;
  offer: ProductOffer | null;
  score: number;
  isSubstitute: boolean;
  substituteReason?: string;
}
