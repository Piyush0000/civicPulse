// Impact evaluation, forecasting and the budget optimizer. Pure functions; the engine feeds them data.

const DAY = 86400000;

// ---------------------------------------------------------------- impact (difference-in-differences)

export type ImpactResult = {
  before: number; // requests per 1,000 people per 30 days
  after: number;
  pctChange: number | null;
  controlBefore: number;
  controlAfter: number;
  controlPctChange: number | null;
  did: number | null; // percentage points
  footprintPopulation: number;
  controlCells: number;
  afterDays: number;
  series: { month: number; project: number; control: number }[]; // month offset from completion
};

export function impactOf(input: {
  footprint: string[];
  completed: Date;
  now: Date;
  population: Map<string, number>;
  requests: { h3: string; at: Date }[];
  excludeCells: Set<string>;
  controlSize?: number;
}): ImpactResult {
  const { footprint, completed, now, population, requests } = input;
  const c = completed.getTime();
  const preFrom = c - 104 * DAY,
    preTo = c - 14 * DAY;
  const postFrom = c + 14 * DAY;
  const postTo = Math.min(c + 104 * DAY, now.getTime());
  const afterDays = Math.max(0, (postTo - postFrom) / DAY);

  const pre = new Map<string, number>();
  const post = new Map<string, number>();
  for (const r of requests) {
    const t = r.at.getTime();
    if (t >= preFrom && t < preTo) pre.set(r.h3, (pre.get(r.h3) || 0) + 1);
    else if (t >= postFrom && t < postTo) post.set(r.h3, (post.get(r.h3) || 0) + 1);
  }
  const fp = new Set(footprint);
  const rate = (cells: string[], m: Map<string, number>, days: number) => {
    const pop = cells.reduce((a, h) => a + (population.get(h) || 0), 0);
    const cnt = cells.reduce((a, h) => a + (m.get(h) || 0), 0);
    return pop > 0 && days > 0 ? ((cnt / pop) * 1000 * 30) / days : 0;
  };
  const before = rate(footprint, pre, 90);
  const after = rate(footprint, post, afterDays);

  // Control: non-project cells whose pre-period rate is closest to the footprint's.
  const candidates = [...population.keys()].filter((h) => !fp.has(h) && !input.excludeCells.has(h) && (pre.get(h) || 0) > 0);
  const control = candidates
    .map((h) => ({ h, d: Math.abs(rate([h], pre, 90) - before) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, input.controlSize ?? 20)
    .map((x) => x.h);
  const controlBefore = rate(control, pre, 90);
  const controlAfter = rate(control, post, afterDays);
  const pct = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : null);
  const pctChange = pct(before, after);
  const controlPctChange = pct(controlBefore, controlAfter);

  // Monthly series around completion, per 1,000 people.
  const series: ImpactResult["series"] = [];
  const cset = new Set(control);
  const popF = footprint.reduce((a, h) => a + (population.get(h) || 0), 0) || 1;
  const popC = control.reduce((a, h) => a + (population.get(h) || 0), 0) || 1;
  for (let m = -5; m <= 5; m++) {
    const from = c + m * 30 * DAY,
      to = from + 30 * DAY;
    if (from > now.getTime()) break;
    let pf = 0,
      pc = 0;
    for (const r of requests) {
      const t = r.at.getTime();
      if (t < from || t >= to) continue;
      if (fp.has(r.h3)) pf++;
      else if (cset.has(r.h3)) pc++;
    }
    series.push({ month: m, project: round((pf / popF) * 1000), control: round((pc / popC) * 1000) });
  }
  return {
    before: round(before),
    after: round(after),
    pctChange: pctChange === null ? null : round(pctChange, 1),
    controlBefore: round(controlBefore),
    controlAfter: round(controlAfter),
    controlPctChange: controlPctChange === null ? null : round(controlPctChange, 1),
    did: pctChange !== null && controlPctChange !== null ? round(pctChange - controlPctChange, 1) : null,
    footprintPopulation: Math.round(popF),
    controlCells: control.length,
    afterDays: Math.round(afterDays),
    series,
  };
}

const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- forecast

/** Seasonal-naive blended with recent level. `monthly` = last 12 full months, oldest first. */
export function forecastMonthly(monthly: number[], horizon = 3): number[] {
  const n = monthly.length;
  if (n < 12) {
    const lvl = monthly.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, n));
    return Array(horizon).fill(Math.round(lvl));
  }
  const recent = (monthly[n - 1] + monthly[n - 2] + monthly[n - 3]) / 3;
  const sameLastYear = (monthly[n - 12] + monthly[n - 11] + monthly[n - 10]) / 3 || 1;
  const annualMean = monthly.reduce((a, b) => a + b, 0) / n || 1;
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const seasonal = monthly[n - 12 + h - 1]; // same month last year
    const levelAdj = Math.min(2, Math.max(0.5, recent / Math.max(sameLastYear, annualMean * 0.5)));
    out.push(Math.max(0, Math.round(0.65 * seasonal * levelAdj + 0.35 * recent)));
  }
  return out;
}

// ---------------------------------------------------------------- budget optimizer

export type OptCandidate = {
  id: string;
  title: string;
  category: string;
  costUsd: number;
  people: number;
  score: number; // 0..100
  fundedOverlap: number;
  meanVuln: number;
};

export type OptResult = {
  selected: OptCandidate[];
  spent: number;
  people: number;
  benefit: number;
  vulnerableShare: number;
};

/** Greedy knapsack on benefit/cost with an equity floor: `equityShare` of spend reserved for the
 * most vulnerable areas (mean vulnerability >= `vulnThreshold`). Benefit = people × need score. */
export function optimizePortfolio(cands: OptCandidate[], budgetUsd: number, equityShare = 0.4, vulnThreshold = 0.6): OptResult {
  const benefit = (c: OptCandidate) => c.people * (c.score / 100) * (1 - 0.7 * c.fundedOverlap);
  const ratio = (c: OptCandidate) => benefit(c) / Math.max(c.costUsd, 1);
  const sorted = [...cands].filter((c) => c.costUsd > 0).sort((a, b) => ratio(b) - ratio(a));
  const chosen = new Set<string>();
  let spent = 0;
  let vulnSpent = 0;
  const floor = budgetUsd * equityShare;
  for (const c of sorted.filter((c) => c.meanVuln >= vulnThreshold)) {
    if (vulnSpent >= floor) break;
    if (spent + c.costUsd > budgetUsd) continue;
    chosen.add(c.id);
    spent += c.costUsd;
    vulnSpent += c.costUsd;
  }
  for (const c of sorted) {
    if (chosen.has(c.id) || spent + c.costUsd > budgetUsd) continue;
    chosen.add(c.id);
    spent += c.costUsd;
    if (c.meanVuln >= vulnThreshold) vulnSpent += c.costUsd;
  }
  const selected = sorted.filter((c) => chosen.has(c.id));
  return {
    selected,
    spent,
    people: selected.reduce((a, c) => a + c.people, 0),
    benefit: Math.round(selected.reduce((a, c) => a + benefit(c), 0)),
    vulnerableShare: spent > 0 ? vulnSpent / spent : 0,
  };
}
