import { config } from "./config";
import { q, q1 } from "./db";
import { insideRegion } from "./geo";
import { getRegion, type Locality, type RegionDef } from "./regions";

export type GeoHit = { lat: number; lng: number; precision: "street" | "locality" | "district"; admin: string | null; source: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const LANDMARK_RE = /(near|by the|next to|behind|opposite|ke paas|के पास|perto|ao lado|возле|у |рядом|附近|旁边|eduze|block|блок|rua |street|road|дом|号楼)/i;

/** Gazetteer match (exact, then fuzzy on romanised names) within one region. */
export function gazetteer(region: RegionDef, text: string): { loc: Locality; score: number } | null {
  const t = norm(text);
  const raw = text.toLowerCase();
  let best: { loc: Locality; score: number } | null = null;
  for (const l of region.localities) {
    const names = [l.name, ...(l.aliases || [])];
    for (const n of names) {
      const nn = norm(n);
      if (nn && (` ${t} `.includes(` ${nn} `) || t.includes(nn))) return { loc: l, score: 1 };
    }
    if (l.local && raw.includes(l.local.toLowerCase())) return { loc: l, score: 1 };
    // fuzzy: compare the name to every window of the same number of words
    const words = t.split(" ");
    for (const n of names) {
      const nn = norm(n);
      const k = nn.split(" ").length;
      for (let i = 0; i + k <= words.length; i++) {
        const w = words.slice(i, i + k).join(" ");
        if (w.length < 4) continue;
        const sim = 1 - lev(w, nn) / Math.max(w.length, nn.length);
        if (sim >= 0.8 && (!best || sim > best.score)) best = { loc: l, score: sim };
      }
    }
  }
  return best;
}

let lastNominatim = 0;

export async function geocode(regionCode: string, text: string | null): Promise<GeoHit | null> {
  if (!text?.trim()) return null;
  const region = getRegion(regionCode);
  const g = gazetteer(region, text);
  if (g) {
    const hasLandmark = LANDMARK_RE.test(text);
    return {
      lat: g.loc.lat,
      lng: g.loc.lng,
      precision: hasLandmark ? "locality" : "district",
      admin: g.loc.name,
      source: g.score === 1 ? "gazetteer" : `gazetteer~${g.score.toFixed(2)}`,
    };
  }
  if (config.geocoder === "offline") return null;
  // Nominatim (free, OSM). Cached; max 1 request/second as per the usage policy.
  const key = `${regionCode}|${norm(text)}`;
  const cached = await q1<{ lat: number | null; lng: number | null }>("SELECT lat, lng FROM geocode_cache WHERE query=$1", [key]);
  let lat: number | null = null,
    lng: number | null = null;
  if (cached) {
    lat = cached.lat;
    lng = cached.lng;
  } else {
    const wait = lastNominatim + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatim = Date.now();
    try {
      const dLat = region.radiusKm / 111;
      const dLng = region.radiusKm / (111 * Math.cos((region.center[0] * Math.PI) / 180));
      const viewbox = [region.center[1] - dLng, region.center[0] + dLat, region.center[1] + dLng, region.center[0] - dLat].join(",");
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, { headers: { "user-agent": config.nominatimUserAgent }, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
        if (data[0]) {
          lat = Number(data[0].lat);
          lng = Number(data[0].lon);
        }
        await q("INSERT INTO geocode_cache (query, lat, lng, display_name) VALUES ($1,$2,$3,$4) ON CONFLICT (query) DO NOTHING", [
          key,
          lat,
          lng,
          data[0]?.display_name ?? null,
        ]);
      }
    } catch {
      return null;
    }
  }
  if (lat === null || lng === null || !insideRegion(region, lat, lng)) return null;
  return { lat, lng, precision: "street", admin: null, source: "nominatim" };
}
