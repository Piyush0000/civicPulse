import { NextResponse, type NextRequest } from "next/server";
import { can, currentSession, type Perm, type Session } from "./auth";
import { REGION_BY_CODE, DEFAULT_REGION } from "./regions";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details ?? null } }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: { code: "internal", message: "Internal error", details: String((e as Error)?.message ?? e) } }, { status: 500 });
}

/** Wrap a route handler with consistent errors and (optionally) auth + permission checks. */
export function route<C = unknown>(perm: Perm | null, fn: (req: NextRequest, ctx: C, session: Session | null) => Promise<Response>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      let session: Session | null = null;
      if (perm) {
        session = await currentSession();
        if (!session) throw new ApiError(401, "unauthenticated", "Login required");
        if (!can(session, perm)) throw new ApiError(403, "forbidden", `Role '${session.role}' may not ${perm}`);
      }
      return await fn(req, ctx, session);
    } catch (e) {
      return fail(e);
    }
  };
}

export function regionParam(req: NextRequest, session: Session | null): string {
  const code = req.nextUrl.searchParams.get("region") || DEFAULT_REGION;
  if (!REGION_BY_CODE[code]) throw new ApiError(400, "bad_region", `Unknown region ${code}`);
  if (session && !session.regions.includes(code)) throw new ApiError(403, "region_forbidden", "Not assigned to this region");
  return code;
}

export function page(req: NextRequest) {
  const p = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
  const size = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("page_size") || 50)));
  return { page: p, size, offset: (p - 1) * size };
}

// Minimal fixed-window rate limiter (per instance). Good enough for public endpoints in a pilot.
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(req: NextRequest, key: string, limit = 20, windowMs = 60000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.reset < now) buckets.set(k, { n: 1, reset: now + windowMs });
  else if (++b.n > limit) throw new ApiError(429, "rate_limited", "Too many requests, slow down");
}
