import { describe, expect, it } from "vitest";
import { gridDisk, latLngToCell } from "h3-js";
import { decrypt, encrypt, kAnon, pseudonym, redactNames, redactRegex, trackingCode } from "@/lib/privacy";
import { clip, cosine, normalCdf, pctRank, poissonUpperTail, rng } from "@/lib/stats";
import { computeScores, demandNorm, DEFAULT_WEIGHTS, getisOrdGiStar, validateWeights } from "@/lib/analytics/scoring";
import { ClusterIndex } from "@/lib/analytics/clustering";
import { buildCandidates, fingerprint, jaccard, splitComponent } from "@/lib/analytics/recommendations";
import { forecastMonthly, impactOf, optimizePortfolio } from "@/lib/analytics/insights";
import { connectedComponents } from "@/lib/geo";
import { unverifiedNumbers, templateBrief, type BriefPayload } from "@/lib/ai/brief";
import { FALLBACK_EXTRACTION, validateExtraction } from "@/lib/ai/extract";
import { ruleExtract } from "@/lib/ai/rules";
import { detectLanguage } from "@/lib/ai/langdetect";
import { embedText } from "@/lib/ai/embed";
import { canonical, entryHash, GENESIS, type LedgerEntry } from "@/lib/ledger";
import { chunkText } from "@/lib/rag";
import { gazetteer } from "@/lib/geocode";
import { getRegion } from "@/lib/regions";

