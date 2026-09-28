import type { Category } from "./categories";
import { config } from "./config";
import { bulkInsert, getDb, q, type Db } from "./db";
import { getRegion } from "./regions";
import { hashString, rng } from "./stats";

// Government money-allocation integration ("follow the money").
// Provider chain:
//   1. ALLOCATION_API_URL: a state/municipal finance API (PFMS / IFMS style) returning
//      [{ scheme, project_ref, project_title?, category?, fy, sanctioned, released, utilised }] (INR).
//   2. DATA_GOV_IN_API_KEY + DATA_GOV_IN_RESOURCE: Open Government Data platform (data.gov.in) resource
//      with the same fields (mapped case-insensitively).
//   3. Synthetic PFMS-like ledger generated from the planned projects (offline demo).

export const SCHEMES: Record<Category, { scheme: string; ministry: string }> = {
  water_supply: { scheme: "AMRUT 2.0 / Jal Jeevan Mission (Urban)", ministry: "MoHUA / Jal Shakti" },
  sanitation_drainage: { scheme: "Swachh Bharat Mission (Urban) 2.0", ministry: "MoHUA" },
  waste_management: { scheme: "Swachh Bharat Mission (Urban) 2.0", ministry: "MoHUA" },
  roads_transport: { scheme: "Smart Cities / State Roads Fund", ministry: "MoHUA / State PWD" },
  electricity: { scheme: "Revamped Distribution Sector Scheme (RDSS)", ministry: "Ministry of Power" },
  health: { scheme: "PM-ABHIM / National Health Mission (Urban)", ministry: "MoHFW" },
  education: { scheme: "Samagra Shiksha", ministry: "Ministry of Education" },
  housing: { scheme: "PMAY-Urban 2.0", ministry: "MoHUA" },
  public_safety_lighting: { scheme: "Nirbhaya Fund / Street Lighting National Programme", ministry: "MHA / MoP" },
  digital_connectivity: { scheme: "BharatNet / Digital India", ministry: "MeitY / DoT" },
  agriculture_irrigation: { scheme: "PM Krishi Sinchayee Yojana", ministry: "Jal Shakti" },
  other: { scheme: "Municipal General Fund", ministry: "Urban Local Body" },
};

export function currentFy(d = new Date()): string {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

type AllocRow = { scheme: string; project_ref: string; project_title?: string; category?: string; fy: string; sanctioned: number; released: number; utilised: number };

async function fromApi(url: string, headers: Record<string, string> = {}): Promise<AllocRow[]> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`allocation API ${res.status}`);
  const body = (await res.json()) as unknown;
  const list = (Array.isArray(body) ? body : ((body as { records?: unknown[] }).records ?? [])) as Record<string, unknown>[];
  const get = (o: Record<string, unknown>, k: string) => o[Object.keys(o).find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === k) ?? k];
  return list
    .map((o) => ({
      scheme: String(get(o, "scheme") ?? "Unknown scheme"),
      project_ref: String(get(o, "projectref") ?? get(o, "projectid") ?? ""),
      project_title: get(o, "projecttitle") ? String(get(o, "projecttitle")) : undefined,
      category: get(o, "category") ? String(get(o, "category")) : undefined,
      fy: String(get(o, "fy") ?? get(o, "financialyear") ?? currentFy()),
      sanctioned: Number(get(o, "sanctioned") ?? 0),
      released: Number(get(o, "released") ?? 0),
      utilised: Number(get(o, "utilised") ?? get(o, "expenditure") ?? 0),
    }))
    .filter((r) => r.project_ref);
}

/** Synthetic PFMS-like ledger: release and utilisation follow project status (illustrative). */
export function syntheticAllocations(
  regionCode: string,
  projects: { ref: string; title: string; category: string; status: string; budgetLocal: number }[],
  now = new Date(),
): { rows: AllocRow[]; envelopes: { scheme: string; envelope: number }[] } {
  const r = rng(hashString(regionCode + ":funds"));
  const fy = currentFy(now);
  const rows: AllocRow[] = [];
  const byScheme = new Map<string, number>();
  for (const p of projects) {
    const scheme = SCHEMES[p.category as Category]?.scheme ?? SCHEMES.other.scheme;
    const releasedShare = p.status === "completed" ? 1 : p.status === "in_progress" ? 0.4 + r.next() * 0.4 : p.status === "approved" ? r.next() * 0.25 : 0;
    const utilShare = p.status === "completed" ? 0.9 + r.next() * 0.1 : p.status === "in_progress" ? 0.5 + r.next() * 0.4 : 0.3 * r.next();
    const released = Math.round(p.budgetLocal * releasedShare);
    rows.push({ scheme, project_ref: p.ref, project_title: p.title, category: p.category, fy, sanctioned: Math.round(p.budgetLocal), released, utilised: Math.round(released * utilShare) });
    if (p.status !== "completed") byScheme.set(scheme, (byScheme.get(scheme) ?? 0) + p.budgetLocal);
  }
  // Scheme envelopes: committed + some unallocated headroom (roads schemes are nearly exhausted).
  const envelopes = [...new Set(Object.values(SCHEMES).map((s) => s.scheme))].map((scheme) => {
    const committed = byScheme.get(scheme) ?? 0;
    const headroomCr = scheme.includes("Roads") ? 5 + r.next() * 10 : 40 + r.next() * 160; // ₹ crore
    return { scheme, envelope: Math.round(committed + headroomCr * 1e7) };
  });
  return { rows, envelopes };
}

