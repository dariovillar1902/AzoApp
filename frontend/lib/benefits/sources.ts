/**
 * A "source" is anything that unlocks a discount: a bank, a card network, a
 * wallet or a club. Promotions list the sources they require, and the user
 * profile lists the ones the user has.
 */
export interface BenefitSource {
  id: string;
  name: string;
  kind: "banco" | "tarjeta" | "billetera" | "club";
  /** Lower-case, accent-free fragments used to recognize it in free text (e.g. Coto's live promo descriptions). */
  aliases: string[];
}

export const SOURCES: BenefitSource[] = [
  { id: "santander", name: "Banco Santander", kind: "banco", aliases: ["santander"] },
  { id: "ciudad", name: "Banco Ciudad", kind: "banco", aliases: ["banco ciudad", "ciudad", "buepp"] },
  { id: "nacion", name: "Banco Nación", kind: "banco", aliases: ["banco nacion", "nacion", "bna"] },
  { id: "visa", name: "Visa", kind: "tarjeta", aliases: ["visa"] },
  { id: "mastercard", name: "Mastercard", kind: "tarjeta", aliases: ["mastercard"] },
  { id: "amex", name: "American Express", kind: "tarjeta", aliases: ["american express", "amex"] },
  { id: "mercadopago", name: "Mercado Pago", kind: "billetera", aliases: ["mercado pago", "mercadopago"] },
  { id: "clublanacion", name: "Club La Nación", kind: "club", aliases: ["club la nacion"] },
  { id: "modo", name: "MODO", kind: "billetera", aliases: ["modo"] },
  { id: "galicia", name: "Banco Galicia", kind: "banco", aliases: ["galicia"] },
  { id: "macro", name: "Banco Macro", kind: "banco", aliases: ["macro"] },
  { id: "bbva", name: "BBVA", kind: "banco", aliases: ["bbva", "frances"] },
  { id: "patagonia", name: "Banco Patagonia", kind: "banco", aliases: ["patagonia"] },
  { id: "cuentadni", name: "Cuenta DNI", kind: "billetera", aliases: ["cuenta dni", "banco provincia"] },
  { id: "naranjax", name: "Naranja X", kind: "billetera", aliases: ["naranja"] },
  { id: "personalpay", name: "Personal Pay", kind: "billetera", aliases: ["personal pay"] },
  { id: "brubank", name: "Brubank", kind: "banco", aliases: ["brubank"] },
  { id: "clarin365", name: "Clarín 365", kind: "club", aliases: ["clarin 365", "tarjeta 365"] },
];

/** What the user told us they have (Buenos Aires, Oct 2026). */
export const DEFAULT_SOURCE_IDS = [
  "santander",
  "ciudad",
  "nacion",
  "visa",
  "mastercard",
  "amex",
  "mercadopago",
  "clublanacion",
  "modo",
];

export function sourceName(id: string): string {
  return SOURCES.find((s) => s.id === id)?.name ?? id;
}
