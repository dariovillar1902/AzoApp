import type { ProductOffer, StoreId, StoreKind } from "../types";
import { searchCoto } from "./coto";
import { searchFarmatodo } from "./farmatodo";
import { searchVtex } from "./vtex";

export interface StoreInfo {
  id: StoreId;
  name: string;
  kind: StoreKind;
  search: (query: string) => Promise<ProductOffer[]>;
}

const vtex = (baseUrl: string, id: StoreId) => (query: string) => searchVtex(baseUrl, id, query);

/**
 * Every chain we can price live. Carrefour, Día and the pharmacies were
 * validated in comparador-precios-ar; Jumbo, Disco, Vea (Cencosud) and
 * ChangoMás (masonline) run the same VTEX catalog API, and a failing store
 * just drops out of the comparison instead of breaking it.
 */
export const STORES: Record<StoreId, StoreInfo> = {
  carrefour: { id: "carrefour", name: "Carrefour", kind: "super", search: vtex("https://www.carrefour.com.ar", "carrefour") },
  coto: { id: "coto", name: "Coto", kind: "super", search: (q) => searchCoto(q) },
  dia: { id: "dia", name: "Día", kind: "super", search: vtex("https://diaonline.supermercadosdia.com.ar", "dia") },
  jumbo: { id: "jumbo", name: "Jumbo", kind: "super", search: vtex("https://www.jumbo.com.ar", "jumbo") },
  disco: { id: "disco", name: "Disco", kind: "super", search: vtex("https://www.disco.com.ar", "disco") },
  vea: { id: "vea", name: "Vea", kind: "super", search: vtex("https://www.vea.com.ar", "vea") },
  changomas: { id: "changomas", name: "ChangoMás", kind: "super", search: vtex("https://www.masonline.com.ar", "changomas") },
  farmacity: { id: "farmacity", name: "Farmacity", kind: "farmacia", search: vtex("https://www.farmacity.com", "farmacity") },
  farmaplus: { id: "farmaplus", name: "Farmaplus", kind: "farmacia", search: vtex("https://www.farmaplus.com.ar", "farmaplus") },
  farmaonline: { id: "farmaonline", name: "Farmaonline", kind: "farmacia", search: vtex("https://www.farmaonline.com", "farmaonline") },
  farmatodo: { id: "farmatodo", name: "Farmatodo", kind: "farmacia", search: searchFarmatodo },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];

export function storeName(id: string): string {
  return (STORES as Record<string, StoreInfo>)[id]?.name ?? id;
}