export async function writeAllocations(db: Db, region: string, rows: AllocRow[], envelopes: { scheme: string; envelope: number }[], source: string) {
  const asOf = new Date().toISOString().slice(0, 10);
  await db.query("DELETE FROM fund_allocations WHERE region_code=$1 AND source=$2", [region, source]);
  await bulkInsert(
    db,
    "fund_allocations",
    ["region_code", "scheme", "category", "project_ref", "project_title", "fy", "sanctioned", "released", "utilised", "source", "as_of"],
    rows.map((x) => [region, x.scheme, x.category ?? null, x.project_ref, x.project_title ?? null, x.fy, x.sanctioned, x.released, x.utilised, source, asOf]),
    { onConflict: "ON CONFLICT (region_code, scheme, project_ref, fy) DO UPDATE SET sanctioned=EXCLUDED.sanctioned, released=EXCLUDED.released, utilised=EXCLUDED.utilised, source=EXCLUDED.source, as_of=EXCLUDED.as_of" },
  );
  if (envelopes.length) {
    await bulkInsert(
      db,
      "scheme_envelopes",
      ["region_code", "scheme", "fy", "envelope", "source"],
      envelopes.map((e) => [region, e.scheme, currentFy(), e.envelope, source]),
      { onConflict: "ON CONFLICT (region_code, scheme, fy) DO UPDATE SET envelope=EXCLUDED.envelope, source=EXCLUDED.source" },
    );
  }
  await db.query("UPDATE planned_projects p SET scheme=f.scheme FROM fund_allocations f WHERE f.region_code=$1 AND p.region_code=$1 AND p.external_ref=f.project_ref", [region]);
}

/** Pull from the configured government API (or regenerate the synthetic ledger). */
export async function syncAllocations(region: string): Promise<{ source: string; rows: number }> {
  const db = await getDb();
  if (config.allocationApiUrl) {
    const rows = await fromApi(`${config.allocationApiUrl}${config.allocationApiUrl.includes("?") ? "&" : "?"}region=${region}`);
    await writeAllocations(db, region, rows, [], "govt-api");
    return { source: "govt-api", rows: rows.length };
  }
  if (config.dataGovInKey && process.env.DATA_GOV_IN_RESOURCE) {
    const url = `https://api.data.gov.in/resource/${process.env.DATA_GOV_IN_RESOURCE}?api-key=${config.dataGovInKey}&format=json&limit=500&filters[city]=${encodeURIComponent(getRegion(region).name)}`;
    const rows = await fromApi(url);
    await writeAllocations(db, region, rows, [], "data.gov.in");
    return { source: "data.gov.in", rows: rows.length };
  }
  const projects = await q<{ external_ref: string; title: string; category: string; status: string; budget_amount: number }>(
    "SELECT external_ref, title, category, status, budget_amount FROM planned_projects WHERE region_code=$1",
    [region],
  );
  const { rows, envelopes } = syntheticAllocations(region, projects.map((p) => ({ ref: p.external_ref, title: p.title, category: p.category, status: p.status, budgetLocal: p.budget_amount })));
  await writeAllocations(db, region, rows, envelopes, "synthetic PFMS-like");
  return { source: "synthetic PFMS-like", rows: rows.length };
}

export type SchemeSummary = { scheme: string; envelope: number; sanctioned: number; released: number; utilised: number; headroom: number; projects: number; source: string };

export async function schemeSummary(region: string): Promise<SchemeSummary[]> {
  const rows = await q<SchemeSummary>(
    `SELECT s.scheme, s.envelope, coalesce(sum(f.sanctioned),0)::float8 sanctioned, coalesce(sum(f.released),0)::float8 released,
            coalesce(sum(f.utilised),0)::float8 utilised, count(f.id)::int projects, s.source,
            greatest(0, s.envelope - coalesce(sum(f.sanctioned) FILTER (WHERE p.status IS DISTINCT FROM 'completed'),0))::float8 headroom
       FROM scheme_envelopes s
       LEFT JOIN fund_allocations f ON f.region_code=s.region_code AND f.scheme=s.scheme AND f.fy=s.fy
       LEFT JOIN planned_projects p ON p.region_code=f.region_code AND p.external_ref=f.project_ref
      WHERE s.region_code=$1 GROUP BY s.scheme, s.envelope, s.source ORDER BY s.envelope DESC`,
    [region],
  );
  return rows;
}
