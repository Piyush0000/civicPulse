import { cellToBoundary, cellToParent } from "h3-js";
import { ApiError } from "@/lib/api";
import { catLabel, CATEGORIES, type Category } from "@/lib/categories";
import { config, providerStatus } from "@/lib/config";
import { bulkInsert, getDb, q, q1 } from "@/lib/db";
import { cellsWithin } from "@/lib/seed/world";
import { intake, processRequest } from "@/lib/pipeline";
import { ingestDocument } from "@/lib/rag";
import { getRegion, REGIONS } from "@/lib/regions";
import { generateRequests } from "@/lib/seed/synthetic";
import { buildWorld } from "@/lib/seed/world";
import { seedStatus } from "@/lib/seed/run";
import { verifyLedger, appendAudit } from "@/lib/ledger";
import { regionCells } from "@/lib/geo";
import type { Session } from "@/lib/auth";

// ---------------------------------------------------------------- citizen tracking

const TIMELINE = ["received", "understood", "under_review", "linked_to_project", "resolved"] as const;

export async function trackRequest(code: string) {
  const r = await q1<{
    tracking_code: string; region_code: string; category: string | null; urgency: string | null; summary: string | null; status: string;
    pipeline_status: string; submitted_at: Date; processed_at: Date | null; admin_name: string | null; language_detected: string | null; pipeline_error: string | null;
    cluster_id: string | null;
  }>(
    `SELECT tracking_code, region_code, category, urgency, summary, status, pipeline_status, submitted_at, processed_at, admin_name,
            language_detected, pipeline_error, cluster_id FROM requests WHERE tracking_code=$1`,
    [code.toUpperCase()],
  );
  if (!r) throw new ApiError(404, "not_found", "No request with this tracking ID");
  const others = r.cluster_id ? await q1<{ n: number }>("SELECT count(DISTINCT reporter_id)::int n FROM requests WHERE cluster_id=$1", [r.cluster_id]) : null;
  const understood = r.pipeline_status === "completed";
  const stage = r.status === "resolved" ? 4 : r.status === "linked_to_project" ? 3 : r.status === "under_review" ? 2 : understood ? 1 : 0;
  return {
    trackingCode: r.tracking_code,
    region: getRegion(r.region_code).name,
    category: r.category,
    categoryLabel: r.category ? catLabel(r.category) : null,
    urgency: r.urgency,
    summary: understood ? r.summary : null,
    area: r.admin_name,
    status: r.status,
    pipelineStatus: r.pipeline_status,
    failed: r.pipeline_status === "failed",
    submittedAt: r.submitted_at,
    processedAt: r.processed_at,
    timeline: TIMELINE.map((s, i) => ({ step: s, done: i <= stage })),
    neighboursReportingSame: others ? Math.max(0, others.n - 1) : 0,
  };
}

export async function publicRegions() {
  const rows = await q<{ code: string; n: number }>("SELECT region_code code, count(*)::int n FROM requests GROUP BY 1");
  return REGIONS.map((r) => ({
    code: r.code, name: r.name, localName: r.localName, country: r.country, countryName: r.countryName, flag: r.flag,
    languages: r.languages, center: r.center, radiusKm: r.radiusKm, h3Res: r.h3Res, currency: r.currency,
    localities: r.localities.map((l) => ({ name: l.name, local: l.local, lat: l.lat, lng: l.lng })),
    requests: rows.find((x) => x.code === r.code)?.n ?? 0,
  }));
}

/** Public, k-anonymous aggregates on a coarser (res 7) grid. */
export async function publicStats(region: string) {
  const reg = getRegion(region);
  const rows = await q<{ h3_cell: string; category: string; request_count_90d: number; unique_reporters_90d: number; is_hotspot: boolean }>(
    "SELECT h3_cell, category, request_count_90d, unique_reporters_90d, is_hotspot FROM cell_scores WHERE region_code=$1 AND request_count_90d > 0",
    [region],
  );
  const agg = new Map<string, { h: string; requests: number; reporters: number; hotspot: boolean; top: Map<string, number> }>();
  for (const r of rows) {
    const p = cellToParent(r.h3_cell, 7);
    const a = agg.get(p) ?? { h: p, requests: 0, reporters: 0, hotspot: false, top: new Map() };
    a.requests += r.request_count_90d;
    a.reporters += r.unique_reporters_90d;
    a.hotspot ||= r.is_hotspot;
    a.top.set(r.category, (a.top.get(r.category) || 0) + r.request_count_90d);
    agg.set(p, a);
  }
  const k = config.kAnonThreshold;
  const cells = [...agg.values()]
    .filter((a) => a.reporters >= k)
    .map((a) => ({ h: a.h, requests: a.requests, hotspot: a.hotspot, top: [...a.top.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] }));
  const cats = await q<{ category: string; n: number }>(
    "SELECT category, count(*)::int n FROM requests WHERE region_code=$1 AND is_actionable AND submitted_at > now() - interval '90 days' GROUP BY 1 ORDER BY 2 DESC",
    [region],
  );
  const totals = await q1<{ total: number; languages: number; accepted: number }>(
    `SELECT count(*)::int total, count(DISTINCT language_detected)::int languages,
            (SELECT count(*)::int FROM recommendations WHERE region_code=$1 AND status='accepted') accepted
       FROM requests WHERE region_code=$1`,
    [region],
  );
  return { region: reg.name, kAnonymity: k, suppressedCells: agg.size - cells.length, cells, categories: cats, totals };
}

