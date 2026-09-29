import { cellToLatLng } from "h3-js";
import { ApiError } from "@/lib/api";
import type { Session } from "@/lib/auth";
import { CATEGORY_META, catLabel, type Category } from "@/lib/categories";
import { chat, hasLLM } from "@/lib/ai/llm";
import { unverifiedNumbers } from "@/lib/ai/brief";
import { schemeSummary, SCHEMES, syncAllocations } from "@/lib/allocations";
import { getWeights } from "@/lib/analytics/engine";
import { FACILITY_TYPES, simulateSite, type FacilityType, type WhatIfCell } from "@/lib/analytics/whatif";
import { getDb, q, q1 } from "@/lib/db";
import { publish } from "@/lib/events";
import { nearestLocality } from "@/lib/geo";
import { appendAudit } from "@/lib/ledger";
import { decrypt, pseudonym } from "@/lib/privacy";
import { getRegion } from "@/lib/regions";
import { pctRank } from "@/lib/stats";
import { sendTelegram } from "@/lib/messaging/telegram";
import { impactProjects } from "./planning";
import { notifyRecommendationCitizens } from "@/lib/push";

const DAY = 86400000;

// ---------------------------------------------------------------- lifecycle: MP endorse → CM approve → work → citizen verification

export const WORK_STAGES = ["none", "approved", "work_started", "work_done", "verified", "disputed"] as const;

export async function endorseRecommendation(region: string, id: string, note: string, s: Session) {
  const rec = await q1<{ title: string }>("SELECT title FROM recommendations WHERE id=$1 AND region_code=$2", [id, region]);
  if (!rec) throw new ApiError(404, "not_found", "Recommendation not found");
  await q("UPDATE recommendations SET endorsed_by=$2, endorsed_at=now(), updated_at=now() WHERE id=$1", [id, s.name]);
  return appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "recommendation.endorsed", entity_type: "recommendation", entity_id: id, diff: { note: note.slice(0, 500), title: rec.title } });
}

/** Called by the CM decision: link open requests to the project and pick a funding scheme. */
export async function onApproved(region: string, id: string) {
  const rec = await q1<{ category: string; h3_cells: string[]; est_cost_usd: number }>("SELECT category, h3_cells, est_cost_usd FROM recommendations WHERE id=$1", [id]);
  if (!rec) return;
  const scheme = SCHEMES[rec.category as Category]?.scheme ?? SCHEMES.other.scheme;
  const sanctionedInr = Math.round(rec.est_cost_usd / getRegion(region).usdRate);
  await q("UPDATE recommendations SET work_stage='approved', scheme=$2, sanctioned_inr=$3 WHERE id=$1 AND work_stage='none'", [id, scheme, sanctionedInr]);
  await q(
    `UPDATE requests SET recommendation_id=$1 WHERE region_code=$2 AND category=$3 AND h3_cell = ANY($4::text[]) AND is_actionable AND recommendation_id IS NULL`,
    [id, region, rec.category, rec.h3_cells],
  );
  void notifyRecommendationCitizens(id, (code) => ({
    title: "Your complaint is now a government project ✅",
    body: `${code}: approved by the CM's office${scheme ? ` under ${scheme}` : ""}. We will tell you when work is done.`,
  })).catch(() => undefined);
}

export async function updateWork(region: string, id: string, body: { stage?: string; note?: string; contractor?: string }, s: Session) {
  const stage = String(body.stage || "");
  if (!["work_started", "work_done"].includes(stage)) throw new ApiError(400, "bad_stage", "stage must be work_started or work_done");
  const rec = await q1<{ status: string; work_stage: string; title: string }>("SELECT status, work_stage, title FROM recommendations WHERE id=$1 AND region_code=$2", [id, region]);
  if (!rec) throw new ApiError(404, "not_found", "Recommendation not found");
  if (rec.status !== "accepted") throw new ApiError(409, "not_approved", "Work can only start after the CM's office approves the project");
  if (stage === "work_done" && rec.work_stage === "none") throw new ApiError(409, "not_started", "Mark work as started first");
  const note = String(body.note || "").slice(0, 1000);
  const db = await getDb();
  const ledger = await db.tx(async (t) => {
    if (stage === "work_started")
      await t.query("UPDATE recommendations SET work_stage='work_started', work_started_at=now(), work_note=$2, contractor=$3, updated_at=now() WHERE id=$1", [id, note, body.contractor?.slice(0, 120) || null]);
    else {
      await t.query("UPDATE recommendations SET work_stage='work_done', work_done_at=now(), work_note=$2, updated_at=now() WHERE id=$1", [id, note]);
      await t.query("UPDATE requests SET status='resolved', resolved_at=now() WHERE recommendation_id=$1 AND status <> 'rejected'", [id]);
    }
    return appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: `work.${stage}`, entity_type: "recommendation", entity_id: id, diff: { note, contractor: body.contractor ?? null, title: rec.title } }, t);
  });
  await publish({ type: "decision", region, id, status: stage, title: rec.title, at: new Date().toISOString() });
  if (stage === "work_done") void askForFeedback(id, rec.title);
  return { ok: true, ledger };
}

