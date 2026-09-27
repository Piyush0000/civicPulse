import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { embedText } from "../ai/embed";
import { ClusterIndex } from "../analytics/clustering";
import { recomputeRegion } from "../analytics/engine";
import { DEFAULT_WEIGHTS } from "../analytics/scoring";
import { config } from "../config";
import { bulkInsert, getDb, q1 } from "../db";
import { appendAudit } from "../ledger";
import { pseudonym, redactRegex } from "../privacy";
import { ingestDocument } from "../rag";
import { REGIONS, type RegionDef } from "../regions";
import { hashString, rng } from "../stats";
import { generateRequests } from "./synthetic";
import { buildWorld } from "./world";

export const SEED_VERSION = 3;

export const DEMO_USERS = [
  { email: "admin@civicpulse.local", name: "Asha Admin", role: "admin" },
  { email: "analyst@civicpulse.local", name: "Ravi Analyst", role: "analyst" },
  { email: "policy@civicpulse.local", name: "Priya Policymaker", role: "policymaker" },
] as const;
export const DEMO_PASSWORD = "demo1234";

type Progress = (msg: string, pct: number) => Promise<void> | void;

async function setState(value: object) {
  await (await getDb()).query(
    `INSERT INTO app_state (key, value) VALUES ('seed', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = app_state.value || EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  );
}

export async function seedStatus(): Promise<{ status?: string; progress?: number; message?: string; version?: number } | null> {
  const row = await q1<{ value: { status?: string; progress?: number; message?: string; version?: number } }>(
    "SELECT value FROM app_state WHERE key='seed'",
  );
  return row?.value ?? null;
}

const TABLES = [
  "policy_briefs", "recommendations", "cell_scores", "doc_chunks", "documents", "planned_projects", "facilities",
  "cell_indicators", "h3_cells", "clusters", "requests", "raw_messages", "reporter_contacts", "reporters", "settings",
  "audit_log", "job_runs", "regions", "users",
];

export async function resetAll() {
  const db = await getDb();
  await db.exec(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function seedAll(opts: { reset?: boolean; regions?: string[]; onProgress?: Progress } = {}) {
  const log: Progress = async (m, p) => {
    await setState({ status: "running", progress: p, message: m });
    await opts.onProgress?.(m, p);
  };
  const t0 = Date.now();
  await setState({ status: "running", progress: 0, message: "starting", version: SEED_VERSION, startedAt: new Date().toISOString() });
  if (opts.reset) await resetAll();
  const db = await getDb();

  // users
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of DEMO_USERS) {
    await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, region_codes) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, hash, u.name, u.role, REGIONS.map((r) => r.code)],
    );
  }
  await appendAudit({ user_email: "system", region_code: null, action: "seed.start", entity_type: "system", entity_id: null, diff: { version: SEED_VERSION } });

  const regions = REGIONS.filter((r) => !opts.regions || opts.regions.includes(r.code));
  const now = new Date();
  for (let i = 0; i < regions.length; i++) {
    const base = (i / regions.length) * 100;
    const span = 100 / regions.length;
    await seedRegion(regions[i], now, (m, p) => log(`${regions[i].name}: ${m}`, Math.round(base + (p / 100) * span)));
  }
  await appendAudit({ user_email: "system", region_code: null, action: "seed.complete", entity_type: "system", entity_id: null, diff: { regions: regions.map((r) => r.code) } });
  await setState({ status: "done", progress: 100, message: "ready", version: SEED_VERSION, finishedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000) });
}

async function seedRegion(region: RegionDef, now: Date, log: Progress) {
  const db = await getDb();
  const code = region.code;
  await log("building synthetic world", 2);
  const world = buildWorld(region, now);
  const { isLand: _omit, ...serialisable } = region;
  void _omit;
  await db.query(
    `INSERT INTO regions (code, name, country, config) VALUES ($1,$2,$3,$4::jsonb)
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, config=EXCLUDED.config`,
    [code, region.name, region.country, JSON.stringify(serialisable)],
  );
  await db.query(
    `INSERT INTO settings (region_code, key, value) VALUES ($1,'scoring',$2::jsonb) ON CONFLICT DO NOTHING`,
    [code, JSON.stringify(DEFAULT_WEIGHTS)],
  );

  await log("loading grid, population and indicators", 8);
  await bulkInsert(
    db,
    "h3_cells",
    ["region_code", "h3_cell", "lat", "lng", "population", "admin_name", "vulnerability_index", "connectivity_index"],
    world.cells.map((c) => [code, c.h3, c.lat, c.lng, c.population, c.admin, c.vuln, c.conn]),
  );
  const asOf = now.toISOString().slice(0, 10);
  await bulkInsert(
    db,
    "cell_indicators",
    ["region_code", "h3_cell", "category", "key", "value", "gap", "source", "is_proxy", "as_of"],
    world.indicators.map((x) => [code, x.h3, x.category, x.key, x.value, Math.round(x.gap * 10000) / 10000, x.source, x.isProxy, asOf]),
  );
  await bulkInsert(
    db,
    "facilities",
    ["region_code", "category", "type", "name", "lat", "lng", "h3_cell", "source"],
    world.facilities.map((f) => [code, f.category, f.type, f.name, f.lat, f.lng, f.h3, "synthetic OSM-like (illustrative)"]),
  );

  await log("loading planned projects and plan documents", 15);
  await bulkInsert(
    db,
    "planned_projects",
    ["region_code", "external_ref", "title", "description", "category", "status", "budget_amount", "currency", "start_date", "end_date", "completed_date", "admin_name", "h3_cells"],
    world.projects.map((p) => [code, p.ref, p.title, p.description, p.category, p.status, p.budgetLocal, p.currency, p.startDate, p.endDate, p.completedDate, p.admin, p.cells]),
  );
  for (const d of world.docs) await ingestDocument({ region: code, title: d.title, docType: d.docType, published: d.published, content: d.content, synthetic: true }, db);

  await log("generating synthetic citizens", 25);
  const reqs = generateRequests(region, world, now);
  const r = rng(hashString(code + ":status"));

  // reporters (pseudonymous)
  const reporterIds = new Map<string, string>();
  for (const x of reqs) if (!reporterIds.has(x.reporterKey)) reporterIds.set(x.reporterKey, randomUUID());
  await bulkInsert(
    db,
    "reporters",
    ["id", "region_code", "pseudonym_hash", "preferred_language", "consent_given_at", "first_seen_at", "last_seen_at"],
    [...reporterIds.entries()].map(([k, id]) => [id, code, pseudonym("synthetic", `${code}:${k}`), region.languages[0], now, now, now]),
  );

  await log("embedding and clustering requests", 40);
  const index = new ClusterIndex(config.clusterSimThreshold, () => randomUUID());
  const rows: unknown[][] = [];
  for (const x of reqs) {
    const id = randomUUID();
    const embedding = embedText(`${x.summary} | ${x.subcategory}`);
    let clusterId: string | null = null;
    if (x.isActionable && x.h3) {
      clusterId = index.assign({ id, category: x.category, h3: x.h3, embedding, reporter: reporterIds.get(x.reporterKey)!, at: x.submittedAt }).cluster.id;
    }
    const ageDays = (now.getTime() - x.submittedAt.getTime()) / 86400000;
    const status = !x.isActionable
      ? "rejected"
      : ageDays > 60 && r.chance(0.25)
        ? "resolved"
        : r.chance(0.15)
          ? "under_review"
          : "new";
    rows.push([
      id, code, reporterIds.get(x.reporterKey), x.trackingCode, x.channel, x.language, redactRegex(x.textOriginal), redactRegex(x.textEnglish),
      x.category, x.subcategory, x.urgency, x.urgencyReason, x.summary, x.affectedGroup, x.locationText, x.precision, x.admin,
      x.lat, x.lng, x.h3, embedding, clusterId, x.isActionable, x.isSpam, "completed", x.confidence, "synthetic ground truth",
      status, true, x.submittedAt, new Date(x.submittedAt.getTime() + 8000),
    ]);
  }
  await log(`writing ${rows.length} requests`, 55);
  // clusters must exist before requests reference them (no FK, but keep the order logical)
  const clusters = [...index.byId.values()];
  await bulkInsert(
    db,
    "clusters",
    ["id", "region_code", "category", "centroid", "representative_request_id", "label", "request_count", "unique_reporter_count", "h3_cells", "first_seen_at", "last_seen_at"],
    clusters.map((c) => [c.id, code, c.category, c.centroid, c.representative, null, c.count, c.reporters.size, [...c.cells], c.firstSeen, c.lastSeen]),
  );
  await bulkInsert(
    db,
    "requests",
    ["id", "region_code", "reporter_id", "tracking_code", "channel", "language_detected", "text_original_redacted", "text_english_redacted", "category", "subcategory", "urgency", "urgency_reason", "summary", "affected_group", "location_text", "location_precision", "admin_name", "lat", "lng", "h3_cell", "embedding", "cluster_id", "is_actionable", "is_spam", "pipeline_status", "extraction_confidence", "extraction_provider", "status", "is_synthetic", "submitted_at", "processed_at"],
    rows,
  );
  // Cluster labels: representative summary without the location tail (cheap, deterministic).
  await db.query(
    `UPDATE clusters c SET label = split_part(r.summary, ' near ', 1)
       FROM requests r WHERE r.id = c.representative_request_id AND c.region_code=$1`,
    [code],
  );

  await log("scoring, hotspots and recommendations", 75);
  await recomputeRegion(code, { briefsTopN: 10, useLLM: false, now });
  await log("done", 100);
}
