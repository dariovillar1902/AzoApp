import type { StoreId } from "../types";

export type PromoCategory = "supermercado" | "farmacia" | "combustible";

export type CapPeriod = "compra" | "semana" | "mes";

export interface Promotion {
  id: string;
  /** All of these sources are needed (e.g. ["nacion", "modo"] = BNA card paid through MODO). Empty = any payment method. */
  requires: string[];
  category: PromoCategory;
  /** Chains it applies to. Ids in StoreId get live prices; anything else (e.g. "ypf") is informational. */
  merchants: (StoreId | string)[];
  /** 0 = Sunday ... 6 = Saturday. Undefined = every day. */
  daysOfWeek?: number[];
  discountPct: number;
  cap?: { amount: number; per: CapPeriod };
  minPurchase?: number;
  /** How to pay to get it ("QR de BNA+ MODO con Visa crédito o débito"). */
  payment?: string;
  channel?: "presencial" | "online" | "ambos";
  /** YYYY-MM-DD, inclusive. */
  validFrom?: string;
  validUntil?: string;
  /** Promos restricted to a segment (jubilados, plan sueldo...) are hidden unless the user opts into it. */
  audience?: string;
  /** "confirmada" = seen on the issuer's/chain's own page; "verificar" = from press or older notes. */
  confidence: "confirmada" | "verificar";
  /** When this entry was last checked against its source. */
  checkedAt: string;
  sourceUrl?: string;
  notes?: string;
  origin?: "catalogo" | "coto-live";
}
