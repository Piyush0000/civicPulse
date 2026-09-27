import { gridDisk } from "h3-js";
import type { Category, Precision, Urgency } from "../categories";
import { CATEGORIES, PRECISION_WEIGHT, URGENCY_WEIGHT } from "../categories";
import { hashString, normalCdf, pctRank, poissonUpperTail, rng } from "../stats";

export type Weights = { wD: number; wG: number; wP: number; wV: number; alpha: number };
export const DEFAULT_WEIGHTS: Weights = { wD: 0.35, wG: 0.25, wP: 0.2, wV: 0.2, alpha: 0.7 };

export function validateWeights(w: Weights): string | null {
  const s = w.wD + w.wG + w.wP + w.wV;
  if ([w.wD, w.wG, w.wP, w.wV, w.alpha].some((x) => !Number.isFinite(x) || x < 0 || x > 1)) return "weights must be in [0,1]";
  if (Math.abs(s - 1) > 1e-6) return `weights must sum to 1 (got ${s.toFixed(3)})`;
  return null;
}

export type CellIn = { h3: string; population: number; vuln: number; conn: number; admin: string | null };
export type ReqIn = {
  category: string;
  h3: string | null;
  admin: string | null;
  precision: Precision;
  urgency: Urgency;
  submittedAt: Date;
  reporterId: string | null;
  clusterId: string | null;
};
export type ProjectIn = { category: string; status: string; cells: string[] };

export type CellScore = {
  h3: string;
  category: Category;
  demandRaw: number;
  demandAdj: number;
  D: number;
  G: number;
  P: number;
  V: number;
  F: number;
  score: number;
  giZ: number | null;
  giP: number | null;
  isHotspot: boolean;
  count90: number;
  reporters90: number;
  noSignal: boolean;
  trendRatio: number | null;
  isEmerging: boolean;
};

const DAY = 86400000;

/** Percentile rank where zero demand stays 0 and positive values spread over (0,1]. */
export function demandNorm(values: number[]): number[] {
  const pos = values.map((v, i) => [v, i] as const).filter(([v]) => v > 0);
  const out = new Array(values.length).fill(0);
  if (!pos.length) return out;
  const ranks = pctRank(pos.map(([v]) => v));
  pos.forEach(([, i], k) => (out[i] = pos.length === 1 ? 1 : 0.05 + 0.95 * ranks[k]));
  return out;
}

/** Row-standardisation-free Gi* on binary k-ring(1) weights (self included), with conditional permutations. */
export function getisOrdGiStar(
  cells: string[],
  x: number[],
  opts: { permutations?: number; seed?: number } = {},
): { z: number[]; p: number[] } {
  const n = cells.length;
  const idx = new Map(cells.map((c, i) => [c, i]));
  const mean = x.reduce((a, b) => a + b, 0) / n;
  const s = Math.sqrt(x.reduce((a, b) => a + b * b, 0) / n - mean * mean);
  const z = new Array<number>(n).fill(0);
  const p = new Array<number>(n).fill(1);
  if (!(s > 0) || n < 3) return { z, p };
  const perms = opts.permutations ?? 0;
  const r = rng(opts.seed ?? 42);
  const giz = (sum: number, W: number) => {
    const denom = s * Math.sqrt((n * W - W * W) / (n - 1));
    return denom > 0 ? (sum - mean * W) / denom : 0;
  };
  for (let i = 0; i < n; i++) {
    const neigh = gridDisk(cells[i], 1)
      .map((c) => idx.get(c))
      .filter((j): j is number => j !== undefined);
    const W = neigh.length;
    const sum = neigh.reduce((a, j) => a + x[j], 0);
    z[i] = giz(sum, W);
    if (perms > 0) {
      // Conditional randomisation: keep x_i, draw W-1 other values at random.
      let extreme = 0;
      for (let k = 0; k < perms; k++) {
        let ps = x[i];
        for (let m = 1; m < W; m++) {
          let j = Math.floor(r.next() * (n - 1));
          if (j >= i) j++;
          ps += x[j];
        }
        if (Math.abs(giz(ps, W)) >= Math.abs(z[i])) extreme++;
      }
      p[i] = (extreme + 1) / (perms + 1);
    } else {
      p[i] = 2 * (1 - normalCdf(Math.abs(z[i])));
    }
  }
  return { z, p };
}

