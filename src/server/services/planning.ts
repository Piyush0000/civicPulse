import { createHmac } from "node:crypto";
import { ApiError } from "@/lib/api";
import type { Session } from "@/lib/auth";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { generateAndStoreBrief, getWeights, loadScoringInputs, recomputeRegion } from "@/lib/analytics/engine";
import { forecastMonthly, impactOf, optimizePortfolio, type OptCandidate } from "@/lib/analytics/insights";
import { buildCandidates } from "@/lib/analytics/recommendations";
import { computeScores, validateWeights, type Weights } from "@/lib/analytics/scoring";
import { config } from "@/lib/config";
import { getDb, q, q1 } from "@/lib/db";
import { publish } from "@/lib/events";
import { appendAudit } from "@/lib/ledger";
import { getRegion, REGIONS } from "@/lib/regions";
import { sendTelegram } from "@/lib/messaging/telegram";
import { decrypt } from "@/lib/privacy";

const DAY = 86400000;

// ---------------------------------------------------------------- recommendations

export async function listRecommendations(region: string, f: { category?: string | null; status?: string | null; all?: boolean }) {
  const where = ["region_code=$1"];
  const params: unknown[] = [region];
  if (!f.all) where.push("is_active");
  if (f.category) {
    params.push(f.category);
    where.push(`category=$${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`status=$${params.length}`);
  }
  return q(
    `SELECT id, title, category, admin_names, priority_score, rank, people_affected_est, request_count, unique_reporters, hotspot_cells,
            funded_overlap, est_cost_usd, status, decided_by, decided_at, center_lat, center_lng, cardinality(h3_cells) cells, is_active,
            (SELECT count(*)::int FROM policy_briefs b WHERE b.recommendation_id = r.id) briefs
       FROM recommendations r WHERE ${where.join(" AND ")} ORDER BY is_active DESC, rank`,
    params,
  );
}

export async function recommendationDetail(region: string, id: string) {
  const rec = await q1<Record<string, unknown> & { h3_cells: string[] }>("SELECT * FROM recommendations WHERE id=$1 AND region_code=$2", [id, region]);
  if (!rec) throw new ApiError(404, "not_found", "Recommendation not found");
  const cells = await q(
    `SELECT s.h3_cell, s.priority_score, s.d_norm, s.g_norm, s.p_norm, s.v_norm, s.f_coverage, s.is_hotspot, s.gi_z, s.request_count_90d,
            c.population, c.vulnerability_index, c.connectivity_index, c.admin_name
       FROM cell_scores s JOIN h3_cells c USING (region_code, h3_cell)
      WHERE s.region_code=$1 AND s.category=$2 AND s.h3_cell = ANY($3::text[])`,
    [region, rec.category, rec.h3_cells],
  );
  const brief = await q1(
    "SELECT id, version, content_md, citations, model_name, prompt_version, validation_warning, unverified_numbers, generated_at FROM policy_briefs WHERE recommendation_id=$1 ORDER BY version DESC LIMIT 1",
    [id],
  );
  const monthly = await q<{ m: Date; n: number }>(
    `SELECT date_trunc('month', submitted_at) m, count(*)::int n FROM requests
      WHERE region_code=$1 AND category=$2 AND h3_cell = ANY($3::text[]) AND is_actionable GROUP BY 1 ORDER BY 1`,
    [region, rec.category, rec.h3_cells],
  );
  const languages = await q<{ k: string; n: number }>(
    `SELECT language_detected k, count(*)::int n FROM requests WHERE region_code=$1 AND category=$2 AND h3_cell = ANY($3::text[]) GROUP BY 1 ORDER BY 2 DESC`,
    [region, rec.category, rec.h3_cells],
  );
  const history = await q(
    "SELECT seq, user_email, action, diff, at, hash FROM audit_log WHERE entity_type='recommendation' AND entity_id=$1 ORDER BY seq DESC",
    [id],
  );
  return { ...rec, cellsDetail: cells, brief, monthly, languages, history };
}

export async function decideRecommendation(region: string, id: string, body: { status?: string; note?: string }, s: Session) {
  const status = String(body.status || "");
  if (!["accepted", "rejected", "deferred", "proposed"].includes(status)) throw new ApiError(400, "bad_status", "status must be accepted|rejected|deferred|proposed");
  const rec = await q1<{ status: string; title: string; h3_cells: string[]; category: string }>(
    "SELECT status, title, h3_cells, category FROM recommendations WHERE id=$1 AND region_code=$2",
    [id, region],
  );
  if (!rec) throw new ApiError(404, "not_found", "Recommendation not found");
  const note = String(body.note || "").slice(0, 1000);
  const db = await getDb();
  const ledger = await db.tx(async (t) => {
    await t.query(
      "UPDATE recommendations SET status=$2, decision_note=$3, decided_by=$4, decided_at=now(), updated_at=now() WHERE id=$1",
      [id, status, note, s.email],
    );
    if (status === "accepted")
      await t.query(
        `UPDATE requests SET status='linked_to_project' WHERE region_code=$1 AND category=$2 AND h3_cell = ANY($3::text[])
            AND status IN ('new','under_review') AND is_actionable`,
        [region, rec.category, rec.h3_cells],
      );
    return appendAudit(
      { user_id: s.sub, user_email: s.email, region_code: region, action: `recommendation.${status}`, entity_type: "recommendation", entity_id: id, diff: { from: rec.status, to: status, note, title: rec.title } },
      t,
    );
  });
  await publish({ type: "decision", region, id, status, title: rec.title, at: new Date().toISOString() });
  if (status === "accepted") void notifyReporters(region, rec.category, rec.h3_cells, rec.title);
  return { ok: true, ledger };
}

/** Close the loop: tell citizens (who left a reply channel) that their issue is now part of a project. */
async function notifyReporters(region: string, category: string, cells: string[], title: string) {
  const rows = await q<{ tracking_code: string; external_id_encrypted: string; channel: string }>(
    `SELECT DISTINCT ON (c.reporter_id) r.tracking_code, c.external_id_encrypted, c.channel
       FROM requests r JOIN reporter_contacts c ON c.reporter_id = r.reporter_id
      WHERE r.region_code=$1 AND r.category=$2 AND r.h3_cell = ANY($3::text[]) AND NOT r.is_synthetic`,
    [region, category, cells],
  );
  for (const r of rows) {
    if (r.channel !== "telegram") continue;
    try {
      await sendTelegram(decrypt(r.external_id_encrypted), `✅ Update on ${r.tracking_code}: your report is now linked to an accepted project: "${title}". Thank you for speaking up.`);
    } catch {
      /* ignore */
    }
  }
}

export async function regenerateBrief(region: string, id: string, s: Session) {
  const rec = await q1("SELECT id FROM recommendations WHERE id=$1 AND region_code=$2", [id, region]);
  if (!rec) throw new ApiError(404, "not_found", "Recommendation not found");
  const b = await generateAndStoreBrief(id, true);
  await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "brief.regenerate", entity_type: "recommendation", entity_id: id, diff: { version: b?.version, model: b?.model } });
  return b;
}

// ---------------------------------------------------------------- budget alignment

export async function budgetAlignment(region: string) {
  const reg = getRegion(region);
  const demand = await q<{ category: string; d: number; people: number }>(
    "SELECT category, sum(demand_adj)::float8 d, 0 people FROM cell_scores WHERE region_code=$1 GROUP BY 1",
    [region],
  );
  const spend = await q<{ category: string; b: number; n: number }>(
    `SELECT category, sum(budget_amount)::float8 b, count(*)::int n FROM planned_projects
      WHERE region_code=$1 AND status IN ('planned','approved','in_progress') GROUP BY 1`,
    [region],
  );
  const dTot = demand.reduce((a, x) => a + x.d, 0) || 1;
  const bTot = spend.reduce((a, x) => a + x.b, 0) || 1;
  const byCategory = CATEGORIES.filter((c) => c !== "other").map((c) => {
    const d = demand.find((x) => x.category === c)?.d ?? 0;
    const b = spend.find((x) => x.category === c)?.b ?? 0;
    return {
      category: c,
      demandShare: round(d / dTot),
      investmentShare: round(b / bTot),
      gap: round(d / dTot - b / bTot),
      budget: Math.round(b),
      budgetUsd: Math.round(b * reg.usdRate),
      projects: spend.find((x) => x.category === c)?.n ?? 0,
    };
  });
  // Per area (locality): demand share vs investment share, bubble = population.
  const areaDemand = await q<{ admin: string; d: number; pop: number }>(
    `SELECT c.admin_name admin, sum(s.demand_adj)::float8 d, (SELECT sum(population) FROM h3_cells h WHERE h.region_code=$1 AND h.admin_name=c.admin_name)::float8 pop
       FROM cell_scores s JOIN h3_cells c USING (region_code, h3_cell) WHERE s.region_code=$1 GROUP BY c.admin_name`,
    [region],
  );
  const areaSpend = await q<{ admin: string; b: number }>(
    `SELECT admin_name admin, sum(budget_amount)::float8 b FROM planned_projects WHERE region_code=$1 AND status IN ('planned','approved','in_progress') GROUP BY 1`,
    [region],
  );
  const adTot = areaDemand.reduce((a, x) => a + x.d, 0) || 1;
  const byArea = areaDemand
    .map((a) => {
      const b = areaSpend.find((x) => x.admin === a.admin)?.b ?? 0;
      return { area: a.admin, demandShare: round(a.d / adTot), investmentShare: round(b / bTot), population: Math.round(a.pop), budget: Math.round(b) };
    })
    .sort((a, b) => b.demandShare - a.demandShare);
  return { currency: reg.currency, usdRate: reg.usdRate, totalBudget: Math.round(bTot), byCategory, byArea };
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------- impact

export async function impactProjects(region: string) {
  const projects = await q<{ id: string; title: string; category: string; completed_date: string | Date; h3_cells: string[]; budget_amount: number; currency: string; admin_name: string }>(
    "SELECT id, title, category, completed_date, h3_cells, budget_amount, currency, admin_name FROM planned_projects WHERE region_code=$1 AND status='completed' ORDER BY completed_date",
    [region],
  );
  const pops = new Map(
    (await q<{ h3_cell: string; population: number }>("SELECT h3_cell, population FROM h3_cells WHERE region_code=$1", [region])).map((r) => [r.h3_cell, r.population]),
  );
  const out = [];
  for (const p of projects) {
    const reqs = await q<{ h3_cell: string; submitted_at: Date }>(
      "SELECT h3_cell, submitted_at FROM requests WHERE region_code=$1 AND category=$2 AND h3_cell IS NOT NULL AND is_actionable",
      [region, p.category],
    );
    const exclude = new Set(
      (await q<{ h3_cells: string[] }>("SELECT h3_cells FROM planned_projects WHERE region_code=$1 AND category=$2 AND id<>$3", [region, p.category, p.id])).flatMap((x) => x.h3_cells),
    );
    const res = impactOf({
      footprint: p.h3_cells,
      completed: new Date(p.completed_date),
      now: new Date(),
      population: pops,
      requests: reqs.map((r) => ({ h3: r.h3_cell, at: new Date(r.submitted_at) })),
      excludeCells: exclude,
    });
    out.push({ ...p, h3_cells: undefined, cells: p.h3_cells.length, impact: res });
  }
  return out;
}

export async function platformMetrics(region: string) {
  const channels = await q<{ k: string; n: number }>("SELECT channel k, count(*)::int n FROM requests WHERE region_code=$1 GROUP BY 1 ORDER BY 2 DESC", [region]);
  const langs = await q<{ k: string; n: number }>("SELECT language_detected k, count(*)::int n FROM requests WHERE region_code=$1 GROUP BY 1 ORDER BY 2 DESC", [region]);
  const m = await q1<{ voice: number; total: number; geocoded: number; actionable: number; accepted: number; decided: number; median_s: number | null; reporters: number }>(
    `SELECT count(*) FILTER (WHERE input_mode='voice')::int voice, count(*)::int total,
            count(*) FILTER (WHERE h3_cell IS NOT NULL AND is_actionable)::int geocoded, count(*) FILTER (WHERE is_actionable)::int actionable,
            (SELECT count(*)::int FROM recommendations WHERE region_code=$1 AND status='accepted') accepted,
            (SELECT count(*)::int FROM recommendations WHERE region_code=$1 AND status<>'proposed') decided,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM processed_at - submitted_at)) FILTER (WHERE NOT is_synthetic) median_s,
            count(DISTINCT reporter_id)::int reporters
       FROM requests WHERE region_code=$1`,
    [region],
  );
  return { channels, languages: langs, ...m };
}

// ---------------------------------------------------------------- forecast (predictive hotspots)

export async function forecast(region: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const rows = await q<{ m: Date; category: string; n: number }>(
    `SELECT date_trunc('month', submitted_at) m, category, count(*)::int n FROM requests
      WHERE region_code=$1 AND is_actionable AND submitted_at >= $2 GROUP BY 1,2`,
    [region, start],
  );
  const months: string[] = [];
  for (let i = 0; i < 12; i++) months.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const future: string[] = [];
  for (let i = 1; i <= 3; i++) future.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const series = CATEGORIES.filter((c) => c !== "other").map((c) => {
    const hist = months.map((mm) => rows.filter((r) => r.category === c && new Date(r.m).toISOString().slice(0, 7) === mm).reduce((a, r) => a + r.n, 0));
    const fc = forecastMonthly(hist, 3);
    const recent = (hist[9] + hist[10] + hist[11]) / 3 || 0.5;
    const next = fc.reduce((a, b) => a + b, 0) / 3;
    return { category: c, history: hist, forecast: fc, changePct: Math.round(((next - recent) / recent) * 100) };
  });
  const emerging = await q(
    `SELECT s.category, s.h3_cell, c.admin_name, s.request_count_90d, s.trend_ratio, s.priority_score
       FROM cell_scores s JOIN h3_cells c USING (region_code, h3_cell)
      WHERE s.region_code=$1 AND s.is_emerging ORDER BY s.trend_ratio DESC NULLS LAST LIMIT 40`,
    [region],
  );
  // Group emerging cells by category + area
  const groups = new Map<string, { category: string; area: string; cells: number; requests: number; maxTrend: number }>();
  for (const e of emerging as { category: string; admin_name: string; request_count_90d: number; trend_ratio: number }[]) {
    const k = `${e.category}|${e.admin_name}`;
    const g = groups.get(k) ?? { category: e.category, area: e.admin_name, cells: 0, requests: 0, maxTrend: 0 };
    g.cells++;
    g.requests += e.request_count_90d;
    g.maxTrend = Math.max(g.maxTrend, e.trend_ratio ?? 0);
    groups.set(k, g);
  }
  return { months, future, series, emerging: [...groups.values()].sort((a, b) => b.maxTrend - a.maxTrend) };
}

// ---------------------------------------------------------------- budget optimizer

export async function optimize(region: string, budgetUsd: number, equityShare: number) {
  const reg = getRegion(region);
  const recs = await q<{ id: string; title: string; category: string; est_cost_usd: number; people_affected_est: number; priority_score: number; funded_overlap: number; h3_cells: string[]; status: string; admin_names: string[] }>(
    "SELECT id, title, category, est_cost_usd, people_affected_est, priority_score, funded_overlap, h3_cells, status, admin_names FROM recommendations WHERE region_code=$1 AND is_active AND status <> 'rejected'",
    [region],
  );
  const cellRows = await q<{ h3_cell: string; vulnerability_index: number; population: number }>(
    "SELECT h3_cell, vulnerability_index, population FROM h3_cells WHERE region_code=$1",
    [region],
  );
  const vuln = new Map(cellRows.map((c) => [c.h3_cell, c.vulnerability_index]));
  const vulns = cellRows.map((c) => c.vulnerability_index).sort((a, b) => a - b);
  const p75 = vulns[Math.floor(vulns.length * 0.75)] ?? 0.6;
  const cands: OptCandidate[] = recs.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    costUsd: r.est_cost_usd,
    people: r.people_affected_est,
    score: r.priority_score,
    fundedOverlap: r.funded_overlap,
    meanVuln: r.h3_cells.reduce((a, h) => a + (vuln.get(h) ?? 0), 0) / Math.max(1, r.h3_cells.length),
  }));
  const res = optimizePortfolio(cands, budgetUsd, equityShare, p75);

  // Compare with the current plan: need-weighted people reached per US$1M.
  const scores = await q<{ h3_cell: string; category: string; d_norm: number }>("SELECT h3_cell, category, d_norm FROM cell_scores WHERE region_code=$1", [region]);
  const dmap = new Map(scores.map((s) => [`${s.category}|${s.h3_cell}`, s.d_norm]));
  const pop = new Map(cellRows.map((c) => [c.h3_cell, c.population]));
  const plan = await q<{ category: string; budget_amount: number; h3_cells: string[] }>(
    "SELECT category, budget_amount, h3_cells FROM planned_projects WHERE region_code=$1 AND status IN ('planned','approved','in_progress')",
    [region],
  );
  let planNeedPeople = 0,
    planSpend = 0;
  for (const p of plan) {
    planSpend += p.budget_amount * reg.usdRate;
    const share = CATEGORY_META[p.category as Category]?.peopleShare ?? 1;
    for (const h of p.h3_cells) planNeedPeople += (pop.get(h) ?? 0) * share * (dmap.get(`${p.category}|${h}`) ?? 0);
  }
  let optNeedPeople = 0;
  for (const s of res.selected) {
    const r = recs.find((x) => x.id === s.id)!;
    const share = CATEGORY_META[r.category as Category]?.peopleShare ?? 1;
    for (const h of r.h3_cells) optNeedPeople += (pop.get(h) ?? 0) * share * (dmap.get(`${r.category}|${h}`) ?? 0);
  }
  const perM = (x: number, spend: number) => (spend > 0 ? Math.round((x / spend) * 1e6) : 0);
  return {
    budgetUsd,
    equityShare,
    vulnerabilityThreshold: Math.round(p75 * 100) / 100,
    selected: res.selected.map((s) => ({ ...s, admin_names: recs.find((r) => r.id === s.id)?.admin_names })),
    spentUsd: Math.round(res.spent),
    people: res.people,
    vulnerableShare: Math.round(res.vulnerableShare * 100) / 100,
    candidates: cands.length,
    comparison: {
      optimizer: { spendUsd: Math.round(res.spent), needWeightedPeople: Math.round(optNeedPeople), perMillion: perM(optNeedPeople, res.spent) },
      currentPlan: { spendUsd: Math.round(planSpend), needWeightedPeople: Math.round(planNeedPeople), perMillion: perM(planNeedPeople, planSpend) },
    },
  };
}

// ---------------------------------------------------------------- scoring settings (+ live preview)

export async function saveWeights(region: string, w: Weights, s: Session) {
  const err = validateWeights(w);
  if (err) throw new ApiError(400, "bad_weights", err);
  const before = await getWeights(region);
  await q(
    `INSERT INTO settings (region_code, key, value) VALUES ($1,'scoring',$2::jsonb)
     ON CONFLICT (region_code, key) DO UPDATE SET value=EXCLUDED.value`,
    [region, JSON.stringify(w)],
  );
  await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "settings.scoring", entity_type: "settings", entity_id: region, diff: { from: before, to: w } });
  return recomputeRegion(region, { briefsTopN: 5, useLLM: false });
}

/** Rank recommendations under candidate weights without persisting anything. */
export async function previewWeights(region: string, w: Weights) {
  const err = validateWeights(w);
  if (err) throw new ApiError(400, "bad_weights", err);
  const { cells, gaps, indicators, reqs, projects } = await loadScoringInputs(region);
  const { scores } = computeScores({
    cells: cells.map((c) => ({ h3: c.h3_cell, population: c.population, vuln: c.vulnerability_index, conn: c.connectivity_index, admin: c.admin_name })),
    gaps,
    requests: reqs.map((r) => ({ category: r.category, h3: r.h3_cell, admin: r.admin_name, precision: r.location_precision, urgency: r.urgency, submittedAt: new Date(r.submitted_at), reporterId: r.reporter_id, clusterId: r.cluster_id })),
    projects: projects.map((p) => ({ category: p.category, status: p.status, cells: p.h3_cells })),
    weights: w,
    now: new Date(),
    minRequests: config.hotspotMinRequests,
    permutations: 0,
    regionCode: region,
  });
  const cands = buildCandidates({
    regionCode: region,
    cells: cells.map((c) => ({ h3: c.h3_cell, population: c.population, admin: c.admin_name, vuln: c.vulnerability_index })),
    scores,
    indicators,
  });
  return cands.slice(0, 10).map((c, i) => ({ rank: i + 1, title: c.title, category: c.category, score: c.score, people: c.people }));
}

// ---------------------------------------------------------------- BRICS federation (aggregate-only)

/** k-anonymous aggregate that a national instance could publish to peers. HMAC-signed. */
export async function federationAggregate(region: string) {
  const reg = getRegion(region);
  const cats = await q<{ category: string; requests: number; reporters: number; hotspots: number }>(
    `SELECT s.category, sum(s.request_count_90d)::int requests, sum(s.unique_reporters_90d)::int reporters, count(*) FILTER (WHERE s.is_hotspot)::int hotspots
       FROM cell_scores s WHERE s.region_code=$1 GROUP BY 1`,
    [region],
  );
  const pop = await q1<{ p: number }>("SELECT sum(population)::float8 p FROM h3_cells WHERE region_code=$1", [region]);
  const budget = await budgetAlignment(region);
  const decisions = await q<{ status: string; n: number }>("SELECT status, count(*)::int n FROM recommendations WHERE region_code=$1 AND is_active GROUP BY 1", [region]);
  const langs = await q<{ k: string; n: number }>("SELECT language_detected k, count(*)::int n FROM requests WHERE region_code=$1 GROUP BY 1", [region]);
  const impact = await impactProjects(region);
  const body = {
    schema: "civicpulse.federation.v1",
    region: { code: reg.code, name: reg.name, country: reg.country, flag: reg.flag },
    generatedAt: new Date().toISOString(),
    kAnonymity: config.kAnonThreshold,
    population: Math.round(pop?.p ?? 0),
    categories: cats
      .filter((c) => c.reporters >= config.kAnonThreshold)
      .map((c) => ({
        ...c,
        per100k: Math.round((c.requests / Math.max(1, pop?.p ?? 1)) * 1e5 * 10) / 10,
        demandShare: budget.byCategory.find((b) => b.category === c.category)?.demandShare ?? 0,
        investmentShare: budget.byCategory.find((b) => b.category === c.category)?.investmentShare ?? 0,
      })),
    budgetUsd: Math.round(budget.totalBudget * reg.usdRate),
    misalignment: Math.round(budget.byCategory.reduce((a, b) => a + Math.abs(b.gap), 0) * 50) / 100, // 0..1 (half the L1 distance)
    decisions: Object.fromEntries(decisions.map((d) => [d.status, d.n])),
    languages: Object.fromEntries(langs.map((l) => [l.k, l.n])),
    impact: impact
      .filter((p) => p.impact.pctChange !== null)
      .map((p) => ({ category: p.category, pctChange: p.impact.pctChange, did: p.impact.did })),
  };
  const signature = createHmac("sha256", config.secretKey).update(JSON.stringify(body)).digest("hex");
  return { ...body, signature: { alg: "HMAC-SHA256", value: signature, note: "Demo signing key; production instances would use per-country Ed25519 keys." } };
}

export async function bricsCompare() {
  const out = [];
  for (const r of REGIONS) {
    const has = await q1("SELECT 1 FROM h3_cells WHERE region_code=$1 LIMIT 1", [r.code]);
    if (has) out.push(await federationAggregate(r.code));
  }
  return out;
}

export async function auditLog(limit = 200, region?: string | null) {
  return q(
    `SELECT seq::int seq, user_email, region_code, action, entity_type, entity_id, diff, at, prev_hash, hash FROM audit_log
      ${region ? "WHERE region_code=$2 OR region_code IS NULL" : ""} ORDER BY seq DESC LIMIT $1`,
    region ? [limit, region] : [limit],
  );
}

export { DAY };
