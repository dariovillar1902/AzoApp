import { fetchWithTimeout } from "../core/http";
import { normalizeText, stripAccents } from "../core/normalize";
import { SOURCES } from "./sources";
import type { CapPeriod, Promotion } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

interface CotoPromocion {
  descripcion: string;
  dias: { descripcion: string }[];
  observacion: string | null;
  textoDescuento: string;
  icono: string | null;
}

interface CotoPromosResponse {
  result?: { promocionesDigitales: CotoPromocion[] };
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

/** Banks we don't model as sources; a promo naming one of them isn't for the user. */
const OTHER_ISSUERS = /\b(banco|credicoop|icbc|supervielle|hipotecario|comafi|brubank|uala|columbia|nativa|cabal|cencosud|openbank|reba)\b/;

/**
 * Which sources a free-text promo description asks for. Card networks alone
 * ("Visa crédito") are generic; a named bank or wallet must be one the user
 * has, and an issuer we don't model makes the promo unusable (`null`).
 */
export function detectRequiredSources(text: string): string[] | null {
  let remaining = ` ${normalizeText(text)} `;
  const aliases = SOURCES.flatMap((s) => s.aliases.map((alias) => ({ alias, source: s })))
    // Longest first so "club la nacion" is consumed before "nacion".
    .sort((a, b) => b.alias.length - a.alias.length);

  const found = new Set<string>();
  for (const { alias, source } of aliases) {
    const needle = ` ${alias} `;
    if (remaining.includes(needle)) {
      found.add(source.id);
      remaining = remaining.split(needle).join(" ");
    }
  }

  const hasNamedIssuer = SOURCES.some((s) => s.kind !== "tarjeta" && found.has(s.id));
  if (!hasNamedIssuer && OTHER_ISSUERS.test(remaining)) return null;
  return [...found];
}

function parsePct(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return match ? parseFloat(match[1].replace(",", ".")) : null;
}

function parseCap(text: string | null): number | undefined {
  const match = text?.match(/tope de reintegro\s*\$?\s*([\d.,]+)/i);
  if (!match) return undefined;
  const value = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

/** Segments a Coto promo is restricted to, matching the toggles in "Mis medios". */
export function audienceOf(text: string): string | undefined {
  const t = normalizeText(text);
  if (/\bjubilad/.test(t)) return "jubilados";
  if (/\b(plan|cuenta) sueldo\b|\bhaberes\b/.test(t)) return "plan-sueldo";
  if (/\bcomunidad\b/.test(t)) return "comunidad-coto";
  return undefined;
}

function capPeriod(text: string | null): CapPeriod {
  if (/semana/i.test(text ?? "")) return "semana";
  if (/(compra|transacci|ticket)/i.test(text ?? "")) return "compra";
  return "mes";
}

/**
 * Coto publishes its bank-promotion calendar on a public JSON endpoint (no
 * login). Promos whose issuer we can't map to a source are dropped.
 */
export async function fetchCotoLivePromotions(): Promise<Promotion[]> {
  const url =
    "https://www.coto.com.ar/rest/model/atg/actors/cProfileActor/getPromocionesMulticanal?enviroment=ag&pushSite=CotoDigital";
  const res = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT } }, 5000);
  if (!res.ok) return [];

  const json = (await res.json()) as CotoPromosResponse;
  const today = new Date().toISOString().slice(0, 10);

  return (json.result?.promocionesDigitales ?? []).flatMap((p, index): Promotion[] => {
    const discountPct = parsePct(p.textoDescuento);
    // The bank is sometimes only in the logo's file name (".../bancos/galicia.png").
    const logo = (p.icono ?? "").replace(/\.[a-z]+$/i, "").replace(/[^a-zA-Z]+/g, " ");
    const text = `${p.descripcion} ${p.observacion ?? ""}`;
    const requires = detectRequiredSources(`${text} ${logo}`);
    if (discountPct === null || requires === null) return [];

    const days = p.dias
      .map((d) => DAY_NAME_TO_INDEX[stripAccents(d.descripcion.toLowerCase())])
      .filter((d): d is number => d !== undefined);
    const cap = parseCap(p.observacion);

    return [
      {
        id: `coto-live-${index}`,
        requires,
        category: "supermercado",
        merchants: ["coto"],
        daysOfWeek: days.length > 0 ? days : undefined,
        discountPct,
        cap: cap ? { amount: cap, per: capPeriod(p.observacion) } : undefined,
        payment: p.descripcion,
        confidence: "confirmada",
        checkedAt: today,
        sourceUrl: "https://www.coto.com.ar/",
        notes: p.observacion ?? undefined,
        audience: audienceOf(text),
        issuerHint: p.icono ?? undefined,
        origin: "coto-live",
      },
    ];
  });
}