export async function systemStatus() {
  const seed = await seedStatus();
  const counts = await q1<{ requests: number; regions: number; live: number }>(
    "SELECT (SELECT count(*)::int FROM requests) requests, (SELECT count(*)::int FROM regions) regions, (SELECT count(*)::int FROM requests WHERE NOT is_synthetic) live",
  );
  return { app: config.appName, providers: providerStatus(), seed, counts, time: new Date().toISOString() };
}

export async function transparency() {
  const decisions = await q(
    `SELECT r.id, r.region_code, r.title, r.category, r.status, r.decided_at, r.people_affected_est, r.decision_note
       FROM recommendations r WHERE r.status <> 'proposed' ORDER BY r.decided_at DESC NULLS LAST LIMIT 100`,
  );
  const ledger = await q<{ seq: number; user_email: string | null; action: string; entity_type: string; entity_id: string | null; at: Date; hash: string; prev_hash: string; region_code: string | null }>(
    "SELECT seq::int seq, user_email, action, entity_type, entity_id, at, hash, prev_hash, region_code FROM audit_log ORDER BY seq DESC LIMIT 100",
  );
  const verify = await verifyLedger();
  return {
    decisions,
    ledger: ledger.map((l) => ({ ...l, user_email: l.user_email ? l.user_email.replace(/^(.).*(@.*)$/, "$1***$2") : null })),
    verify,
  };
}

// ---------------------------------------------------------------- USSD / SMS feature-phone channel

const USSD_CATS: Category[] = ["water_supply", "sanitation_drainage", "roads_transport", "electricity", "health", "education", "waste_management", "public_safety_lighting", "other"];

/** Africa's Talking-compatible USSD handler: text is the '*'-joined input history. */
export async function ussd(body: { sessionId: string; phoneNumber: string; text: string; region?: string }): Promise<string> {
  const region = getRegion(body.region);
  const parts = (body.text || "").split("*").filter((x, i, a) => !(x === "" && a.length === 1));
  if (parts.length === 0) return `CON ${config.appName} ${region.flag} ${region.name}\n1. Report a problem\n2. Check status`;
  if (parts[0] === "1") {
    if (parts.length === 1) return `CON Choose a category:\n${USSD_CATS.map((c, i) => `${i + 1}. ${catLabel(c)}`).join("\n")}`;
    const cat = USSD_CATS[Number(parts[1]) - 1];
    if (!cat) return "END Invalid choice. Dial again.";
    if (parts.length === 2) return "CON Enter your neighbourhood / area:";
    if (parts.length === 3) return "CON Describe the problem briefly:";
    const area = parts[2];
    const desc = parts.slice(3).join(" ");
    const res = await intake({
      region: region.code,
      channel: "ussd",
      externalUserId: body.phoneNumber,
      externalMessageId: `ussd:${body.sessionId}`,
      text: `${catLabel(cat)}: ${desc}. Area: ${area}`,
    });
    void processRequest(res.requestId);
    return `END Thank you! Your tracking ID is ${res.trackingCode}. Dial again and choose 2 to check status.`;
  }
  if (parts[0] === "2") {
    if (parts.length === 1) return "CON Enter tracking ID (e.g. CP-7F3K9Q):";
    try {
      const t = await trackRequest(parts[1].startsWith("CP-") ? parts[1] : `CP-${parts[1]}`);
      return `END ${t.trackingCode}: ${t.categoryLabel ?? "processing"}. Status: ${t.status.replace(/_/g, " ")}.`;
    } catch {
      return "END Tracking ID not found.";
    }
  }
  return "END Invalid choice.";
}

// ---------------------------------------------------------------- demo: simulate a live wave of citizens

type G = { __cpWave?: Map<string, number> };
const g = globalThis as unknown as G;
const waves = g.__cpWave ?? (g.__cpWave = new Map());

