import { CATEGORY_META, catLabel, type Category, type Precision, type Urgency } from "../categories";
import { generateBrief, type BriefPayload } from "../ai/brief";
import { config } from "../config";
import { bulkInsert, getDb, q, q1 } from "../db";
import { publish } from "../events";
import { retrieve } from "../rag";
import { getRegion } from "../regions";
import { buildCandidates, jaccard, type CandidateArea } from "./recommendations";
import { computeScores, DEFAULT_WEIGHTS, type Weights } from "./scoring";

export async function getWeights(region: string): Promise<Weights> {
  const row = await q1<{ value: Weights }>("SELECT value FROM settings WHERE region_code=$1 AND key='scoring'", [region]);
  return { ...DEFAULT_WEIGHTS, ...(row?.value ?? {}) };
}

export async function loadScoringInputs(region: string, now = new Date()) {
  const cells = await q<{ h3_cell: string; population: number; admin_name: string | null; vulnerability_index: number; connectivity_index: number }>(
    "SELECT h3_cell, population, admin_name, vulnerability_index, connectivity_index FROM h3_cells WHERE region_code=$1",
    [region],
  );
  const inds = await q<{ h3_cell: string; category: string; key: string; value: number; gap: number; is_proxy: boolean }>(
    "SELECT h3_cell, category, key, value, gap, is_proxy FROM cell_indicators WHERE region_code=$1",
    [region],
  );
  const reqs = await q<{
    category: string;
    h3_cell: string | null;
    admin_name: string | null;
    location_precision: Precision;
    urgency: Urgency;
    submitted_at: Date;
    reporter_id: string | null;
    cluster_id: string | null;
  }>(
    `SELECT category, h3_cell, admin_name, location_precision, urgency, submitted_at, reporter_id, cluster_id
       FROM requests
      WHERE region_code=$1 AND submitted_at > $2 AND is_actionable AND NOT is_spam
        AND pipeline_status='completed' AND status <> 'rejected'`,
    [region, new Date(now.getTime() - 91 * 86400000)],
  );
  const projects = await q<{ id: string; title: string; category: string; status: string; h3_cells: string[]; budget_amount: number; currency: string }>(
    "SELECT id, title, category, status, h3_cells, budget_amount, currency FROM planned_projects WHERE region_code=$1",
    [region],
  );
  const gaps = new Map<string, Map<string, number>>();
  const indicators = new Map<string, Map<string, { key: string; value: number; isProxy: boolean }>>();
  for (const i of inds) {
    if (!gaps.has(i.category)) gaps.set(i.category, new Map());
    // Several indicators per category could exist; keep the worst gap.
    const g = gaps.get(i.category)!;
    g.set(i.h3_cell, Math.max(g.get(i.h3_cell) ?? 0, i.gap));
    if (!indicators.has(i.category)) indicators.set(i.category, new Map());
    indicators.get(i.category)!.set(i.h3_cell, { key: i.key, value: i.value, isProxy: i.is_proxy });
  }
  return { cells, gaps, indicators, reqs, projects };
}

