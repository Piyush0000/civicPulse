import { randomUUID } from "node:crypto";
import { writeAllocations, syntheticAllocations } from "../allocations";
import { bulkInsert, getDb, q, q1 } from "../db";
import { appendAudit } from "../ledger";
import { pseudonym } from "../privacy";
import { hashString, rng } from "../stats";

// Demo state for the governance loop: MP endorsement → CM approval → work → citizen verification,
// plus the synthetic fund-allocation ledger. Deterministic per region.

const DAY = 86400000;

export async function seedFunds(region: string) {
  const db = await getDb();
  const projects = await q<{ external_ref: string; title: string; category: string; status: string; budget_amount: number }>(
    "SELECT external_ref, title, category, status, budget_amount FROM planned_projects WHERE region_code=$1",
    [region],
  );
  const { rows, envelopes } = syntheticAllocations(region, projects.map((p) => ({ ref: p.external_ref, title: p.title, category: p.category, status: p.status, budgetLocal: p.budget_amount })));
  await writeAllocations(db, region, rows, envelopes, "synthetic PFMS-like");
}

type Rec = { id: string; title: string; category: string; h3_cells: string[]; rank: number; est_cost_usd: number };

async function approve(region: string, rec: Rec, by: string, daysAgo: number, note: string) {
  const at = new Date(Date.now() - daysAgo * DAY);
  await q("UPDATE recommendations SET status='accepted', decided_by=$2, decided_at=$3, decision_note=$4 WHERE id=$1", [rec.id, by, at, note]);
  const { onApproved } = await import("../../server/services/governance");
  await onApproved(region, rec.id);
  await q("UPDATE requests SET status='linked_to_project' WHERE recommendation_id=$1 AND status IN ('new','under_review')", [rec.id]);
  await appendAudit({ user_email: by, region_code: region, action: "recommendation.accepted", entity_type: "recommendation", entity_id: rec.id, diff: { note, title: rec.title, seeded: true } });
}

export async function seedLifecycle(region: string, users: { cm: string; mp: string; dept: string }) {
  const r = rng(hashString(region + ":lifecycle"));
  const recs = await q<Rec>("SELECT id, title, category, h3_cells, rank, est_cost_usd FROM recommendations WHERE region_code=$1 AND is_active ORDER BY rank LIMIT 8", [region]);
  if (recs.length < 5) return;
  const [r1, r2, r3, r4, r5] = [recs[1], recs[2], recs[3], recs[4], recs[5] ?? recs[0]];

  // #2: endorsed by an MP, waiting for the CM's office.
  await q("UPDATE recommendations SET endorsed_by=$2, endorsed_at=$3 WHERE id=$1", [r1.id, "Priya Sharma (MP)", new Date(Date.now() - 2 * DAY)]);
  await appendAudit({ user_email: users.mp, region_code: region, action: "recommendation.endorsed", entity_type: "recommendation", entity_id: r1.id, diff: { note: "Raised in the district development committee; urgent before monsoon.", seeded: true } });

  // #3: approved, work done 25 days ago, citizens confirm it is fixed → verified.
  await approve(region, r2, users.cm, 70, "Approved under the state basic-services package.");
  await workDone(region, r2, users.dept, 60, 25, "Contractor completed works; site inspected by the executive engineer.");
  await seedFeedback(region, r2.id, [0.75, 0.15, 0.1], r);

  // #4: approved, work in progress.
  await approve(region, r3, users.cm, 30, "Approved; tender floated.");
  await q("UPDATE recommendations SET work_stage='work_started', work_started_at=$2, contractor=$3, work_note=$4 WHERE id=$1", [r3.id, new Date(Date.now() - 12 * DAY), "M/s Nagar Infra Pvt Ltd", "Work order issued; 40% physical progress."]);
  await appendAudit({ user_email: users.dept, region_code: region, action: "work.work_started", entity_type: "recommendation", entity_id: r3.id, diff: { seeded: true } });

  // #5: marked done by the department, but citizens say it is NOT fixed → disputed.
  await approve(region, r4, users.cm, 80, "Approved.");
  await workDone(region, r4, users.dept, 70, 20, "Work reported complete by the zonal office.");
  await seedFeedback(region, r4.id, [0.15, 0.2, 0.65], r);

  void r5;
}

