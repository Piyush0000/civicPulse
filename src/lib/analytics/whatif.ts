import type { Category } from "../categories";
import { clip, haversineKm } from "../stats";

// "If I build a hospital here, what changes?" Deterministic estimate; an LLM only narrates these numbers.

export const FACILITY_TYPES = {
  hospital: { label: "Hospital (100-bed)", category: "health", radiusKm: 5, costInr: 1.2e9, strength: 1, standardKm: 3 },
  clinic: { label: "Urban primary health centre", category: "health", radiusKm: 2, costInr: 2.5e7, strength: 1, standardKm: 1.5 },
  school: { label: "Government school (secondary)", category: "education", radiusKm: 1.5, costInr: 8e7, strength: 0.6, standardKm: 1 },
  water_point: { label: "Community water point / water ATM", category: "water_supply", radiusKm: 0.8, costInr: 1.5e6, strength: 0.6, standardKm: 0.5 },
  drain: { label: "Storm-water drain (2 km)", category: "sanitation_drainage", radiusKm: 1.2, costInr: 6e7, strength: 0.7, standardKm: 0.8 },
  streetlights: { label: "LED street lighting (200 poles)", category: "public_safety_lighting", radiusKm: 1, costInr: 6e6, strength: 0.8, standardKm: 0.6 },
  road: { label: "Road resurfacing (3 km)", category: "roads_transport", radiusKm: 1, costInr: 9e7, strength: 0.6, standardKm: 0.6 },
} as const;
export type FacilityType = keyof typeof FACILITY_TYPES;

export type WhatIfCell = {
  h3: string;
  lat: number;
  lng: number;
  population: number;
  vuln: number;
  admin: string | null;
  gap: number; // current gap for the category (0..1)
  distKm: number | null; // current km to nearest facility (health only)
  score: number; // current priority for the category
  F: number;
  complaints12m: number;
};

export type WhatIfResult = {
  type: FacilityType;
  label: string;
  category: Category;
  site: { lat: number; lng: number; area: string | null };
  catchmentCells: string[];
  catchmentPopulation: number;
  peopleBenefiting: number;
  newlyWithinStandard: number;
  standardKm: number;
  meanGapBefore: number;
  meanGapAfter: number;
  meanDistanceBeforeKm: number | null;
  meanDistanceAfterKm: number | null;
  priorityBefore: number;
  priorityAfter: number;
  complaints12m: number;
  expectedComplaintsAvoidedPerYear: number;
  observedEffectPct: number;
  costInr: number;
  costPerBeneficiaryInr: number;
  meanVulnerability: number;
  regionMeanVulnerability: number;
  benefitIndex: number;
};

export function simulateSite(input: {
  type: FacilityType;
  lat: number;
  lng: number;
  cells: WhatIfCell[];
  peopleShare: number;
  wG: number;
  alpha: number;
  observedEffect: number | null; // average fractional drop in complaints after similar completed projects
  area: string | null;
}): WhatIfResult {
  const t = FACILITY_TYPES[input.type];
  const effect = clip(input.observedEffect ?? 0.45, 0.2, 0.7);
  const inCatch = input.cells
    .map((c) => ({ c, d: haversineKm(input.lat, input.lng, c.lat, c.lng) }))
    .filter((x) => x.d <= t.radiusKm);
  let pop = 0,
    gapB = 0,
    gapA = 0,
    distB = 0,
    distA = 0,
    prioB = 0,
    prioA = 0,
    vuln = 0,
    newly = 0,
    complaints = 0,
    avoided = 0,
    benefit = 0;
  for (const { c, d } of inCatch) {
    const w = c.population;
    let gNew: number;
    if (t.category === "health" && c.distKm !== null) {
      const dNew = Math.min(c.distKm, d);
      gNew = Math.min(c.gap, clip(dNew / 5));
      distB += w * c.distKm;
      distA += w * dNew;
      if (c.distKm > t.standardKm && dNew <= t.standardKm) newly += w;
    } else {
      const reach = t.strength * (1 - d / t.radiusKm);
      gNew = c.gap * (1 - clip(reach));
      if (d <= t.standardKm && c.gap > 0.5) newly += w;
    }
    const reduction = c.gap > 0 ? (c.gap - gNew) / c.gap : 0;
    pop += w;
    gapB += w * c.gap;
    gapA += w * gNew;
    prioB += w * c.score;
    prioA += w * Math.max(0, c.score - 100 * input.wG * (c.gap - gNew) * (1 - input.alpha * c.F));
    vuln += w * c.vuln;
    complaints += c.complaints12m;
    avoided += c.complaints12m * effect * clip(reduction * 1.5);
    benefit += w * (c.gap - gNew) * (0.5 + c.vuln);
  }
  const people = Math.round(pop * input.peopleShare);
  const regionPop = input.cells.reduce((a, c) => a + c.population, 0) || 1;
  const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  const div = (a: number) => (pop > 0 ? a / pop : 0);
  return {
    type: input.type,
    label: t.label,
    category: t.category as Category,
    site: { lat: round(input.lat, 5), lng: round(input.lng, 5), area: input.area },
    catchmentCells: inCatch.map((x) => x.c.h3),
    catchmentPopulation: Math.round(pop),
    peopleBenefiting: people,
    newlyWithinStandard: Math.round(newly * input.peopleShare),
    standardKm: t.standardKm,
    meanGapBefore: round(div(gapB)),
    meanGapAfter: round(div(gapA)),
    meanDistanceBeforeKm: t.category === "health" ? round(div(distB), 1) : null,
    meanDistanceAfterKm: t.category === "health" ? round(div(distA), 1) : null,
    priorityBefore: round(div(prioB), 1),
    priorityAfter: round(div(prioA), 1),
    complaints12m: complaints,
    expectedComplaintsAvoidedPerYear: Math.round(avoided),
    observedEffectPct: Math.round(effect * 100),
    costInr: t.costInr,
    costPerBeneficiaryInr: people > 0 ? Math.round(t.costInr / people) : 0,
    meanVulnerability: round(div(vuln)),
    regionMeanVulnerability: round(input.cells.reduce((a, c) => a + c.vuln * c.population, 0) / regionPop),
    benefitIndex: Math.round(benefit),
  };
}