/** Close the loop: ask every citizen with a reply channel whether the problem is really fixed. */
async function askForFeedback(recId: string, title: string) {
  void notifyRecommendationCitizens(recId, (code) => ({ title: "Work reported done: is it really fixed?", body: `${code}: "${title}". Tap to verify with a rating.` })).catch(() => undefined);
  const rows = await q<{ tracking_code: string; external_id_encrypted: string; channel: string }>(
    `SELECT DISTINCT ON (c.reporter_id) r.tracking_code, c.external_id_encrypted, c.channel
       FROM requests r JOIN reporter_contacts c ON c.reporter_id = r.reporter_id WHERE r.recommendation_id=$1 AND NOT r.is_synthetic`,
    [recId],
  );
  for (const r of rows) {
    if (r.channel !== "telegram") continue;
    await sendTelegram(
      decrypt(r.external_id_encrypted),
      `🛠 Work on "${title}" is marked DONE. Is your problem (${r.tracking_code}) actually fixed? Rate it here: /track/${r.tracking_code}`,
    ).catch(() => undefined);
  }
}

export async function submitFeedback(body: { tracking_code?: string; solved?: string; rating?: number; comment?: string }, session: Session | null) {
  const code = String(body.tracking_code || "").toUpperCase();
  const solved = String(body.solved || "");
  const rating = Math.round(Number(body.rating));
  if (!["yes", "partly", "no"].includes(solved)) throw new ApiError(400, "bad_solved", "solved must be yes, partly or no");
  if (!(rating >= 1 && rating <= 5)) throw new ApiError(400, "bad_rating", "rating must be 1-5");
  const r = await q1<{ id: string; region_code: string; recommendation_id: string | null; status: string; reporter_id: string | null }>(
    "SELECT id, region_code, recommendation_id, status, reporter_id FROM requests WHERE tracking_code=$1",
    [code],
  );
  if (!r) throw new ApiError(404, "not_found", "Tracking ID not found");
  if (session?.role === "citizen") {
    const mine = await q1("SELECT 1 FROM reporters WHERE id=$1 AND pseudonym_hash=$2", [r.reporter_id, pseudonym("web", `citizen:${session.sub}`)]);
    if (!mine) throw new ApiError(403, "not_yours", "This complaint belongs to another account");
  }
  if (!r.recommendation_id || r.status !== "resolved") throw new ApiError(409, "not_ready", "Feedback opens when the government marks the work as done");
  const { redactRegex } = await import("@/lib/privacy");
  await q(
    `INSERT INTO citizen_feedback (recommendation_id, request_id, region_code, solved, rating, comment) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (request_id) DO UPDATE SET solved=EXCLUDED.solved, rating=EXCLUDED.rating, comment=EXCLUDED.comment, created_at=now()`,
    [r.recommendation_id, r.id, r.region_code, solved, rating, body.comment ? redactRegex(String(body.comment).slice(0, 500)) : null],
  );
  const verdict = await refreshVerdict(r.recommendation_id);
  if (solved === "no") await q("UPDATE requests SET status='under_review' WHERE id=$1", [r.id]); // reopen for the department
  return { ok: true, verdict };
}

/** ≥3 responses: ≥60% satisfied ⇒ verified; ≤40% ⇒ disputed (the department must revisit). */
export async function refreshVerdict(recId: string) {
  const f = await feedbackSummary(recId);
  const stage = f.responses >= 3 ? (f.satisfaction >= 0.6 ? "verified" : f.satisfaction <= 0.4 ? "disputed" : "work_done") : "work_done";
  await q("UPDATE recommendations SET work_stage=$2 WHERE id=$1 AND work_stage IN ('work_done','verified','disputed')", [recId, stage]);
  return { stage, ...f };
}

