import { createHash } from "node:crypto";
import { getDb, type Db } from "./db";

// Tamper-evident audit log: every row stores sha256(prev_hash + canonical JSON of the row).
// Changing or deleting any past row breaks every hash after it, which /ledger/verify detects.

export const GENESIS = "0".repeat(64);

export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

export type LedgerEntry = {
  user_email: string | null;
  region_code: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  diff: unknown;
  at: string; // ISO
};

export function entryHash(prev: string, e: LedgerEntry): string {
  return createHash("sha256").update(prev + canonical(e)).digest("hex");
}

export async function appendAudit(
  e: Omit<LedgerEntry, "at"> & { user_id?: string | null },
  db?: Db,
): Promise<{ seq: number; hash: string }> {
  const d = db ?? (await getDb());
  const run = async (t: Db) => {
    const last = await t.query<{ hash: string }>("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1 FOR UPDATE");
    const prev = last[0]?.hash ?? GENESIS;
    const entry: LedgerEntry = {
      user_email: e.user_email,
      region_code: e.region_code,
      action: e.action,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      diff: e.diff ?? {},
      at: new Date().toISOString(),
    };
    const hash = entryHash(prev, entry);
    const rows = await t.query<{ seq: number }>(
      `INSERT INTO audit_log (user_id, user_email, region_code, action, entity_type, entity_id, diff, at, prev_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) RETURNING seq::int AS seq`,
      [e.user_id ?? null, entry.user_email, entry.region_code, entry.action, entry.entity_type, entry.entity_id, JSON.stringify(entry.diff), entry.at, prev, hash],
    );
    return { seq: rows[0].seq, hash };
  };
  return db ? run(db) : d.tx(run);
}

export async function verifyLedger(): Promise<{ ok: boolean; count: number; brokenAt: number | null; head: string }> {
  const db = await getDb();
  const rows = await db.query<{
    seq: number;
    user_email: string | null;
    region_code: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    diff: unknown;
    at: Date | string;
    prev_hash: string;
    hash: string;
  }>("SELECT seq::int AS seq, user_email, region_code, action, entity_type, entity_id, diff, at, prev_hash, hash FROM audit_log ORDER BY seq");
  let prev = GENESIS;
  for (const r of rows) {
    const at = r.at instanceof Date ? r.at.toISOString() : new Date(r.at).toISOString();
    const h = entryHash(prev, {
      user_email: r.user_email,
      region_code: r.region_code,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      diff: r.diff,
      at,
    });
    if (r.prev_hash !== prev || r.hash !== h) return { ok: false, count: rows.length, brokenAt: r.seq, head: prev };
    prev = r.hash;
  }
  return { ok: true, count: rows.length, brokenAt: null, head: prev };
}
