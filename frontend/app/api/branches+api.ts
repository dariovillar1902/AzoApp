import { fetchNearbyBranches } from "../../lib/stores/branches";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 6 * 60 * 60 * 1000;

/** GET ?lat=-34.58&lon=-58.42[&radius=3000] → nearest branch of each chain (OpenStreetMap). */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const radius = Math.min(8000, Math.max(500, Number(params.get("radius")) || 3000));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "lat y lon inválidos" }, { status: 400 });
  }

  // ~100 m grid: nearby requests share a result, and the exact position never leaves this function.
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.body);

  try {
    const branches = await fetchNearbyBranches(Number(lat.toFixed(3)), Number(lon.toFixed(3)), radius);
    const body = { branches };
    cache.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