/** Full recompute for one region: scores + hotspots + recommendations (+ briefs for the top N). */
export async function recomputeRegion(region: string, opts: { briefsTopN?: number; useLLM?: boolean; now?: Date } = {}) {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const db = await getDb();
  const [{ id: jobId }] = await db.query<{ id: number }>("INSERT INTO job_runs (name, region_code) VALUES ('recompute', $1) RETURNING id::int AS id", [region]);
  try {
    const weights = await getWeights(region);
    const { cells, gaps, indicators, reqs, projects } = await loadScoringInputs(region, now);
    const cellIn = cells.map((c) => ({ h3: c.h3_cell, population: c.population, vuln: c.vulnerability_index, conn: c.connectivity_index, admin: c.admin_name }));
    const { scores, insufficient } = computeScores({
      cells: cellIn,
      gaps,
      requests: reqs.map((r) => ({
        category: r.category,
        h3: r.h3_cell,
        admin: r.admin_name,
        precision: r.location_precision,
        urgency: r.urgency,
        submittedAt: new Date(r.submitted_at),
        reporterId: r.reporter_id,
        clusterId: r.cluster_id,
      })),
      projects: projects.map((p) => ({ category: p.category, status: p.status, cells: p.h3_cells })),
      weights,
      now,
      minRequests: config.hotspotMinRequests,
      regionCode: region,
    });
    const t1 = Date.now();

    await db.tx(async (t) => {
      await t.query("DELETE FROM cell_scores WHERE region_code=$1", [region]);
      await bulkInsert(
        t,
        "cell_scores",
        ["region_code", "h3_cell", "category", "computed_at", "demand_raw", "demand_adj", "d_norm", "g_norm", "p_norm", "v_norm", "f_coverage", "priority_score", "gi_z", "gi_p", "is_hotspot", "request_count_90d", "unique_reporters_90d", "no_signal", "trend_ratio", "is_emerging"],
        scores.map((s) => [region, s.h3, s.category, now, r4(s.demandRaw), r4(s.demandAdj), r4(s.D), r4(s.G), r4(s.P), r4(s.V), s.F, r4(s.score), s.giZ === null ? null : r4(s.giZ), s.giP === null ? null : r4(s.giP), s.isHotspot, s.count90, s.reporters90, s.noSignal, s.trendRatio === null ? null : r4(s.trendRatio), s.isEmerging]),
      );
    });
    const t2 = Date.now();

    const candidates = buildCandidates({
      regionCode: region,
      cells: cells.map((c) => ({ h3: c.h3_cell, population: c.population, admin: c.admin_name, vuln: c.vulnerability_index })),
      scores,
      indicators,
    });
    const recCount = await upsertRecommendations(region, candidates, projects);
    const t3 = Date.now();
    let briefs = 0;
    if (opts.briefsTopN) briefs = await ensureBriefs(region, opts.briefsTopN, opts.useLLM ?? true);

    const detail = {
      cells: cells.length,
      scores: scores.length,
      hotspots: scores.filter((s) => s.isHotspot).length,
      emerging: scores.filter((s) => s.isEmerging).length,
      recommendations: recCount,
      briefs,
      insufficient,
      ms: { score: t1 - t0, write: t2 - t1, recs: t3 - t2, total: Date.now() - t0 },
    };
    await db.query("UPDATE job_runs SET finished_at=now(), status='ok', detail=$2::jsonb WHERE id=$1", [jobId, JSON.stringify(detail)]);
    await publish({ type: "scores", region, at: new Date().toISOString() });
    return detail;
  } catch (e) {
    await db.query("UPDATE job_runs SET finished_at=now(), status='failed', detail=$2::jsonb WHERE id=$1", [jobId, JSON.stringify({ error: String(e) })]);
    throw e;
  }
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const URG_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

async function upsertRecommendations(
  region: string,
  cands: CandidateArea[],
  projects: { id: string; title: string; category: string; status: string; h3_cells: string[]; budget_amount: number; currency: string }[],
): Promise<number> {
  const db = await getDb();
  const existing = await db.query<{ id: string; category: string; h3_cells: string[]; status: string; fingerprint: string; is_active: boolean }>(
    "SELECT id, category, h3_cells, status, fingerprint, is_active FROM recommendations WHERE region_code=$1",
    [region],
  );
  const byFp = new Map(existing.map((e) => [e.fingerprint, e]));
  const used = new Set<string>();
  const since = new Date(Date.now() - 90 * 86400000);

  for (const c of cands) {
    let match = byFp.get(c.fingerprint);
    if (!match || used.has(match.id)) {
      let best: (typeof existing)[number] | undefined;
      let bestJ = 0.4;
      for (const e of existing) {
        if (used.has(e.id) || e.category !== c.category) continue;
        const j = jaccard(e.h3_cells, c.cells);
        if (j >= bestJ) {
          bestJ = j;
          best = e;
        }
      }
      match = best;
    }
    // Quotes: highest-urgency recent requests in the area (redacted text only).
    const qs = await db.query<{ id: string; language_detected: string; text_original_redacted: string; text_english_redacted: string; urgency: string; submitted_at: Date }>(
      `SELECT id, language_detected, text_original_redacted, text_english_redacted, urgency, submitted_at
         FROM requests WHERE region_code=$1 AND category=$2 AND h3_cell = ANY($3::text[]) AND submitted_at > $4
          AND is_actionable AND NOT is_spam ORDER BY submitted_at DESC LIMIT 60`,
      [region, c.category, c.cells, since],
    );
    const quotes = qs
      .sort((a, b) => (URG_RANK[b.urgency] ?? 0) - (URG_RANK[a.urgency] ?? 0))
      .filter((x, i, arr) => arr.findIndex((y) => y.text_english_redacted === x.text_english_redacted) === i)
      .slice(0, 3)
      .map((x) => ({ id: x.id, language: x.language_detected, original: x.text_original_redacted, english: x.text_english_redacted, urgency: x.urgency, at: x.submitted_at }));
    const cellSet = new Set(c.cells);
    const overlapping = projects
      .filter((p) => p.category === c.category && p.h3_cells.some((h) => cellSet.has(h)))
      .map((p) => ({ id: p.id, title: p.title, status: p.status, budget: p.budget_amount, currency: p.currency }));

    const values = [
      c.title, c.cells, c.admins, c.centerLat, c.centerLng, c.score, c.people, c.requestCount, c.uniqueReporters, c.hotspotCells,
      JSON.stringify(c.gapSummary), c.fundedOverlap, JSON.stringify(overlapping), JSON.stringify(quotes), c.estCostUsd, c.fingerprint,
    ];
    if (match) {
      used.add(match.id);
      await db.query(
        `UPDATE recommendations SET title=$2, h3_cells=$3, admin_names=$4, center_lat=$5, center_lng=$6, priority_score=$7,
           people_affected_est=$8, request_count=$9, unique_reporters=$10, hotspot_cells=$11, gap_summary=$12::jsonb,
           funded_overlap=$13, overlapping_projects=$14::jsonb, quotes=$15::jsonb, est_cost_usd=$16, fingerprint=$17,
           is_active=true, updated_at=now() WHERE id=$1`,
        [match.id, ...values],
      );
    } else {
      const [row] = await db.query<{ id: string }>(
        `INSERT INTO recommendations (region_code, category, title, h3_cells, admin_names, center_lat, center_lng, priority_score,
           people_affected_est, request_count, unique_reporters, hotspot_cells, gap_summary, funded_overlap, overlapping_projects, quotes,
           est_cost_usd, fingerprint)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17,$18)
         ON CONFLICT (fingerprint) DO NOTHING RETURNING id`,
        [region, c.category, ...values],
      );
      if (row) used.add(row.id);
    }
  }
  // Proposed recommendations that no longer match any candidate are retired; decided ones are kept.
  const stale = existing.filter((e) => !used.has(e.id) && e.status === "proposed").map((e) => e.id);
  if (stale.length) await db.query("UPDATE recommendations SET is_active=false WHERE id = ANY($1::uuid[])", [stale]);
  await db.query(
    `UPDATE recommendations r SET rank = s.rn FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY priority_score DESC) AS rn FROM recommendations WHERE region_code=$1 AND is_active
     ) s WHERE r.id = s.id`,
    [region],
  );
  return used.size;
}

export async function buildBriefPayload(recId: string): Promise<{ payload: BriefPayload; citations: object[] } | null> {
  const rec = await q1<{
    id: string; region_code: string; category: string; title: string; admin_names: string[]; priority_score: number; rank: number;
    people_affected_est: number; request_count: number; unique_reporters: number; hotspot_cells: number; h3_cells: string[];
    funded_overlap: number; gap_summary: Record<string, { area: number; regionMedian: number; isProxy: boolean }>;
    quotes: { language: string; english: string }[]; overlapping_projects: { title: string; status: string; budget: number; currency: string }[];
    est_cost_usd: number;
  }>("SELECT * FROM recommendations WHERE id=$1", [recId]);
  if (!rec) return null;
  const region = getRegion(rec.region_code);
  const vuln = await q1<{ v: number }>(
    "SELECT avg(vulnerability_index) AS v FROM h3_cells WHERE region_code=$1 AND h3_cell = ANY($2::text[])",
    [rec.region_code, rec.h3_cells],
  );
  const label = catLabel(rec.category);
  const gapKey = Object.keys(rec.gap_summary)[0];
  const docs = await retrieve(rec.region_code, `${label} ${CATEGORY_META[rec.category as Category]?.action ?? ""} ${rec.admin_names.join(" ")} ${gapKey ?? ""} budget plan`, 5);
  const fmtBudget = (b: number, cur: string) => `${cur} ${Math.round(b).toLocaleString("en-US")}`;
  const payload: BriefPayload = {
    region: region.name,
    recommendation: {
      title: rec.title,
      category: rec.category,
      category_label: label,
      areas: rec.admin_names,
      priority_score: Math.round(rec.priority_score * 10) / 10,
      rank: rec.rank,
      people_affected_est: rec.people_affected_est,
      requests_last_90_days: rec.request_count,
      unique_reporters_last_90_days: rec.unique_reporters,
      hotspot_cells: rec.hotspot_cells,
      grid_cells: rec.h3_cells.length,
      funded_overlap_percent: Math.round(rec.funded_overlap * 100),
      mean_vulnerability: Math.round((vuln?.v ?? 0) * 100) / 100,
      estimated_cost_usd: Math.round(rec.est_cost_usd),
    },
    infrastructure_gap: Object.entries(rec.gap_summary).map(([k, v]) => ({ indicator: k, area_value: v.area, region_median: v.regionMedian, is_proxy: v.isProxy })),
    citizen_quotes: rec.quotes.map((x) => ({ language: x.language, english: x.english })),
    overlapping_projects: rec.overlapping_projects.map((p) => ({ title: p.title, status: p.status, budget: fmtBudget(p.budget, p.currency) })),
    documents: docs.map((d) => ({ label: d.label, title: d.title, excerpt: d.text.slice(0, 500) })),
  };
  const citations = docs.map((d) => ({ label: d.label, document_id: d.documentId, title: d.title, chunk_index: d.chunkIndex, score: d.score, excerpt: d.text.slice(0, 300) }));
  return { payload, citations };
}

export async function generateAndStoreBrief(recId: string, useLLM = true) {
  const built = await buildBriefPayload(recId);
  if (!built) return null;
  const { markdown, model, promptVersion, unverified } = useLLM
    ? await generateBrief(built.payload)
    : await (async () => {
        const { templateBrief, unverifiedNumbers } = await import("../ai/brief");
        const md = templateBrief(built.payload);
        return { markdown: md, model: "template (offline)", promptVersion: "template_v1", unverified: unverifiedNumbers(md, built.payload) };
      })();
  const [row] = await q<{ id: string; version: number }>(
    `INSERT INTO policy_briefs (recommendation_id, version, content_md, citations, model_name, prompt_version, validation_warning, unverified_numbers)
     VALUES ($1, COALESCE((SELECT max(version) FROM policy_briefs WHERE recommendation_id=$1),0)+1, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING id, version`,
    [recId, markdown, JSON.stringify(built.citations), model, promptVersion, unverified.length > 0, unverified],
  );
  return { ...row, model, validation_warning: unverified.length > 0, unverified };
}

async function ensureBriefs(region: string, topN: number, useLLM: boolean): Promise<number> {
  const recs = await q<{ id: string }>(
    `SELECT r.id FROM recommendations r
      WHERE r.region_code=$1 AND r.is_active AND NOT EXISTS (SELECT 1 FROM policy_briefs b WHERE b.recommendation_id=r.id)
      ORDER BY r.rank LIMIT $2`,
    [region, topN],
  );
  for (const r of recs) await generateAndStoreBrief(r.id, useLLM);
  return recs.length;
}