export async function feedbackSummary(recId: string) {
  const rows = await q<{ solved: string; rating: number; comment: string | null; created_at: Date }>(
    "SELECT solved, rating, comment, created_at FROM citizen_feedback WHERE recommendation_id=$1 ORDER BY created_at DESC",
    [recId],
  );
  const n = rows.length;
  const score = rows.reduce((a, r) => a + (r.solved === "yes" ? 1 : r.solved === "partly" ? 0.5 : 0), 0);
  const eligible = await q1<{ n: number }>("SELECT count(*)::int n FROM requests WHERE recommendation_id=$1", [recId]);
  return {
    responses: n,
    eligible: eligible?.n ?? 0,
    satisfaction: n ? Math.round((score / n) * 100) / 100 : 0,
    avgRating: n ? Math.round((rows.reduce((a, r) => a + r.rating, 0) / n) * 10) / 10 : 0,
    counts: { yes: rows.filter((r) => r.solved === "yes").length, partly: rows.filter((r) => r.solved === "partly").length, no: rows.filter((r) => r.solved === "no").length },
    comments: rows.filter((r) => r.comment).slice(0, 6).map((r) => ({ solved: r.solved, rating: r.rating, comment: r.comment, at: r.created_at })),
  };
}

// ---------------------------------------------------------------- citizen portal

export async function myComplaints(s: Session) {
  const ph = pseudonym("web", `citizen:${s.sub}`);
  const rows = await q<Record<string, unknown>>(
    `SELECT r.tracking_code, r.region_code, r.category, r.urgency, r.summary, r.status, r.pipeline_status, r.admin_name, r.submitted_at,
            r.photo_url, r.recommendation_id, rec.title rec_title, rec.work_stage, rec.status rec_status,
            f.solved my_solved, f.rating my_rating
       FROM requests r JOIN reporters rp ON rp.id = r.reporter_id
       LEFT JOIN recommendations rec ON rec.id = r.recommendation_id
       LEFT JOIN citizen_feedback f ON f.request_id = r.id
      WHERE rp.pseudonym_hash=$1 ORDER BY r.submitted_at DESC LIMIT 100`,
    [ph],
  );
  return { user: { name: s.name, region: s.regions[0] }, complaints: rows };
}

// ---------------------------------------------------------------- zone rating (ward / neighbourhood leaderboard)

