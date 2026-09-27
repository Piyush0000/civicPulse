import { cellToParent, gridDisk, latLngToCell } from "h3-js";
import { ApiError } from "@/lib/api";
import { isCategory } from "@/lib/categories";
import { getDb, q, q1 } from "@/lib/db";
import { nearestLocality, insideRegion } from "@/lib/geo";
import { appendAudit } from "@/lib/ledger";
import { scheduleRecompute } from "@/lib/pipeline";
import { getRegion } from "@/lib/regions";
import type { Session } from "@/lib/auth";

const DAY = 86400000;

export async function overview(region: string) {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since7 = new Date(now - 7 * DAY);
  const [totals] = await q<{ total: number; d7: number; d30: number; actionable: number; geocoded: number; voice: number; spam: number }>(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE submitted_at > $2)::int d7,
            count(*) FILTER (WHERE submitted_at > $3)::int d30,
            count(*) FILTER (WHERE is_actionable)::int actionable,
            count(*) FILTER (WHERE is_actionable AND h3_cell IS NOT NULL)::int geocoded,
            count(*) FILTER (WHERE input_mode='voice')::int voice,
            count(*) FILTER (WHERE is_spam)::int spam
       FROM requests WHERE region_code=$1`,
    [region, since7, since30],
  );
  const group = (col: string, since?: Date) =>
    q<{ k: string; n: number }>(
      `SELECT ${col} k, count(*)::int n FROM requests WHERE region_code=$1 ${since ? "AND submitted_at > $2" : ""} AND ${col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,
      since ? [region, since] : [region],
    );
  const [byChannel, byLanguage, byCategory, byUrgency, byStatus] = await Promise.all([
    group("channel"),
    group("language_detected"),
    group("category", since30),
    group("urgency", since30),
    group("status"),
  ]);
  const weekly = await q<{ week: Date; category: string; n: number }>(
    `SELECT date_trunc('week', submitted_at) week, category, count(*)::int n FROM requests
      WHERE region_code=$1 AND is_actionable AND submitted_at > $2 GROUP BY 1,2 ORDER BY 1`,
    [region, new Date(now - 365 * DAY)],
  );
  const hot = await q1<{ hotspots: number; emerging: number; hot_cats: number }>(
    `SELECT count(*) FILTER (WHERE is_hotspot)::int hotspots, count(*) FILTER (WHERE is_emerging)::int emerging,
            count(DISTINCT category) FILTER (WHERE is_hotspot)::int hot_cats FROM cell_scores WHERE region_code=$1`,
    [region],
  );
  const recs = await q(
    `SELECT id, title, category, priority_score, rank, people_affected_est, request_count, status, funded_overlap
       FROM recommendations WHERE region_code=$1 AND is_active ORDER BY rank LIMIT 5`,
    [region],
  );
  const pipeline = await q1<{ failed: number; processing: number; live: number; median_s: number | null }>(
    `SELECT count(*) FILTER (WHERE pipeline_status='failed')::int failed,
            count(*) FILTER (WHERE pipeline_status NOT IN ('completed','failed'))::int processing,
            count(*) FILTER (WHERE NOT is_synthetic)::int live,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM processed_at - submitted_at))
              FILTER (WHERE NOT is_synthetic AND processed_at IS NOT NULL) median_s
       FROM requests WHERE region_code=$1`,
    [region],
  );
  const decisions = await q<{ status: string; n: number }>(
    "SELECT status, count(*)::int n FROM recommendations WHERE region_code=$1 AND is_active GROUP BY 1",
    [region],
  );
  const lastJob = await q1<{ finished_at: Date; detail: object }>(
    "SELECT finished_at, detail FROM job_runs WHERE region_code=$1 AND name='recompute' AND status='ok' ORDER BY id DESC LIMIT 1",
    [region],
  );
  const population = await q1<{ pop: number; cells: number }>("SELECT sum(population)::float8 pop, count(*)::int cells FROM h3_cells WHERE region_code=$1", [region]);
  return {
    region: getRegion(region).name,
    totals,
    pctGeocoded: totals.actionable ? Math.round((totals.geocoded / totals.actionable) * 1000) / 10 : 0,
    byChannel,
    byLanguage,
    byCategory,
    byUrgency,
    byStatus,
    weekly,
    hotspots: hot,
    topRecommendations: recs,
    pipeline,
    decisions,
    lastRecompute: lastJob,
    population,
  };
}

export type RequestFilters = {
  category?: string | null;
  urgency?: string | null;
  status?: string | null;
  channel?: string | null;
  language?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
  h3?: string | null;
  cluster?: string | null;
  pipeline?: string | null;
  unlocated?: boolean;
  live?: boolean;
};