async function workDone(region: string, rec: Rec, by: string, startedDaysAgo: number, doneDaysAgo: number, note: string) {
  await q(
    "UPDATE recommendations SET work_stage='work_done', work_started_at=$2, work_done_at=$3, work_note=$4, contractor=$5 WHERE id=$1",
    [rec.id, new Date(Date.now() - startedDaysAgo * DAY), new Date(Date.now() - doneDaysAgo * DAY), note, "M/s Janseva Constructions"],
  );
  await q("UPDATE requests SET status='resolved', resolved_at=$2 WHERE recommendation_id=$1 AND status <> 'rejected'", [rec.id, new Date(Date.now() - doneDaysAgo * DAY)]);
  await appendAudit({ user_email: by, region_code: region, action: "work.work_done", entity_type: "recommendation", entity_id: rec.id, diff: { note, seeded: true } });
}

const COMMENTS = {
  yes: ["It is working properly now, thank you.", "Finally fixed after months.", "Problem solved in our lane, good work."],
  partly: ["Better than before but still problems on some days.", "Fixed on the main road, not in the inner lanes."],
  no: ["Nothing changed, same problem.", "They came once, the problem is back within a week.", "Work was only done on paper."],
};

async function seedFeedback(region: string, recId: string, mix: [number, number, number], r: ReturnType<typeof rng>) {
  const reqs = await q<{ id: string }>("SELECT id FROM requests WHERE recommendation_id=$1 ORDER BY submitted_at DESC LIMIT 30", [recId]);
  const n = Math.max(3, Math.round(reqs.length * 0.5));
  const rows = reqs.slice(0, n).map((x) => {
    const solved = r.weighted(["yes", "partly", "no"] as const, mix);
    const rating = solved === "yes" ? r.int(4, 5) : solved === "partly" ? r.int(2, 4) : r.int(1, 2);
    return [randomUUID(), recId, x.id, region, solved, rating, r.chance(0.6) ? r.pick(COMMENTS[solved]) : null, true];
  });
  const db = await getDb();
  await bulkInsert(db, "citizen_feedback", ["id", "recommendation_id", "request_id", "region_code", "solved", "rating", "comment", "is_synthetic"], rows, { onConflict: "ON CONFLICT (request_id) DO NOTHING" });
  const { refreshVerdict } = await import("../../server/services/governance");
  await refreshVerdict(recId);
}

/** Give the demo citizen account a history: one complaint awaiting feedback, one in progress, one new. */
export async function seedCitizenHistory(citizenUserId: string, region: string) {
  const ph = pseudonym("web", `citizen:${citizenUserId}`);
  const [rep] = await q<{ id: string }>(
    `INSERT INTO reporters (region_code, pseudonym_hash, preferred_language, consent_given_at) VALUES ($1,$2,'hi',now())
     ON CONFLICT (pseudonym_hash) DO UPDATE SET last_seen_at=now() RETURNING id`,
    [region, ph],
  );
  const pick = async (sql: string) => q1<{ id: string }>(sql, [region]);
  const awaiting = await pick(
    `SELECT r.id FROM requests r JOIN recommendations rec ON rec.id=r.recommendation_id
      WHERE r.region_code=$1 AND r.status='resolved' AND rec.work_stage IN ('work_done','verified')
        AND NOT EXISTS (SELECT 1 FROM citizen_feedback f WHERE f.request_id=r.id) LIMIT 1`,
  );
  const progress = await pick(
    `SELECT r.id FROM requests r JOIN recommendations rec ON rec.id=r.recommendation_id WHERE r.region_code=$1 AND rec.work_stage='work_started' LIMIT 1`,
  );
  const fresh = await pick(`SELECT id FROM requests WHERE region_code=$1 AND status='new' AND is_actionable AND recommendation_id IS NULL ORDER BY submitted_at DESC LIMIT 1`);
  const ids = [awaiting?.id, progress?.id, fresh?.id].filter(Boolean) as string[];
  if (ids.length) await q("UPDATE requests SET reporter_id=$1 WHERE id = ANY($2::uuid[])", [rep.id, ids]);
}