export async function zoneRatings(region: string) {
  const since = new Date(Date.now() - 90 * DAY);
  const pops = await q<{ admin: string; pop: number; cells: number; vuln: number }>(
    "SELECT admin_name admin, sum(population)::float8 pop, count(*)::int cells, avg(vulnerability_index)::float8 vuln FROM h3_cells WHERE region_code=$1 GROUP BY 1",
    [region],
  );
  const reqs = await q<{ admin: string; n90: number; critical: number; open: number; total: number; resolved: number; reporters: number }>(
    `SELECT admin_name admin,
            count(*) FILTER (WHERE submitted_at > $2)::int n90,
            count(*) FILTER (WHERE submitted_at > $2 AND urgency='critical')::int critical,
            count(*) FILTER (WHERE status IN ('new','under_review'))::int open,
            count(*)::int total,
            count(*) FILTER (WHERE status='resolved')::int resolved,
            count(DISTINCT reporter_id) FILTER (WHERE submitted_at > $2)::int reporters
       FROM requests WHERE region_code=$1 AND is_actionable AND admin_name IS NOT NULL GROUP BY 1`,
    [region, since],
  );
  const hot = await q<{ admin: string; hotspots: number; top: string }>(
    `SELECT c.admin_name admin, count(*) FILTER (WHERE s.is_hotspot)::int hotspots,
            (array_agg(s.category ORDER BY s.request_count_90d DESC))[1] top
       FROM cell_scores s JOIN h3_cells c USING (region_code, h3_cell) WHERE s.region_code=$1 GROUP BY 1`,
    [region],
  );
  const cats = await q<{ admin: string; category: string; n: number }>(
    `SELECT admin_name admin, category, count(*)::int n FROM requests WHERE region_code=$1 AND is_actionable AND submitted_at > $2 AND admin_name IS NOT NULL GROUP BY 1,2`,
    [region, since],
  );
  const fb = await q<{ admin: string; sat: number; n: number }>(
    `SELECT r.admin_name admin, avg(CASE f.solved WHEN 'yes' THEN 1 WHEN 'partly' THEN 0.5 ELSE 0 END)::float8 sat, count(*)::int n
       FROM citizen_feedback f JOIN requests r ON r.id=f.request_id WHERE f.region_code=$1 GROUP BY 1`,
    [region],
  );
  const zones = pops.map((p) => {
    const r = reqs.find((x) => x.admin === p.admin) ?? { n90: 0, critical: 0, open: 0, total: 0, resolved: 0, reporters: 0 };
    const h = hot.find((x) => x.admin === p.admin);
    const topCats = cats.filter((c) => c.admin === p.admin).sort((a, b) => b.n - a.n).slice(0, 3);
    const f = fb.find((x) => x.admin === p.admin);
    return {
      zone: p.admin,
      population: Math.round(p.pop),
      cells: p.cells,
      vulnerability: Math.round(p.vuln * 100) / 100,
      complaints90d: r.n90,
      per10k: Math.round((r.n90 / Math.max(1, p.pop)) * 1e4 * 10) / 10,
      criticalShare: r.n90 ? Math.round((r.critical / r.n90) * 100) / 100 : 0,
      openComplaints: r.open,
      resolvedShare: r.total ? Math.round((r.resolved / r.total) * 100) / 100 : 0,
      reporters90d: r.reporters,
      hotspotCells: h?.hotspots ?? 0,
      topCategories: topCats.map((c) => ({ category: c.category, n: c.n })),
      satisfaction: f ? Math.round(f.sat * 100) / 100 : null,
      feedbackCount: f?.n ?? 0,
    };
  });
  // Need score (0-100): complaint intensity 35%, critical share 20%, hotspot share 25%, unresolved backlog 20%.
  const pr = (xs: number[]) => pctRank(xs);
  const a = pr(zones.map((z) => z.per10k));
  const b = pr(zones.map((z) => z.criticalShare));
  const c = pr(zones.map((z) => z.hotspotCells / Math.max(1, z.cells)));
  const d = pr(zones.map((z) => z.openComplaints / Math.max(1, z.population) ));
  const scored = zones.map((z, i) => {
    const need = Math.round((0.35 * a[i] + 0.2 * b[i] + 0.25 * c[i] + 0.2 * d[i]) * 100);
    // Service rating (1-5 stars): how well the zone is being served, from resolution and citizen satisfaction.
    const serviceRaw = 0.5 * z.resolvedShare + 0.3 * (z.satisfaction ?? z.resolvedShare) + 0.2 * (1 - a[i]);
    return { ...z, needScore: need, serviceStars: Math.max(1, Math.min(5, Math.round((1 + serviceRaw * 4) * 2) / 2)) };
  });
  scored.sort((x, y) => y.needScore - x.needScore);
  return scored.map((z, i) => ({ ...z, rank: i + 1, priorityZone: i < Math.max(3, Math.round(scored.length * 0.2)) }));
}

// ---------------------------------------------------------------- government money allocation

export async function allocations(region: string) {
  const reg = getRegion(region);
  let schemes = await schemeSummary(region);
  if (!schemes.length) {
    await syncAllocations(region);
    schemes = await schemeSummary(region);
  }
  const projects = await q(
    `SELECT f.project_ref, coalesce(f.project_title, p.title) title, f.scheme, f.category, f.fy, f.sanctioned, f.released, f.utilised, f.source, f.as_of, p.status, p.admin_name
       FROM fund_allocations f LEFT JOIN planned_projects p ON p.region_code=f.region_code AND p.external_ref=f.project_ref
      WHERE f.region_code=$1 ORDER BY f.sanctioned DESC`,
    [region],
  );
  const totals = schemes.reduce(
    (acc, s) => ({ envelope: acc.envelope + s.envelope, sanctioned: acc.sanctioned + s.sanctioned, released: acc.released + s.released, utilised: acc.utilised + s.utilised, headroom: acc.headroom + s.headroom }),
    { envelope: 0, sanctioned: 0, released: 0, utilised: 0, headroom: 0 },
  );
  return { currency: reg.currency, source: schemes[0]?.source ?? "none", totals, schemes, projects };
}

export async function syncAllocationsFor(region: string, s: Session) {
  const res = await syncAllocations(region);
  await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "funds.sync", entity_type: "dataset", entity_id: "fund_allocations", diff: res });
  return res;
}

// ---------------------------------------------------------------- what-if impact simulator (Gemini narrates, numbers are computed)