export async function listRequests(region: string, f: RequestFilters, page: { size: number; offset: number }) {
  const where = ["region_code=$1"];
  const params: unknown[] = [region];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.category) add("category=?", f.category);
  if (f.urgency) add("urgency=?", f.urgency);
  if (f.status) add("status=?", f.status);
  if (f.channel) add("channel=?", f.channel);
  if (f.language) add("language_detected=?", f.language);
  if (f.pipeline) add("pipeline_status=?", f.pipeline);
  if (f.q) add("(summary ILIKE ? OR text_english_redacted ILIKE $X OR text_original_redacted ILIKE $X OR tracking_code ILIKE $X)".replace(/\$X/g, `$${params.length + 1}`), `%${f.q}%`);
  if (f.from) add("submitted_at >= ?", new Date(f.from));
  if (f.to) add("submitted_at <= ?", new Date(f.to));
  if (f.h3) add("h3_cell=?", f.h3);
  if (f.cluster) add("cluster_id=?", f.cluster);
  if (f.unlocated) where.push("h3_cell IS NULL AND is_actionable AND NOT is_spam AND pipeline_status='completed'");
  if (f.live) where.push("NOT is_synthetic");
  const w = where.join(" AND ");
  const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int n FROM requests WHERE ${w}`, params);
  const rows = await q(
    `SELECT id, tracking_code, channel, language_detected, category, subcategory, urgency, summary, admin_name, location_precision,
            h3_cell, status, pipeline_status, extraction_confidence, submitted_at, is_synthetic, is_spam, is_actionable, cluster_id
       FROM requests WHERE ${w} ORDER BY submitted_at DESC LIMIT ${page.size} OFFSET ${page.offset}`,
    params,
  );
  return { total: n, rows };
}

export async function requestDetail(region: string, id: string) {
  const r = await q1<Record<string, unknown>>(
    `SELECT r.id, r.region_code, r.tracking_code, r.channel, r.language_detected, r.text_original_redacted, r.text_english_redacted, r.category,
            r.subcategory, r.urgency, r.urgency_reason, r.summary, r.affected_group, r.estimated_people_affected, r.location_text,
            r.location_precision, r.admin_name, r.lat, r.lng, r.h3_cell, r.cluster_id, r.is_actionable, r.is_spam, r.pipeline_status,
            r.pipeline_error, r.pipeline_log, r.extraction_confidence, r.extraction_provider, r.status, r.analyst_overrides,
            r.submitted_at, r.processed_at, r.is_synthetic, (m.audio_path IS NOT NULL) has_audio
       FROM requests r LEFT JOIN raw_messages m ON m.id = r.raw_message_id WHERE r.id=$1 AND r.region_code=$2`,
    [id, region],
  );
  if (!r) throw new ApiError(404, "not_found", "Request not found");
  const siblings = r.cluster_id
    ? await q(
        `SELECT id, tracking_code, language_detected, summary, urgency, submitted_at FROM requests
          WHERE cluster_id=$1 AND id<>$2 ORDER BY submitted_at DESC LIMIT 8`,
        [r.cluster_id, id],
      )
    : [];
  const cluster = r.cluster_id
    ? await q1("SELECT id, label, request_count, unique_reporter_count, first_seen_at, last_seen_at FROM clusters WHERE id=$1", [r.cluster_id])
    : null;
  return { ...r, cluster, siblings };
}

export async function patchRequest(region: string, id: string, body: Record<string, unknown>, s: Session) {
  const before = await q1<Record<string, unknown>>(
    "SELECT category, urgency, status, lat, lng, h3_cell, analyst_overrides FROM requests WHERE id=$1 AND region_code=$2",
    [id, region],
  );
  if (!before) throw new ApiError(404, "not_found", "Request not found");
  const sets: string[] = [];
  const params: unknown[] = [id];
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const set = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col}=$${params.length}`);
    diff[col] = { from: before[col], to: v };
  };
  if (body.category !== undefined) {
    if (!isCategory(body.category)) throw new ApiError(400, "bad_category", "Unknown category");
    set("category", body.category);
  }
  if (body.urgency !== undefined) {
    if (!["low", "medium", "high", "critical"].includes(String(body.urgency))) throw new ApiError(400, "bad_urgency", "Bad urgency");
    set("urgency", body.urgency);
  }
  if (body.status !== undefined) {
    if (!["new", "under_review", "linked_to_project", "resolved", "rejected"].includes(String(body.status))) throw new ApiError(400, "bad_status", "Bad status");
    set("status", body.status);
  }
  if (body.lat !== undefined && body.lng !== undefined) {
    const reg = getRegion(region);
    const lat = Number(body.lat),
      lng = Number(body.lng);
    if (!insideRegion(reg, lat, lng)) throw new ApiError(400, "outside_region", "Pin is outside the region");
    const h3 = latLngToCell(lat, lng, reg.h3Res);
    set("lat", lat);
    set("lng", lng);
    set("h3_cell", h3);
    set("location_precision", "exact_pin");
    set("admin_name", nearestLocality(reg, lat, lng).loc.name);
  }
  if (!sets.length) throw new ApiError(400, "no_changes", "Nothing to update");
  params.push(JSON.stringify({ ...((before.analyst_overrides as object) ?? {}), ...Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.to])), by: s.email, at: new Date().toISOString() }));
  sets.push(`analyst_overrides=$${params.length}::jsonb`);
  const db = await getDb();
  await db.tx(async (t) => {
    await t.query(`UPDATE requests SET ${sets.join(", ")} WHERE id=$1`, params);
    await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "request.update", entity_type: "request", entity_id: id, diff }, t);
  });
  scheduleRecompute(region, 1500);
  return requestDetail(region, id);
}