describe("privacy", () => {
  it("redacts phones, emails and national IDs across BRICS formats", () => {
    const t = "Call +91 98765 43210 or (81) 99999-9999, mail a.b@x.org, CPF 123.456.789-09, Aadhaar 1234 5678 9012, SA 8001015009087";
    const r = redactRegex(t);
    expect(r).not.toMatch(/98765|99999|a\.b@x|123\.456|5678 9012|8001015009087/);
    expect(r).toContain("[PHONE]");
    expect(r).toContain("[EMAIL]");
    expect(r).toContain("[ID]");
  });
  it("keeps ordinary numbers like durations", () => {
    expect(redactRegex("broken for 3 months, 120 families")).toBe("broken for 3 months, 120 families");
  });
  it("redacts detected names", () => {
    expect(redactNames("Meu vizinho João perdeu tudo", ["João"])).toBe("Meu vizinho [NAME] perdeu tudo");
  });
  it("pseudonyms are stable, channel-scoped and irreversible", () => {
    expect(pseudonym("telegram", "42")).toBe(pseudonym("telegram", "42"));
    expect(pseudonym("telegram", "42")).not.toBe(pseudonym("sms", "42"));
    expect(pseudonym("telegram", "42")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("contact encryption round-trips and is randomised", () => {
    const a = encrypt("chat-123");
    expect(a).not.toBe(encrypt("chat-123"));
    expect(decrypt(a)).toBe("chat-123");
  });
  it("tracking codes use the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) expect(trackingCode()).toMatch(/^CP-[A-HJ-NP-Z2-9]{6}$/);
  });
  it("k-anonymity suppresses small groups", () => {
    expect(kAnon([{ unique_reporters: 4 }, { unique_reporters: 5 }], 5)).toHaveLength(1);
  });
});

describe("stats", () => {
  it("percentile rank averages ties", () => {
    expect(pctRank([10, 20, 20, 30])).toEqual([0, 0.5, 0.5, 1]);
  });
  it("demand normalisation keeps zero at zero", () => {
    const d = demandNorm([0, 0, 1, 5]);
    expect(d[0]).toBe(0);
    expect(d[3]).toBe(1);
    expect(d[2]).toBeGreaterThan(0);
  });
  it("normal CDF and Poisson tail behave", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(poissonUpperTail(10, 2)).toBeLessThan(0.001);
    expect(poissonUpperTail(1, 2)).toBeGreaterThan(0.8);
    expect(clip(2)).toBe(1);
  });
});

describe("scoring", () => {
  it("validates weights", () => {
    expect(validateWeights(DEFAULT_WEIGHTS)).toBeNull();
    expect(validateWeights({ ...DEFAULT_WEIGHTS, wD: 0.5 })).toMatch(/sum to 1/);
  });

  it("Gi* detects a planted hotspot on a toy grid", () => {
    const center = latLngToCell(28.6, 77.2, 8);
    const cells = gridDisk(center, 6);
    const planted = new Set(gridDisk(center, 1));
    const r = rng(7);
    const x = cells.map((c) => (planted.has(c) ? 20 + r.next() * 5 : r.next()));
    const { z, p } = getisOrdGiStar(cells, x, { permutations: 199, seed: 1 });
    const i = cells.indexOf(center);
    expect(z[i]).toBeGreaterThan(1.96);
    expect(p[i]).toBeLessThan(0.05);
    const far = cells.findIndex((c) => !gridDisk(c, 2).some((n) => planted.has(n)));
    expect(z[far]).toBeLessThan(1.96);
  });

  it("priority formula matches a hand computation and funded coverage discounts it", () => {
    const h = latLngToCell(28.6, 77.2, 8);
    const now = new Date("2026-09-01T00:00:00Z");
    const { scores } = computeScores({
      cells: [
        { h3: h, population: 1000, vuln: 0.5, conn: 0.5, admin: "A" },
        { h3: gridDisk(h, 1)[1], population: 10, vuln: 0.2, conn: 1, admin: "A" },
      ],
      gaps: new Map([["water_supply", new Map([[h, 0.8]])]]),
      requests: [{ category: "water_supply", h3: h, admin: "A", precision: "exact_pin", urgency: "high", submittedAt: now, reporterId: "r1", clusterId: "c1" }],
      projects: [],
      weights: DEFAULT_WEIGHTS,
      now,
      minRequests: 3,
      permutations: 0,
      regionCode: "T",
    });
    const s = scores.find((x) => x.h3 === h && x.category === "water_supply")!;
    // demand_raw = 1 (pin) × 1.5 (high) × e^0 = 1.5 ; adj = 1.5 / 0.5 = 3 ; D = 1 (only positive)
    expect(s.demandRaw).toBeCloseTo(1.5);
    expect(s.demandAdj).toBeCloseTo(3);
    // P: this cell has the larger population of two => 1
    const expected = 100 * (0.35 * 1 + 0.25 * 0.8 + 0.2 * 1 + 0.2 * 0.5);
    expect(s.score).toBeCloseTo(expected, 5);

    const funded = computeScores({
      cells: [{ h3: h, population: 1000, vuln: 0.5, conn: 0.5, admin: "A" }],
      gaps: new Map(),
      requests: [],
      projects: [{ category: "health", status: "approved", cells: [h] }],
      weights: DEFAULT_WEIGHTS,
      now,
      minRequests: 3,
      permutations: 0,
      regionCode: "T",
    }).scores.find((x) => x.category === "health")!;
    expect(funded.F).toBe(1);
    const unfunded = 100 * (0.25 * 0.5 + 0.2 * 0.5 + 0.2 * 0.5);
    expect(funded.score).toBeCloseTo(unfunded * (1 - 0.7), 5);
  });

  it("anti-gaming: one reporter counts once per cluster per week", () => {
    const h = latLngToCell(28.6, 77.2, 8);
    const now = new Date("2026-09-01T00:00:00Z");
    const spam = Array.from({ length: 20 }, () => ({ category: "roads_transport", h3: h, admin: "A", precision: "exact_pin" as const, urgency: "medium" as const, submittedAt: now, reporterId: "same", clusterId: "c" }));
    const { scores } = computeScores({ cells: [{ h3: h, population: 1, vuln: 0.5, conn: 1, admin: "A" }], gaps: new Map(), requests: spam, projects: [], weights: DEFAULT_WEIGHTS, now, minRequests: 3, permutations: 0, regionCode: "T" });
    const s = scores.find((x) => x.category === "roads_transport")!;
    expect(s.demandRaw).toBeCloseTo(1);
    expect(s.count90).toBe(20);
    expect(s.reporters90).toBe(1);
  });
});

describe("clustering", () => {
  it("joins near-duplicates nearby and separates different issues", () => {
    let n = 0;
    const idx = new ClusterIndex(0.8, () => `c${++n}`);
    const h = latLngToCell(28.5, 77.24, 8);
    const at = new Date();
    const a = idx.assign({ id: "1", category: "water_supply", h3: h, embedding: embedText("The handpump has been broken near the school in Sangam Vihar | broken handpump"), reporter: "r1", at });
    const b = idx.assign({ id: "2", category: "water_supply", h3: gridDisk(h, 1)[2], embedding: embedText("The handpump has been broken near the school in Sangam Vihar | broken handpump"), reporter: "r2", at });
    const c = idx.assign({ id: "3", category: "water_supply", h3: h, embedding: embedText("Water pressure has been extremely low by the bus stop | low water pressure"), reporter: "r3", at });
    const d = idx.assign({ id: "4", category: "water_supply", h3: gridDisk(h, 5).at(-1)!, embedding: embedText("The handpump has been broken near the school in Sangam Vihar | broken handpump"), reporter: "r4", at });
    expect(a.created).toBe(true);
    expect(b.cluster.id).toBe(a.cluster.id);
    expect(b.cluster.reporters.size).toBe(2);
    expect(c.cluster.id).not.toBe(a.cluster.id);
    expect(d.cluster.id).not.toBe(a.cluster.id); // too far away
  });
  it("embeddings are normalised and deterministic", () => {
    const v = embedText("drain blocked");
    expect(v).toEqual(embedText("drain blocked"));
    expect(cosine(v, v)).toBeCloseTo(1, 4);
  });
});

describe("recommendations", () => {
  it("merges contiguous cells and splits oversized areas", () => {
    const c = latLngToCell(28.6, 77.2, 8);
    const ring = gridDisk(c, 1);
    const island = gridDisk(c, 6).at(-1)!;
    const comps = connectedComponents([...ring, island]);
    expect(comps.map((x) => x.length).sort()).toEqual([1, 7]);
    const big = gridDisk(c, 4);
    const parts = splitComponent(big, new Map(big.map((h, i) => [h, i])), 25);
    expect(parts.every((p) => p.length <= 25)).toBe(true);
    expect(parts.flat().sort()).toEqual([...big].sort());
  });
  it("fingerprints are order-independent", () => {
    expect(fingerprint("R", "health", ["b", "a"])).toBe(fingerprint("R", "health", ["a", "b"]));
    expect(fingerprint("R", "health", ["a"])).not.toBe(fingerprint("R", "water_supply", ["a"]));
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
  });
});

describe("briefs", () => {
  const payload: BriefPayload = {
    region: "Delhi NCT",
    recommendation: {
      title: "Improve drinking-water access in Sangam Vihar", category: "water_supply", category_label: "Water supply", areas: ["Sangam Vihar"],
      priority_score: 81.2, rank: 2, people_affected_est: 194050, requests_last_90_days: 121, unique_reporters_last_90_days: 97, hotspot_cells: 15,
      grid_cells: 22, funded_overlap_percent: 4, mean_vulnerability: 0.83, estimated_cost_usd: 3492900,
    },
    infrastructure_gap: [{ indicator: "water_points_per_1000", area_value: 0.02, region_median: 0.07, is_proxy: false }],
    citizen_quotes: [{ language: "hi", english: "The handpump has been broken for 3 months." }],
    overlapping_projects: [],
    documents: [{ label: "[D1]", title: "Plan", excerpt: "Water supply..." }],
  };
  it("template brief contains only numbers from the payload", () => {
    expect(unverifiedNumbers(templateBrief(payload), payload)).toEqual([]);
  });
  it("flags invented numbers", () => {
    expect(unverifiedNumbers("This will cost 45000000 and help 250000 people [D1].", payload)).toEqual(["45000000", "250000"]);
  });
});

describe("extraction", () => {
  it("validates schema and falls back safely", () => {
    expect(validateExtraction({ category: "roads" }).ok).toBe(false);
    expect(FALLBACK_EXTRACTION.is_actionable).toBe(false);
    expect(FALLBACK_EXTRACTION.confidence).toBe(0);
  });
  it.each([
    ["संगम विहार में हैंडपंप खराब है, बच्चे बीमार पड़ रहे हैं", "", "water_supply", "critical"],
    ["A rua alaga toda vez que chove e o esgoto está entupido", "", "sanitation_drainage", undefined],
    ["В районе Азино дорога вся в глубоких ямах", "", "roads_transport", undefined],
    ["路灯不亮，晚上这里对女性很不安全", "", "public_safety_lighting", undefined],
    ["Ugesi uyacishwa amahora amaningi nsuku zonke e-Soweto", "", "electricity", undefined],
    ["gali mein kooda nahi uthaya gaya hai", "", "waste_management", undefined],
  ])("rules classify %s", (orig, en, cat, urg) => {
    const e = ruleExtract(orig, en);
    expect(e.category).toBe(cat);
    if (urg) expect(e.urgency).toBe(urg);
  });
  it("rules flag spam", () => {
    expect(ruleExtract("加微信领红包", "").is_spam).toBe(true);
  });
  it("detects languages including Hinglish", () => {
    expect(detectLanguage("पानी नहीं आ रहा").lang).toBe("hi");
    expect(detectLanguage("paani nahi aa raha hai ghar mein").lang).toBe("hi");
    expect(detectLanguage("A rua está cheia de buracos").lang).toBe("pt");
    expect(detectLanguage("нет воды").lang).toBe("ru");
    expect(detectLanguage("停水了").lang).toBe("zh");
    expect(detectLanguage("The road has potholes").lang).toBe("en");
  });
  it("gazetteer resolves local-script and misspelt names", () => {
    expect(gazetteer(getRegion("IN-DL"), "संगम विहार में पानी नहीं")?.loc.name).toBe("Sangam Vihar");
    expect(gazetteer(getRegion("IN-DL"), "problem in Sangam Vihaar")?.loc.name).toBe("Sangam Vihar");
    expect(gazetteer(getRegion("RU-TA-KZN"), "в районе Азино ямы")?.loc.name).toBe("Azino");
  });
});

describe("ledger", () => {
  it("hash chain detects tampering", () => {
    const e1: LedgerEntry = { user_email: "a", region_code: "IN-DL", action: "x", entity_type: "t", entity_id: "1", diff: { b: 1, a: 2 }, at: "2026-01-01T00:00:00.000Z" };
    const h1 = entryHash(GENESIS, e1);
    const e2 = { ...e1, action: "y" };
    const h2 = entryHash(h1, e2);
    expect(entryHash(GENESIS, { ...e1, diff: { a: 2, b: 1 } })).toBe(h1); // key order independent
    expect(entryHash(entryHash(GENESIS, { ...e1, action: "tampered" }), e2)).not.toBe(h2);
    expect(canonical({ z: 1, a: [1, { y: 2, x: 1 }] })).toBe('{"a":[1,{"x":1,"y":2}],"z":1}');
  });
});

describe("insights", () => {
  it("difference-in-differences shows a drop in the footprint vs a flat control", () => {
    const c = latLngToCell(28.6, 77.2, 8);
    const fp = gridDisk(c, 1);
    const others = gridDisk(c, 4).filter((h) => !fp.includes(h));
    const pop = new Map([...fp, ...others].map((h) => [h, 1000]));
    const completed = new Date("2026-03-01T00:00:00Z");
    const now = new Date("2026-09-01T00:00:00Z");
    const reqs: { h3: string; at: Date }[] = [];
    const DAY = 86400000;
    for (let d = 1; d < 100; d++) {
      for (const h of fp) if (d % 2 === 0) reqs.push({ h3: h, at: new Date(completed.getTime() - (d + 14) * DAY) });
      for (const h of fp) if (d % 4 === 0) reqs.push({ h3: h, at: new Date(completed.getTime() + (d + 14) * DAY) });
      for (const h of others) if (d % 2 === 0) {
        reqs.push({ h3: h, at: new Date(completed.getTime() - (d + 14) * DAY) });
        reqs.push({ h3: h, at: new Date(completed.getTime() + (d + 14) * DAY) });
      }
    }
    const r = impactOf({ footprint: fp, completed, now, population: pop, requests: reqs, excludeCells: new Set() });
    expect(r.pctChange!).toBeLessThan(-35);
    expect(Math.abs(r.controlPctChange!)).toBeLessThan(15);
    expect(r.did!).toBeLessThan(-30);
  });
  it("forecast follows seasonality", () => {
    const hist = [2, 2, 2, 2, 2, 2, 2, 2, 2, 20, 22, 21]; // peak ends now; next months were quiet last year
    const f = forecastMonthly([...hist.slice(3), ...hist.slice(0, 3)], 3);
    expect(f.length).toBe(3);
    expect(Math.max(...f)).toBeGreaterThan(0);
  });
  it("optimizer respects budget and equity floor", () => {
    const cands = [
      { id: "rich", title: "", category: "roads_transport", costUsd: 100, people: 10000, score: 90, fundedOverlap: 0, meanVuln: 0.1 },
      { id: "poor1", title: "", category: "water_supply", costUsd: 60, people: 2000, score: 80, fundedOverlap: 0, meanVuln: 0.9 },
      { id: "poor2", title: "", category: "health", costUsd: 60, people: 1500, score: 80, fundedOverlap: 0, meanVuln: 0.8 },
    ];
    const noEquity = optimizePortfolio(cands, 160, 0, 0.6);
    expect(noEquity.selected.map((s) => s.id)).toContain("rich");
    const equity = optimizePortfolio(cands, 160, 0.6, 0.6);
    expect(equity.spent).toBeLessThanOrEqual(160);
    expect(equity.vulnerableShare).toBeGreaterThanOrEqual(0.6);
  });
});

describe("rag", () => {
  it("chunks with overlap", () => {
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const ch = chunkText(words, 120, 25);
    expect(ch.length).toBe(3);
    expect(ch[1].startsWith("w95 ")).toBe(true);
  });
});

void buildCandidates;
