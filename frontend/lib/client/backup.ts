const PREFIX = "AZOAPP1:";

/** Storage keys that make up the user's data (settings, list, price history). */
export const BACKUP_KEYS = ["azoapp.settings.v1", "azoapp.list.v1", "azoapp.prices.v1"];

/** Packs stored values into one pasteable line (base64 of JSON, Unicode-safe). */
export function encodeBackup(values: Record<string, string | null>): string {
  const json = JSON.stringify(values);
  return PREFIX + btoa(unescape(encodeURIComponent(json)));
}

/** Inverse of encodeBackup; throws on anything that isn't an AzoApp backup. */
export function decodeBackup(text: string): Record<string, string> {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error("No es un respaldo de AzoApp");
  const values = JSON.parse(decodeURIComponent(escape(atob(trimmed.slice(PREFIX.length))))) as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    if (typeof values[key] === "string") result[key] = values[key] as string;
  }
  return result;
}