// ---------------------------------------------------------------- map

export async function mapCells(region: string, category: string, metric: string) {
  if (metric === "population" || metric === "vulnerability" || metric === "connectivity") {
    const col = metric === "population" ? "population" : metric === "vulnerability" ? "vulnerability_index" : "connectivity_index";
    const rows = await q<{ h: string; v: number }>(`SELECT h3_cell h, ${col}::float8 v FROM h3_cells WHERE region_code=$1`, [region]);
    return rows.map((r) => ({ h: r.h, v: r.v, hs: false, em: false, n: 0 }));
  }
  const col = metric === "demand" ? "demand_adj" : metric === "gap" ? "g_norm" : metric === "gi" ? "gi_z" : "priority_score";
  if (category === "all") {
    const agg = metric === "demand" ? `sum(${col})` : `max(${col})`;
    const rows = await q<{ h: string; v: number; hs: boolean; em: boolean; n: number }>(
      `SELECT h3_cell h, ${agg}::float8 v, bool_or(is_hotspot) hs, bool_or(is_emerging) em, sum(request_count_90d)::int n
         FROM cell_scores WHERE region_code=$1 GROUP BY h3_cell`,
      [region],
    );
    return rows;
  }
  if (!isCategory(category)) throw new ApiError(400, "bad_category", "Unknown category");
  return q<{ h: string; v: number; hs: boolean; em: boolean; n: number }>(
    `SELECT h3_cell h, coalesce(${col},0)::float8 v, is_hotspot hs, is_emerging em, request_count_90d n FROM cell_scores WHERE region_code=$1 AND category=$2`,
    [region, category],
  );
}

export async function cellDetail(region: string, h3: string) {
  const cell = await q1("SELECT h3_cell, lat, lng, population, admin_name, vulnerability_index, connectivity_index FROM h3_cells WHERE region_code=$1 AND h3_cell=$2", [region, h3]);
  if (!cell) throw new ApiError(404, "not_found", "Cell not in region");
  const scores = await q(
    `SELECT category, priority_score, d_norm, g_norm, p_norm, v_norm, f_coverage, demand_raw, demand_adj, gi_z, gi_p, is_hotspot,
            request_count_90d, unique_reporters_90d, no_signal, is_emerging, trend_ratio
       FROM cell_scores WHERE region_code=$1 AND h3_cell=$2 ORDER BY priority_score DESC`,
    [region, h3],
  );
  const indicators = await q("SELECT category, key, value, gap, source, is_proxy FROM cell_indicators WHERE region_code=$1 AND h3_cell=$2", [region, h3]);
  const recent = await q(
    `SELECT id, tracking_code, language_detected, category, urgency, summary, text_original_redacted, text_english_redacted, submitted_at, channel
       FROM requests WHERE region_code=$1 AND h3_cell=$2 AND is_actionable ORDER BY submitted_at DESC LIMIT 12`,
    [region, h3],
  );
  const ring = gridDisk(h3, 1);
  const facilities = await q("SELECT category, type, name, lat, lng FROM facilities WHERE region_code=$1 AND h3_cell = ANY($2::text[])", [region, ring]);
  const recs = await q(
    "SELECT id, title, category, priority_score, rank, status FROM recommendations WHERE region_code=$1 AND is_active AND $2 = ANY(h3_cells) ORDER BY rank",
    [region, h3],
  );
  const projects = await q(
    "SELECT id, title, category, status, budget_amount, currency FROM planned_projects WHERE region_code=$1 AND $2 = ANY(h3_cells)",
    [region, h3],
  );
  const weights = await q1<{ value: object }>("SELECT value FROM settings WHERE region_code=$1 AND key='scoring'", [region]);
  return { cell, scores, indicators, recent, facilities, recommendations: recs, projects, weights: weights?.value };
}

export async function mapLayers(region: string) {
  const facilities = await q("SELECT category, type, name, lat, lng FROM facilities WHERE region_code=$1", [region]);
  const projects = await q(
    "SELECT id, title, category, status, budget_amount, currency, h3_cells, completed_date FROM planned_projects WHERE region_code=$1",
    [region],
  );
  const recs = await q("SELECT id, title, category, rank, status, h3_cells, center_lat, center_lng, priority_score FROM recommendations WHERE region_code=$1 AND is_active ORDER BY rank", [region]);
  const recent = await q(
    `SELECT id, category, urgency, lat, lng, submitted_at FROM requests
      WHERE region_code=$1 AND lat IS NOT NULL AND is_actionable AND submitted_at > $2 ORDER BY submitted_at DESC LIMIT 1500`,
    [region, new Date(Date.now() - 30 * DAY)],
  );
  return { facilities, projects, recommendations: recs, recent };
}

/** Coarsen a cell for public outputs (res 8 -> res 7 parent). */
export const coarse = (h3: string | null) => (h3 ? cellToParent(h3, 7) : null);
