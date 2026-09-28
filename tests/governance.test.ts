import { describe, expect, it } from "vitest";
import { latLngToCell, gridDisk, cellToLatLng } from "h3-js";
import { simulateSite, type WhatIfCell } from "@/lib/analytics/whatif";
import { currentFy, syntheticAllocations, SCHEMES } from "@/lib/allocations";
import { CATEGORIES } from "@/lib/categories";

function grid(distForCell: (d: number) => number): WhatIfCell[] {
  const c = latLngToCell(28.5, 77.2, 8);
  return gridDisk(c, 12).map((h) => {
    const [lat, lng] = cellToLatLng(h);
    const d = Math.hypot((lat - 28.5) * 111, (lng - 77.2) * 97);
    return { h3: h, lat, lng, population: 1000, vuln: 0.5, admin: "A", gap: Math.min(1, distForCell(d) / 5), distKm: distForCell(d), score: 60, F: 0, complaints12m: 2 };
  });
}

describe("what-if simulator", () => {
  it("a hospital in an underserved spot shortens distances and brings people within the standard", () => {
    const cells = grid(() => 6); // everyone is 6 km from care
    const r = simulateSite({ type: "hospital", lat: 28.5, lng: 77.2, cells, peopleShare: 1, wG: 0.25, alpha: 0.7, observedEffect: 0.5, area: "A" });
    expect(r.catchmentPopulation).toBeGreaterThan(0);
    expect(r.meanDistanceAfterKm!).toBeLessThan(r.meanDistanceBeforeKm!);
    expect(r.newlyWithinStandard).toBeGreaterThan(0);
    expect(r.priorityAfter).toBeLessThan(r.priorityBefore);
    expect(r.expectedComplaintsAvoidedPerYear).toBeGreaterThan(0);
    expect(r.costPerBeneficiaryInr).toBe(Math.round(r.costInr / r.peopleBenefiting));
  });

  it("building where care already exists changes nothing", () => {
    const cells = grid(() => 0.2);
    const r = simulateSite({ type: "hospital", lat: 28.5, lng: 77.2, cells, peopleShare: 1, wG: 0.25, alpha: 0.7, observedEffect: null, area: "A" });
    expect(r.newlyWithinStandard).toBe(0);
    expect(r.meanGapAfter).toBe(r.meanGapBefore);
    expect(r.expectedComplaintsAvoidedPerYear).toBe(0);
  });

  it("clamps the learned effect size to a plausible range", () => {
    const cells = grid(() => 6);
    const r = simulateSite({ type: "clinic", lat: 28.5, lng: 77.2, cells, peopleShare: 1, wG: 0.25, alpha: 0.7, observedEffect: 3, area: "A" });
    expect(r.observedEffectPct).toBe(70);
  });
});

describe("fund allocations", () => {
  it("every category maps to a government scheme", () => {
    for (const c of CATEGORIES) expect(SCHEMES[c].scheme.length).toBeGreaterThan(3);
  });
  it("release and utilisation follow project status and never exceed sanction", () => {
    const { rows, envelopes } = syntheticAllocations("IN-DL", [
      { ref: "A", title: "done", category: "water_supply", status: "completed", budgetLocal: 1e8 },
      { ref: "B", title: "ongoing", category: "roads_transport", status: "in_progress", budgetLocal: 5e8 },
      { ref: "C", title: "planned", category: "health", status: "planned", budgetLocal: 2e8 },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.project_ref, r]));
    expect(by.A.released).toBe(by.A.sanctioned);
    expect(by.C.released).toBe(0);
    for (const r of rows) {
      expect(r.released).toBeLessThanOrEqual(r.sanctioned);
      expect(r.utilised).toBeLessThanOrEqual(r.released);
      expect(r.fy).toBe(currentFy());
    }
    const roads = envelopes.find((e) => e.scheme.includes("Roads"))!;
    expect(roads.envelope).toBeGreaterThanOrEqual(5e8); // envelope covers committed spend
  });
  it("financial year runs April to March", () => {
    expect(currentFy(new Date("2026-03-31T00:00:00Z"))).toBe("2025-26");
    expect(currentFy(new Date("2026-04-01T00:00:00Z"))).toBe("2026-27");
  });
});
