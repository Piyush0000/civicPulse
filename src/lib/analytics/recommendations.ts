import { createHash } from "node:crypto";
import { cellToLatLng, gridDisk } from "h3-js";
import type { Category } from "../categories";
import { CATEGORY_META } from "../categories";
import { connectedComponents } from "../geo";
import { median } from "../stats";
import type { CellScore } from "./scoring";

export type CandidateArea = {
  category: Category;
  cells: string[];
  admins: string[];
  centerLat: number;
  centerLng: number;
  score: number;
  people: number;
  requestCount: number;
  uniqueReporters: number;
  hotspotCells: number;
  fundedOverlap: number;
  gapSummary: Record<string, { area: number; regionMedian: number; unit: string; isProxy: boolean }>;
  title: string;
  estCostUsd: number;
  fingerprint: string;
  meanVuln: number;
};

/** Split an oversized component by growing compact patches from the highest-scoring cells. */
export function splitComponent(cells: string[], score: Map<string, number>, max = 25): string[][] {
  if (cells.length <= max) return [cells];
  const remaining = new Set(cells);
  const out: string[][] = [];
  while (remaining.size) {
    const seed = [...remaining].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0))[0];
    const patch = [seed];
    remaining.delete(seed);
    const frontier = new Set<string>();
    const grow = (c: string) => gridDisk(c, 1).forEach((n) => remaining.has(n) && frontier.add(n));
    grow(seed);
    while (patch.length < max && frontier.size) {
      const next = [...frontier].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0))[0];
      frontier.delete(next);
      if (!remaining.has(next)) continue;
      remaining.delete(next);
      patch.push(next);
      grow(next);
    }
    out.push(patch);
  }
  return out;
}

export function fingerprint(region: string, category: string, cells: string[]): string {
  return createHash("sha1").update(`${region}|${category}|${[...cells].sort().join(",")}`).digest("hex").slice(0, 20);
}

export function buildCandidates(input: {
  regionCode: string;
  cells: { h3: string; population: number; admin: string | null; vuln: number }[];
  scores: CellScore[];
  indicators: Map<string, Map<string, { key: string; value: number; isProxy: boolean }>>; // category -> h3 -> indicator
  threshold?: number;
  maxCells?: number;
}): CandidateArea[] {
  const { regionCode, cells, scores } = input;
  const threshold = input.threshold ?? 70;
  const cellInfo = new Map(cells.map((c) => [c.h3, c]));
  const byCat = new Map<string, CellScore[]>();
  for (const s of scores) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }
  const out: CandidateArea[] = [];
  for (const [cat, list] of byCat) {
    const scoreMap = new Map(list.map((s) => [s.h3, s.score]));
    const sMap = new Map(list.map((s) => [s.h3, s]));
    const picked = list.filter((s) => s.isHotspot || (s.score >= threshold && s.count90 > 0)).map((s) => s.h3);
    const indicatorMap = input.indicators.get(cat);
    const regionMedian = indicatorMap ? median([...indicatorMap.values()].map((v) => v.value)) : 0;
    for (const comp of connectedComponents(picked)) {
      for (const area of splitComponent(comp, scoreMap, input.maxCells ?? 25)) {
        const ss = area.map((h) => sMap.get(h)!);
        const requestCount = ss.reduce((a, s) => a + s.count90, 0);
        const uniqueReporters = ss.reduce((a, s) => a + s.reporters90, 0);
        const hotspotCells = ss.filter((s) => s.isHotspot).length;
        // Evidence floor: a statistically significant hotspot, or a substantial volume of requests.
        if (requestCount < 3 || (hotspotCells === 0 && (requestCount < 8 || uniqueReporters < 5))) continue;
        const pops = area.map((h) => cellInfo.get(h)?.population ?? 0);
        const popSum = pops.reduce((a, b) => a + b, 0) || 1;
        const score = ss.reduce((a, s, i) => a + s.score * pops[i], 0) / popSum;
        const adminCount = new Map<string, number>();
        for (const h of area) {
          const a = cellInfo.get(h)?.admin;
          if (a) adminCount.set(a, (adminCount.get(a) || 0) + (cellInfo.get(h)?.population ?? 0));
        }
        const admins = [...adminCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a]) => a);
        const meta = CATEGORY_META[cat as Category];
        const people = Math.round(popSum * meta.peopleShare);
        const fundedOverlap = ss.filter((s) => s.F > 0).length / area.length;
        const lat = area.reduce((a, h) => a + cellToLatLng(h)[0], 0) / area.length;
        const lng = area.reduce((a, h) => a + cellToLatLng(h)[1], 0) / area.length;
        const gapSummary: CandidateArea["gapSummary"] = {};
        if (indicatorMap) {
          const vals = area.map((h) => indicatorMap.get(h)).filter(Boolean) as { key: string; value: number; isProxy: boolean }[];
          if (vals.length) {
            gapSummary[vals[0].key] = {
              area: Math.round((vals.reduce((a, v) => a + v.value, 0) / vals.length) * 100) / 100,
              regionMedian: Math.round(regionMedian * 100) / 100,
              unit: vals[0].key,
              isProxy: vals[0].isProxy,
            };
          }
        }
        const meanVuln = area.reduce((a, h) => a + (cellInfo.get(h)?.vuln ?? 0), 0) / area.length;
        out.push({
          category: cat as Category,
          cells: area,
          admins,
          centerLat: lat,
          centerLng: lng,
          score: Math.round(score * 10) / 10,
          people,
          requestCount,
          uniqueReporters,
          hotspotCells,
          fundedOverlap: Math.round(fundedOverlap * 100) / 100,
          gapSummary,
          title: `${meta.action} in ${admins.join(" & ") || "unnamed area"}`,
          estCostUsd: Math.round(people * meta.costPerPersonUsd * (1 - 0.5 * fundedOverlap)),
          fingerprint: fingerprint(regionCode, cat, area),
          meanVuln: Math.round(meanVuln * 1000) / 1000,
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const inter = b.filter((x) => A.has(x)).length;
  return inter / (A.size + b.length - inter || 1);
}