export async function simulateWave(region: string, count: number, seconds: number, focus?: string | null) {
  const last = waves.get(region) ?? 0;
  if (Date.now() - last < 5000) throw new ApiError(429, "busy", "A wave is already running, try again in a few seconds");
  waves.set(region, Date.now());
  const reg = getRegion(region);
  const now = new Date();
  const world = buildWorld(reg, now);
  const pool = generateRequests({ ...reg, syntheticRequests: 400, code: reg.code }, world, now).filter(
    (r) => r.isActionable && r.lat !== null && r.precision !== "district" && (!focus || r.category === focus),
  );
  const n = Math.min(Math.max(1, count), 40);
  const picks = Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]).filter(Boolean);
  const stamp = Date.now();
  picks.forEach((p, i) => {
    setTimeout(async () => {
      try {
        const res = await intake({
          region,
          channel: p.channel === "ivr" ? "ivr" : p.channel,
          externalUserId: `sim-${stamp}-${i % Math.max(1, Math.floor(n / 2))}`,
          externalMessageId: `sim:${stamp}:${i}`,
          text: p.textOriginal,
          lat: p.lat,
          lng: p.lng,
          language: p.language,
        });
        await q("UPDATE requests SET is_synthetic=true WHERE id=$1", [res.requestId]);
        await processRequest(res.requestId);
      } catch (e) {
        console.error("wave item failed", e);
      }
    }, Math.round((i / n) * seconds * 1000 + Math.random() * 400));
  });
  return { scheduled: picks.length, seconds };
}

// ---------------------------------------------------------------- datasets

export async function datasets(region: string) {
  const counts = await q1<Record<string, number>>(
    `SELECT (SELECT count(*)::int FROM h3_cells WHERE region_code=$1) cells,
            (SELECT count(*)::int FROM cell_indicators WHERE region_code=$1) indicators,
            (SELECT count(*)::int FROM facilities WHERE region_code=$1) facilities,
            (SELECT count(*)::int FROM planned_projects WHERE region_code=$1) projects,
            (SELECT count(*)::int FROM documents WHERE region_code=$1) documents,
            (SELECT count(*)::int FROM doc_chunks WHERE region_code=$1) chunks,
            (SELECT count(*)::int FROM requests WHERE region_code=$1) requests`,
    [region],
  );
  const sources = await q("SELECT category, source, is_proxy, count(*)::int n, max(as_of) as_of FROM cell_indicators WHERE region_code=$1 GROUP BY 1,2,3 ORDER BY 1", [region]);
  const docs = await q("SELECT id, title, doc_type, published_date, language, is_synthetic, length(content)::int chars, created_at FROM documents WHERE region_code=$1 ORDER BY created_at DESC", [region]);
  const projects = await q(
    "SELECT external_ref, title, category, status, budget_amount, currency, start_date, end_date, completed_date, admin_name, cardinality(h3_cells) cells FROM planned_projects WHERE region_code=$1 ORDER BY budget_amount DESC",
    [region],
  );
  return {
    counts,
    sources,
    documents: docs,
    projects,
    catalogue: [
      { name: "Population grid", source: "Synthetic gaussian surface (WorldPop 100m in production)", license: "CC BY 4.0 (WorldPop)", refresh: "annual" },
      { name: "Facilities", source: "Synthetic OSM-like points (OpenStreetMap via Overpass in production)", license: "ODbL (OSM)", refresh: "monthly" },
      { name: "Night lights", source: "Synthetic VIIRS-like proxy (NASA Black Marble in production)", license: "Public domain", refresh: "monthly" },
      { name: "Vulnerability", source: "Illustrative district deprivation values (national MPI in production)", license: "Open government data", refresh: "annual" },
      { name: "Planned projects", source: "Synthetic budget book entries; CSV upload supported", license: "Open government data", refresh: "per budget cycle" },
      { name: "Plan documents", source: "Synthetic annual plan / budget speech; text upload supported", license: "Open government data", refresh: "per budget cycle" },
    ],
  };
}