export function computeScores(input: {
  cells: CellIn[];
  gaps: Map<string, Map<string, number>>; // category -> h3 -> gap
  requests: ReqIn[];
  projects: ProjectIn[];
  weights: Weights;
  now: Date;
  minRequests: number;
  permutations?: number;
  regionCode: string;
  minCellsWithData?: number;
}): { scores: CellScore[]; insufficient: string[] } {
  const { cells, gaps, requests, projects, weights, now, minRequests } = input;
  const n = cells.length;
  const idx = new Map(cells.map((c, i) => [c.h3, i]));
  const cellsByAdmin = new Map<string, number[]>();
  cells.forEach((c, i) => {
    if (!c.admin) return;
    if (!cellsByAdmin.has(c.admin)) cellsByAdmin.set(c.admin, []);
    cellsByAdmin.get(c.admin)!.push(i);
  });
  const P = pctRank(cells.map((c) => c.population));
  const ring = cells.map((c) => gridDisk(c.h3, 1).map((h) => idx.get(h)).filter((j): j is number => j !== undefined));
  const out: CellScore[] = [];
  const insufficient: string[] = [];

  for (const cat of CATEGORIES) {
    const raw = new Array<number>(n).fill(0);
    const count90 = new Array<number>(n).fill(0);
    const reporters = Array.from({ length: n }, () => new Set<string>());
    const last30 = new Array<number>(n).fill(0);
    const prior60 = new Array<number>(n).fill(0);
    const seen = new Set<string>();
    for (const rq of requests) {
      if (rq.category !== cat) continue;
      const age = (now.getTime() - rq.submittedAt.getTime()) / DAY;
      if (age < 0 || age > 90) continue;
      let targets: number[] = [];
      if (rq.precision === "district" && rq.admin && cellsByAdmin.has(rq.admin)) targets = cellsByAdmin.get(rq.admin)!;
      else if (rq.h3 && idx.has(rq.h3)) targets = [idx.get(rq.h3)!];
      if (!targets.length) continue;
      const home = rq.h3 && idx.has(rq.h3) ? idx.get(rq.h3)! : targets[0];
      count90[home]++;
      if (rq.reporterId) reporters[home].add(rq.reporterId);
      if (age <= 30) last30[home]++;
      else prior60[home]++;
      // Anti-gaming: one reporter counts once per cluster per 7-day bucket.
      const key = `${rq.reporterId ?? "anon"}|${rq.clusterId ?? rq.h3}|${Math.floor(age / 7)}`;
      if (rq.reporterId && seen.has(key)) continue;
      seen.add(key);
      const w =
        (rq.precision === "district" ? 1 / targets.length : PRECISION_WEIGHT[rq.precision]) *
        URGENCY_WEIGHT[rq.urgency] *
        Math.exp(-age / 45);
      for (const t of targets) raw[t] += w;
    }
    const adj = raw.map((v, i) => v / Math.max(cells[i].conn, 0.2));
    const D = demandNorm(adj);
    const gapMap = gaps.get(cat);
    const G = cells.map((c) => gapMap?.get(c.h3) ?? c.vuln);
    const funded = new Set<string>();
    for (const p of projects) {
      if (p.category !== cat || !["planned", "approved", "in_progress"].includes(p.status)) continue;
      for (const h of p.cells) funded.add(h);
    }
    const withData = count90.filter((c) => c > 0).length;
    let gi: { z: number[]; p: number[] } | null = null;
    // Spec asks for >= 30 cells with data; small pilot grids scale that down (min 12).
    const minCells = input.minCellsWithData ?? Math.min(30, Math.max(12, Math.round(n * 0.04)));
    if (withData >= minCells) {
      gi = getisOrdGiStar(
        cells.map((c) => c.h3),
        adj,
        { permutations: input.permutations ?? 199, seed: hashString(input.regionCode + cat) },
      );
    } else insufficient.push(cat);

    for (let i = 0; i < n; i++) {
      const F = funded.has(cells[i].h3) ? 1 : 0;
      const base = weights.wD * D[i] + weights.wG * G[i] + weights.wP * P[i] + weights.wV * cells[i].vuln;
      const score = 100 * base * (1 - weights.alpha * F);
      // Emerging: last 30 days vs the prior 60 in the k-ring neighbourhood (Poisson test).
      const l30 = ring[i].reduce((a, j) => a + last30[j], 0);
      const p60 = ring[i].reduce((a, j) => a + prior60[j], 0);
      const expected = Math.max(p60 / 2, 0.5);
      const emerging = l30 >= 5 && l30 / expected >= 2 && poissonUpperTail(l30, expected) < 0.01;
      const z = gi ? gi.z[i] : null;
      const p = gi ? gi.p[i] : null;
      out.push({
        h3: cells[i].h3,
        category: cat,
        demandRaw: raw[i],
        demandAdj: adj[i],
        D: D[i],
        G: G[i],
        P: P[i],
        V: cells[i].vuln,
        F,
        score,
        giZ: z,
        giP: p,
        isHotspot: z !== null && p !== null && z > 1.96 && p < 0.05 && count90[i] >= minRequests,
        count90: count90[i],
        reporters90: reporters[i].size,
        noSignal: count90[i] === 0,
        trendRatio: l30 + p60 > 0 ? l30 / expected : null,
        isEmerging: emerging,
      });
    }
  }
  return { scores: out, insufficient };
}
