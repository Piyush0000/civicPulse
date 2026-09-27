import { cellToLatLng, gridDisk, latLngToCell, cellToBoundary, getHexagonEdgeLengthAvg, UNITS } from "h3-js";
import { haversineKm } from "./stats";
import type { Locality, RegionDef } from "./regions";

export { latLngToCell, cellToLatLng, gridDisk, cellToBoundary };

/** All H3 cells of a region: a disc around the centre, minus water where a land mask exists. */
export function regionCells(region: RegionDef): string[] {
  const center = latLngToCell(region.center[0], region.center[1], region.h3Res);
  const spacingKm = getHexagonEdgeLengthAvg(region.h3Res, UNITS.km) * Math.sqrt(3);
  const k = Math.ceil(region.radiusKm / spacingKm) + 1;
  return gridDisk(center, k).filter((c) => {
    const [lat, lng] = cellToLatLng(c);
    if (haversineKm(lat, lng, region.center[0], region.center[1]) > region.radiusKm) return false;
    return region.isLand ? region.isLand(lat, lng) : true;
  });
}

export function nearestLocality(region: RegionDef, lat: number, lng: number): { loc: Locality; km: number } {
  let best = region.localities[0];
  let bestKm = Infinity;
  for (const l of region.localities) {
    const d = haversineKm(lat, lng, l.lat, l.lng);
    if (d < bestKm) {
      bestKm = d;
      best = l;
    }
  }
  return { loc: best, km: bestKm };
}

export function insideRegion(region: RegionDef, lat: number, lng: number): boolean {
  if (haversineKm(lat, lng, region.center[0], region.center[1]) > region.radiusKm + 0.5) return false;
  return region.isLand ? region.isLand(lat, lng) : true;
}

/** Group a set of cells into connected components using k-ring(1) adjacency. */
export function connectedComponents(cells: string[]): string[][] {
  const set = new Set(cells);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const c of cells) {
    if (seen.has(c)) continue;
    const comp: string[] = [];
    const stack = [c];
    seen.add(c);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const n of gridDisk(cur, 1)) {
        if (set.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    out.push(comp);
  }
  return out;
}