export async function uploadProjectsCsv(region: string, csv: string, s: Session) {
  const reg = getRegion(region);
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const need = ["external_ref", "title", "category", "status", "budget_amount", "lat", "lng"];
  for (const n of need) if (!header.includes(n)) throw new ApiError(400, "bad_csv", `Missing column ${n}. Required: ${need.join(", ")}; optional: radius_km, start_date, end_date, completed_date`);
  const cellSet = new Set(regionCells(reg));
  const rows: unknown[][] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    const o = Object.fromEntries(header.map((h, j) => [h, vals[j]]));
    if (!(CATEGORIES as readonly string[]).includes(o.category)) {
      errors.push(`line ${i + 1}: unknown category ${o.category}`);
      continue;
    }
    if (!["planned", "approved", "in_progress", "completed", "cancelled"].includes(o.status)) {
      errors.push(`line ${i + 1}: bad status ${o.status}`);
      continue;
    }
    const cells = cellsWithin(reg, cellSet, Number(o.lat), Number(o.lng), Number(o.radius_km || 1));
    rows.push([region, o.external_ref, o.title, o.title, o.category, o.status, Number(o.budget_amount), reg.currency, o.start_date || null, o.end_date || null, o.completed_date || null, null, cells]);
  }
  const db = await getDb();
  await bulkInsert(
    db,
    "planned_projects",
    ["region_code", "external_ref", "title", "description", "category", "status", "budget_amount", "currency", "start_date", "end_date", "completed_date", "admin_name", "h3_cells"],
    rows,
    { onConflict: "ON CONFLICT (region_code, external_ref) DO UPDATE SET title=EXCLUDED.title, status=EXCLUDED.status, budget_amount=EXCLUDED.budget_amount, h3_cells=EXCLUDED.h3_cells, category=EXCLUDED.category" },
  );
  await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "dataset.projects_upload", entity_type: "dataset", entity_id: "planned_projects", diff: { rows: rows.length, errors: errors.length } });
  return { imported: rows.length, errors };
}

export async function uploadDocument(region: string, body: { title: string; docType: string; content: string; published?: string }, s: Session) {
  if (!body.title || !body.content || body.content.length < 50) throw new ApiError(400, "bad_document", "title and content (>= 50 chars) required");
  const id = await ingestDocument({ region, title: body.title, docType: body.docType || "plan", published: body.published || null, content: body.content });
  await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "dataset.document_upload", entity_type: "document", entity_id: id, diff: { title: body.title } });
  return { id };
}

// ---------------------------------------------------------------- open-data exports (k-anonymised)

export async function exportCells(region: string, format: "csv" | "geojson") {
  const rows = await q<{ h3_cell: string; category: string; priority_score: number; request_count_90d: number; unique_reporters_90d: number; is_hotspot: boolean; population: number; admin_name: string }>(
    `SELECT s.h3_cell, s.category, s.priority_score, s.request_count_90d, s.unique_reporters_90d, s.is_hotspot, c.population, c.admin_name
       FROM cell_scores s JOIN h3_cells c USING (region_code, h3_cell) WHERE s.region_code=$1 AND s.request_count_90d > 0`,
    [region],
  );
  const k = config.kAnonThreshold;
  const safe = rows.map((r) => ({
    ...r,
    request_count_90d: r.unique_reporters_90d >= k ? r.request_count_90d : null,
    unique_reporters_90d: r.unique_reporters_90d >= k ? r.unique_reporters_90d : null,
    priority_score: Math.round(r.priority_score * 10) / 10,
    population: Math.round(r.population),
  }));
  if (format === "csv") {
    const head = "h3_cell,category,admin_name,priority_score,is_hotspot,requests_90d,unique_reporters_90d,population";
    return [head, ...safe.map((r) => [r.h3_cell, r.category, `"${r.admin_name}"`, r.priority_score, r.is_hotspot, r.request_count_90d ?? "", r.unique_reporters_90d ?? "", r.population].join(","))].join("\n");
  }
  return JSON.stringify({
    type: "FeatureCollection",
    properties: { region, license: "CC BY 4.0", kAnonymity: k, note: "Counts suppressed where fewer than k unique reporters" },
    features: safe.map((r) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [cellToBoundary(r.h3_cell, true).concat([cellToBoundary(r.h3_cell, true)[0]])] },
      properties: r,
    })),
  });
}

export async function exportRecommendations(region: string) {
  const rows = await q<Record<string, unknown>>(
    "SELECT rank, title, category, priority_score, people_affected_est, request_count, unique_reporters, funded_overlap, est_cost_usd, status, decided_at FROM recommendations WHERE region_code=$1 AND is_active ORDER BY rank",
    [region],
  );
  const cols = ["rank", "title", "category", "priority_score", "people_affected_est", "request_count", "unique_reporters", "funded_overlap", "est_cost_usd", "status", "decided_at"];
  return [cols.join(","), ...rows.map((r) => cols.map((c) => (typeof r[c] === "string" ? `"${String(r[c]).replace(/"/g, '""')}"` : r[c] instanceof Date ? (r[c] as Date).toISOString() : (r[c] ?? ""))).join(","))].join("\n");
}
