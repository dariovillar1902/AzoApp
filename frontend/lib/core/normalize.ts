export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeText(text: string): string {
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9\s.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "y",
  "con",
  "sin",
  "un",
  "una",
  "en",
  "para",
  "por",
  "a",
]);

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((t) => /[a-z0-9]/.test(t) && !STOPWORDS.has(t));
}

export interface ExtractedSize {
  sizeText: string;
  value: number;
  unit: "ml" | "g" | "un";
}

/**
 * Finds a quantity like "1l", "1.5 l", "900g", "900 gr", "500cc", "x6", "12 un"
 * anywhere in the text and normalizes it to milliliters (for liquids), grams
 * (for weight) or units (for packs). Multi-packs like "6x200g" are expanded
 * to the total (1200g).
 */
export function extractSize(text: string): ExtractedSize | null {
  const t = normalizeText(text);

  const unitAlternation =
    "ml|cc|l|lt|lts|litro|litros|kg|kgs|g|gr|grs|grms|gramo|gramos";

  const multiPack = t.match(
    new RegExp(`(\\d+)\\s*x\\s*(\\d+(?:[.,]\\d+)?)\\s*(${unitAlternation})\\b`),
  );
  // Real multipacks are small (2-24 units); a bigger count is almost always
  // a product code sitting right before an unrelated "x <size>" (e.g. a SKU
  // like "...Chocolate 7900 x 1000 g" is 1000g, not 7900 units of 1000g).
  // A rating like "FPS 50 x 380 ml" looks exactly like a 2-24 multipack too.
  const precededByRating =
    multiPack !== null && /\b(fps|spf|factor)\s*$/.test(t.slice(0, multiPack.index));
  if (
    multiPack &&
    parseInt(multiPack[1], 10) >= 2 &&
    parseInt(multiPack[1], 10) <= 24 &&
    !precededByRating
  ) {
    const count = parseInt(multiPack[1], 10);
    const each = parseFloat(multiPack[2].replace(",", "."));
    const unitRaw = multiPack[3];
    const { value, unit } = toBaseUnit(each, unitRaw);
    return { sizeText: multiPack[0], value: value * count, unit };
  }

  const single = t.match(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitAlternation})\\b`),
  );
  if (single) {
    const amount = parseFloat(single[1].replace(",", "."));
    const { value, unit } = toBaseUnit(amount, single[2]);
    return { sizeText: single[0], value, unit };
  }

  const units = t.match(/(?:^|\s)(\d+)\s*(un|uni|unid|unidades|und|ud|uds|pack|caps|cap|capsulas|comp|comprimidos|tabletas|tab|sobres|saquitos)\b/);
  if (units) {
    return {
      sizeText: units[0].trim(),
      value: parseInt(units[1], 10),
      unit: "un",
    };
  }

  return null;
}

function toBaseUnit(
  amount: number,
  unitRaw: string,
): { value: number; unit: "ml" | "g" } {
  if (["l", "lt", "lts", "litro", "litros"].includes(unitRaw)) {
    return { value: amount * 1000, unit: "ml" };
  }
  if (["kg", "kgs"].includes(unitRaw)) {
    return { value: amount * 1000, unit: "g" };
  }
  if (["ml", "cc"].includes(unitRaw)) {
    return { value: amount, unit: "ml" };
  }
  // g, gr, grs, grms, gramo, gramos
  return { value: amount, unit: "g" };
}

/**
 * Some storefronts' search engines choke on fused size tokens like "500g" or
 * "2.25l" glued to the rest of the query (they return zero results instead of
 * ignoring the unknown token), and filler words like "para"/"de" can shove
 * the actually-relevant product out of the top results (e.g. "broches para
 * ropa" ranks worse than plain "broches ropa"). We search with size and
 * filler words stripped and let our own reranking (which does understand
 * both) pick the closest match from the broader candidate set.
 */
export function stripSizeForSearch(text: string): string {
  const normalized = normalizeText(text);
  const size = extractSize(normalized);
  const withoutSize = size ? normalized.replace(size.sizeText, " ") : normalized;
  return tokenize(withoutSize).join(" ");
}

export function tokenizeWithoutSize(text: string): string[] {
  const normalized = normalizeText(text);
  const size = extractSize(normalized);
  const withoutSize = size
    ? normalized.replace(size.sizeText, " ")
    : normalized;
  return tokenize(withoutSize);
}

/**
 * Cheap Spanish pluralization variants for a token: "broches" -> also try
 * "broche"; "tallarines" -> also try "tallarin". Used so "broches" (query)
 * recognizes "broche" (product name) as the same word instead of two
 * unrelated tokens.
 */
function stemForms(token: string): string[] {
  const forms = [token];
  if (token.length > 4 && token.endsWith("es")) forms.push(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s")) forms.push(token.slice(0, -1));
  return forms;
}

export function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const formsA = stemForms(a);
  return stemForms(b).some((fb) => formsA.includes(fb));
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = [...new Set(a)];
  const setB = [...new Set(b)];
  if (setA.length === 0 && setB.length === 0) return 1;
  const usedB = new Set<string>();
  let intersection = 0;
  for (const tokA of setA) {
    const match = setB.find((tokB) => !usedB.has(tokB) && tokenMatches(tokA, tokB));
    if (match) {
      intersection++;
      usedB.add(match);
    }
  }
  const union = setA.length + setB.length - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * How much of `query`'s tokens show up in `candidate`. Unlike Jaccard, this
 * doesn't get diluted when the candidate has a long, descriptive name with
 * lots of extra words the short user query never mentioned.
 */
export function containmentSimilarity(query: string[], candidate: string[]): number {
  if (query.length === 0) return 0;
  const candidateSet = [...new Set(candidate)];
  const used = new Set<string>();
  let covered = 0;
  for (const tok of query) {
    const match = candidateSet.find((c) => !used.has(c) && tokenMatches(tok, c));
    if (match) {
      covered++;
      used.add(match);
    }
  }
  return covered / query.length;
}
