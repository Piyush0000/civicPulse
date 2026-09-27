import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/regions";
import { buildWorld } from "@/lib/seed/world";
import { generateRequests } from "@/lib/seed/synthetic";
import { STORIES } from "@/lib/seed/scenarios";
import { computeScores, DEFAULT_WEIGHTS } from "@/lib/analytics/scoring";
import { buildCandidates } from "@/lib/analytics/recommendations";
import { ClusterIndex } from "@/lib/analytics/clustering";
import { embedText } from "@/lib/ai/embed";

// End-to-end check of the analytics on the synthetic world (no database needed):
// every planted non-seasonal scenario must be rediscovered as a hotspot and become a recommendation.

const NOW = new Date("2026-09-27T12:00:00Z");

describe.each(REGIONS.map((r) => [r.code, r] as const))("synthetic world %s", (_code, region) => {
  const world = buildWorld(region, NOW);
  const reqs = generateRequests(region, world, NOW);

  it("is deterministic", () => {
    const again = generateRequests(region, buildWorld(region, NOW), NOW);
    expect(again.length).toBe(reqs.length);
    expect(again[10].textOriginal).toBe(reqs[10].textOriginal);
  });

  it("has multilingual, mostly actionable, located requests", () => {
    const langs = new Set(reqs.map((r) => r.language));
    expect(langs.size).toBeGreaterThanOrEqual(2);
    const located = reqs.filter((r) => r.h3).length / reqs.length;
    expect(located).toBeGreaterThan(0.8);
    expect(reqs.some((r) => r.isSpam)).toBe(true);
  });

  it("rediscovers planted hotspots and recommends them", () => {
    let n = 0;
    const idx = new ClusterIndex(0.8, () => `c${++n}`);
    const byReporter = new Map<string, string>();
    const reqIn = reqs
      .filter((r) => r.isActionable)
      .map((r) => {
        const cl = r.h3 ? idx.assign({ id: r.trackingCode, category: r.category, h3: r.h3, embedding: embedText(`${r.summary} | ${r.subcategory}`), reporter: r.reporterKey, at: r.submittedAt }).cluster.id : null;
        byReporter.set(r.reporterKey, r.reporterKey);
        return { category: r.category, h3: r.h3, admin: r.admin, precision: r.precision, urgency: r.urgency, submittedAt: r.submittedAt, reporterId: r.reporterKey, clusterId: cl };
      });
    const gaps = new Map<string, Map<string, number>>();
    for (const i of world.indicators) {
      if (!gaps.has(i.category)) gaps.set(i.category, new Map());
      gaps.get(i.category)!.set(i.h3, Math.max(gaps.get(i.category)!.get(i.h3) ?? 0, i.gap));
    }
    const { scores } = computeScores({
      cells: world.cells.map((c) => ({ h3: c.h3, population: c.population, vuln: c.vuln, conn: c.conn, admin: c.admin })),
      gaps,
      requests: reqIn,
      projects: world.projects.map((p) => ({ category: p.category, status: p.status, cells: p.cells })),
      weights: DEFAULT_WEIGHTS,
      now: NOW,
      minRequests: 3,
      permutations: 0,
      regionCode: region.code,
    });
    const cellAdmin = new Map(world.cells.map((c) => [c.h3, c.admin]));
    const cands = buildCandidates({
      regionCode: region.code,
      cells: world.cells.map((c) => ({ h3: c.h3, population: c.population, admin: c.admin, vuln: c.vuln })),
      scores,
      indicators: new Map(),
    });
    // Scenarios active in the last 90 days: steady + emerging (seasonal ones may be off-season).
    for (const s of STORIES[region.code].scenarios.filter((x) => x.pattern !== "seasonal")) {
      const hot = scores.filter((x) => x.category === s.category && x.isHotspot && cellAdmin.get(x.h3) === s.locality);
      expect(hot.length, `${s.category}@${s.locality} hotspot`).toBeGreaterThan(0);
      expect(cands.some((c) => c.category === s.category && c.admins.includes(s.locality)), `${s.category}@${s.locality} recommended`).toBe(true);
    }
    // Emerging scenarios must be flagged as emerging.
    for (const s of STORIES[region.code].scenarios.filter((x) => x.pattern === "emerging")) {
      expect(scores.some((x) => x.category === s.category && x.isEmerging && cellAdmin.get(x.h3) === s.locality), `${s.category}@${s.locality} emerging`).toBe(true);
    }
  });
});
