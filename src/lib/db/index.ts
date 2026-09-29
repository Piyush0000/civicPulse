import { config } from "../config";
import { SCHEMA_SQL } from "./schema";

// One tiny interface over two engines:
//  - Postgres via postgres.js when DATABASE_URL is set (Supabase free tier, Neon, ...)
//  - PGlite (Postgres compiled to WASM, in-process, persisted to .data/pglite) otherwise.
// Both speak the same SQL with $1-style params.

export type Row = Record<string, unknown>;

export interface Db {
  kind: "postgres" | "pglite";
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>;
}

type Globals = { __cpDb?: Promise<Db> };
const g = globalThis as unknown as Globals;

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const fs = await import("node:fs");
  fs.mkdirSync(config.pgliteDir, { recursive: true });
  const pg = await PGlite.create(config.pgliteDir);
  // PGlite is single-connection; serialise work so transactions never interleave.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
  const raw = {
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params as unknown[])).rows,
    exec: async (sql: string) => {
      await pg.exec(sql);
    },
  };
  const db: Db = {
    kind: "pglite",
    query: (sql, params) => serial(() => raw.query(sql, params)),
    exec: (sql) => serial(() => raw.exec(sql)),
    tx: (fn) =>
      serial(async () => {
        await raw.exec("BEGIN");
        const inner: Db = {
          kind: "pglite",
          query: (s, p) => raw.query(s, p),
          exec: (s) => raw.exec(s),
          tx: (f) => f(inner),
        };
        try {
          const out = await fn(inner);
          await raw.exec("COMMIT");
          return out;
        } catch (e) {
          await raw.exec("ROLLBACK");
          throw e;
        }
      }),
  };
  return db;
}

async function createPostgres(url: string): Promise<Db> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, {
    max: 5,
    prepare: false, // Supabase pooler (transaction mode) does not support prepared statements
    idle_timeout: 20,
    types: {
      // Match PGlite: int8 → number (counts and sequences here stay far below 2^53; BigInt would break JSON responses).
      bigint: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
      // Our SQL passes JSON already stringified (`$1::jsonb`); the default serializer would stringify it again and
      // store a JSON *string* instead of an object on real Postgres/Supabase.
      jsonb: {
        to: 3802,
        from: [114, 3802],
        serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)),
        parse: (x: string) => JSON.parse(x),
      },
    },
    onnotice: () => undefined,
  });
  type Sql = typeof sql;
  const wrap = (s: Sql): Db => ({
    kind: "postgres",
    query: async <T>(text: string, params: unknown[] = []) =>
      (await s.unsafe(text, params as never[])) as unknown as T[],
    exec: async (text: string) => {
      await s.unsafe(text);
    },
    tx: async <T>(fn: (q: Db) => Promise<T>) =>
      (await sql.begin(async (t) => fn(wrap(t as unknown as Sql)))) as T,
  });
  return wrap(sql);
}

async function init(): Promise<Db> {
  const db = config.databaseUrl ? await createPostgres(config.databaseUrl) : await createPglite();
  await db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__cpDb) {
    g.__cpDb = init().catch((e) => {
      g.__cpDb = undefined;
      throw e;
    });
  }
  return g.__cpDb;
}

export async function q<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function q1<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

/** Multi-row INSERT in chunks. `rows` are arrays aligned with `columns`. */
export async function bulkInsert(
  db: Db,
  table: string,
  columns: string[],
  rows: unknown[][],
  opts: { onConflict?: string; casts?: Record<string, string> } = {},
): Promise<void> {
  if (!rows.length) return;
  const per = Math.max(1, Math.floor(30000 / columns.length));
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const params: unknown[] = [];
    const tuples = chunk.map((r) => {
      const ph = r.map((v, j) => {
        params.push(v);
        const cast = opts.casts?.[columns[j]];
        return `$${params.length}${cast ? `::${cast}` : ""}`;
      });
      return `(${ph.join(",")})`;
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")} ${opts.onConflict || ""}`,
      params,
    );
  }
}