const WHATIF_SYSTEM = `You advise an Indian Member of Parliament / MLA. You receive JSON with a computed estimate of what happens if a facility is built at a site.
Write a short Markdown briefing (max 220 words) with sections: **Verdict**, **Who benefits**, **Expected impact**, **Is there a better site?**, **Cautions**.
Rules: use ONLY numbers present in the JSON (copy them exactly). Money is in INR; you may write crore/lakh only if the JSON gives it that way (it gives "cost_display").
Be direct and practical. Mention that estimates are indicative and based on synthetic pilot data.`;

export async function whatIf(region: string, body: { type?: string; lat?: number; lng?: number }, s: Session) {
  const type = String(body.type || "") as FacilityType;
  if (!FACILITY_TYPES[type]) throw new ApiError(400, "bad_type", `type must be one of ${Object.keys(FACILITY_TYPES).join(", ")}`);
  const reg = getRegion(region);
  const lat = Number(body.lat),
    lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ApiError(400, "bad_site", "lat and lng required");
  const t = FACILITY_TYPES[type];
  const cat = t.category;
  const weights = await getWeights(region);
  const cellsRaw = await q<{ h3_cell: string; lat: number; lng: number; population: number; vulnerability_index: number; admin_name: string | null; gap: number | null; value: number | null; key: string | null; priority_score: number | null; f_coverage: number | null }>(
    `SELECT c.h3_cell, c.lat, c.lng, c.population, c.vulnerability_index, c.admin_name, i.gap, i.value, i.key, s.priority_score, s.f_coverage
       FROM h3_cells c
       LEFT JOIN cell_indicators i ON i.region_code=c.region_code AND i.h3_cell=c.h3_cell AND i.category=$2
       LEFT JOIN cell_scores s ON s.region_code=c.region_code AND s.h3_cell=c.h3_cell AND s.category=$2
      WHERE c.region_code=$1`,
    [region, cat],
  );
  const complaints = new Map(
    (await q<{ h3_cell: string; n: number }>(
      "SELECT h3_cell, count(*)::int n FROM requests WHERE region_code=$1 AND category=$2 AND is_actionable AND submitted_at > $3 AND h3_cell IS NOT NULL GROUP BY 1",
      [region, cat, new Date(Date.now() - 365 * DAY)],
    )).map((r) => [r.h3_cell, r.n]),
  );
  const cells: WhatIfCell[] = cellsRaw.map((c) => ({
    h3: c.h3_cell, lat: c.lat, lng: c.lng, population: c.population, vuln: c.vulnerability_index, admin: c.admin_name,
    gap: c.gap ?? c.vulnerability_index, distKm: c.key === "km_to_nearest_clinic" ? c.value : null,
    score: c.priority_score ?? 0, F: c.f_coverage ?? 0, complaints12m: complaints.get(c.h3_cell) ?? 0,
  }));
  if (!cells.length) throw new ApiError(404, "no_data", "Region has no data yet");
  // Effect size learned from this city's own completed projects in the same sector (difference-in-differences).
  const impacts = (await impactProjects(region)).filter((p) => p.category === cat && p.impact.pctChange !== null);
  const observed = impacts.length ? -impacts.reduce((a, p) => a + (p.impact.pctChange ?? 0), 0) / impacts.length / 100 : null;
  const peopleShare = CATEGORY_META[cat as Category].peopleShare;
  const area = nearestLocality(reg, lat, lng).loc.name;
  const base = { type, cells, peopleShare, wG: weights.wG, alpha: weights.alpha, observedEffect: observed };
  const result = simulateSite({ ...base, lat, lng, area });

  // Better site? Evaluate every neighbourhood centre and the 25 highest-priority cells for this sector.
  const candidates = [
    ...reg.localities.map((l) => ({ lat: l.lat, lng: l.lng, area: l.name })),
    ...[...cells].sort((a, b) => b.score - a.score).slice(0, 25).map((c) => ({ lat: c.lat, lng: c.lng, area: c.admin })),
  ];
  const alts = candidates.map((c) => simulateSite({ ...base, lat: c.lat, lng: c.lng, area: c.area })).sort((a, b) => b.benefitIndex - a.benefitIndex);
  const best = alts[0];
  const betterSite = best && best.benefitIndex > result.benefitIndex * 1.15 ? best : null;
  const siteRankPct = Math.round((alts.filter((a) => a.benefitIndex <= result.benefitIndex).length / alts.length) * 100);

  const crore = (x: number) => `₹${(x / 1e7).toFixed(x >= 1e8 ? 0 : 2)} crore`;
  const payload = {
    facility: result.label,
    city: reg.name,
    site_area: area,
    catchment_radius_km: t.radiusKm,
    catchment_population: result.catchmentPopulation,
    people_benefiting: result.peopleBenefiting,
    people_newly_within_standard: result.newlyWithinStandard,
    access_standard_km: result.standardKm,
    mean_distance_before_km: result.meanDistanceBeforeKm,
    mean_distance_after_km: result.meanDistanceAfterKm,
    infrastructure_gap_before: result.meanGapBefore,
    infrastructure_gap_after: result.meanGapAfter,
    priority_score_before: result.priorityBefore,
    priority_score_after: result.priorityAfter,
    complaints_last_12_months_in_catchment: result.complaints12m,
    expected_complaints_avoided_per_year: result.expectedComplaintsAvoidedPerYear,
    observed_effect_percent_from_past_projects: result.observedEffectPct,
    cost_display: crore(result.costInr),
    cost_per_beneficiary_inr: result.costPerBeneficiaryInr,
    mean_vulnerability_catchment: result.meanVulnerability,
    mean_vulnerability_city: result.regionMeanVulnerability,
    site_percentile_among_candidates: siteRankPct,
    better_site: betterSite ? { area: betterSite.site.area, people_benefiting: betterSite.peopleBenefiting, people_newly_within_standard: betterSite.newlyWithinStandard } : null,
  };

  let narrative = templateNarrative(payload);
  let model = "template (offline)";
  let unverified: string[] = [];
  if (hasLLM()) {
    try {
      const r = await chat({ prefer: "gemini", messages: [{ role: "system", content: WHATIF_SYSTEM }, { role: "user", content: JSON.stringify(payload, null, 2) }], temperature: 0.2, maxTokens: 700 });
      const bad = unverifiedNumbers(r.text, payload);
      if (r.text.trim()) {
        narrative = r.text.trim();
        model = `${r.provider}:${r.model}`;
        unverified = bad;
      }
    } catch (e) {
      model = `template (offline; ${String((e as Error).message).slice(0, 80)})`;
    }
  }
  await appendAudit({ user_id: s.sub, user_email: s.email, region_code: region, action: "whatif.run", entity_type: "simulation", entity_id: type, diff: { lat: result.site.lat, lng: result.site.lng, area, people: result.peopleBenefiting } });
  return { ...result, siteRankPct, betterSite, narrative, model, unverifiedNumbers: unverified, costDisplay: payload.cost_display, categoryLabel: catLabel(cat) };
}

function templateNarrative(p: Record<string, unknown> & { better_site: { area: string | null; people_benefiting: number } | null }): string {
  const lines = [
    `**Verdict:** A ${String(p.facility).toLowerCase()} in ${p.site_area} would serve about ${Number(p.people_benefiting).toLocaleString("en-IN")} people within ${p.catchment_radius_km} km, at ${p.cost_display} (≈ ₹${Number(p.cost_per_beneficiary_inr).toLocaleString("en-IN")} per beneficiary).`,
    ``,
    `**Who benefits:** ${Number(p.people_newly_within_standard).toLocaleString("en-IN")} people would newly be within the ${p.access_standard_km} km access standard. Mean vulnerability in the catchment is ${p.mean_vulnerability_catchment} vs ${p.mean_vulnerability_city} for the city.`,
    ``,
    `**Expected impact:** the infrastructure gap falls from ${p.infrastructure_gap_before} to ${p.infrastructure_gap_after}${p.mean_distance_before_km !== null ? ` (average distance ${p.mean_distance_before_km} km → ${p.mean_distance_after_km} km)` : ""}; priority score ${p.priority_score_before} → ${p.priority_score_after}. Citizens filed ${p.complaints_last_12_months_in_catchment} related complaints here in 12 months; about ${p.expected_complaints_avoided_per_year} per year could be avoided (based on a ${p.observed_effect_percent_from_past_projects}% drop after similar completed projects).`,
    ``,
    p.better_site
      ? `**Is there a better site?** Yes: ${p.better_site.area} would benefit about ${p.better_site.people_benefiting.toLocaleString("en-IN")} people. This site ranks in the ${p.site_percentile_among_candidates}th percentile of candidate sites.`
      : `**Is there a better site?** This site ranks in the ${p.site_percentile_among_candidates}th percentile of candidate sites; no clearly better location was found.`,
    ``,
    `**Cautions:** estimates are indicative, based on synthetic pilot data and unit costs; land availability, staffing and operating costs are not modelled.`,
  ];
  return lines.join("\n");
}

export { cellToLatLng };
