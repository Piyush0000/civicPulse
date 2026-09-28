import { after, type NextRequest } from "next/server";
import { ApiError, ok, page, rateLimit, regionParam } from "@/lib/api";
import { can, currentSession, login, SESSION_COOKIE, signSession, type Perm, type Session } from "@/lib/auth";
import { config } from "@/lib/config";
import { bus, type PulseEvent } from "@/lib/events";
import { intake, processRequest } from "@/lib/pipeline";
import { handleTelegramUpdate } from "@/lib/messaging/telegram";
import { verifyLedger } from "@/lib/ledger";
import { seedAll } from "@/lib/seed/run";
import { DEFAULT_WEIGHTS } from "@/lib/analytics/scoring";
import { getWeights, recomputeRegion } from "@/lib/analytics/engine";
import { getRegion, REGION_BY_CODE } from "@/lib/regions";
import { cellDetail, coarse, listRequests, mapCells, mapLayers, overview, patchRequest, requestDetail } from "./services/dashboard";
import {
  auditLog, bricsCompare, budgetAlignment, decideRecommendation, federationAggregate, forecast, impactProjects, listRecommendations,
  optimize, platformMetrics, previewWeights, recommendationDetail, regenerateBrief, saveWeights,
} from "./services/planning";
import { askCopilot, COPILOT_SUGGESTIONS } from "./services/copilot";
import {
  datasets, exportCells, exportRecommendations, publicRegions, publicStats, simulateWave, systemStatus, trackRequest, transparency,
  uploadDocument, uploadProjectsCsv, ussd,
} from "./services/public";

type Ctx = { req: NextRequest; params: Record<string, string>; session: Session | null; region: () => string };
type Handler = (c: Ctx) => Promise<Response | unknown>;
type Route = { method: string; path: string; perm: Perm | null; summary: string; handler: Handler; tag: string };

const routes: Route[] = [];
const def = (tag: string) => (method: string, path: string, perm: Perm | null, summary: string, handler: Handler) =>
  routes.push({ method, path, perm, summary, handler, tag });

const body = async <T = Record<string, unknown>>(req: NextRequest): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "bad_json", "Request body must be JSON");
  }
};

// ---------------------------------------------------------------- system
const sys = def("system");
sys("GET", "/health", null, "Liveness probe", async () => ({ ok: true, time: new Date().toISOString() }));
sys("GET", "/system/status", null, "Providers in use, seed progress, counts", async () => systemStatus());
sys("GET", "/openapi.json", null, "This API description", async () => openapi());
sys("POST", "/admin/seed", "seed", "Wipe and regenerate the synthetic demo world", async () => {
  after(() => seedAll({ reset: true }).catch((e) => console.error(e)));
  return { started: true };
});
sys("POST", "/admin/retention", "seed", "Run the privacy retention cleanup now", async () => (await import("@/lib/retention")).retentionCleanup());
sys("POST", "/admin/recompute", "tuneScoring", "Recompute scores, hotspots and recommendations for a region", async ({ region }) =>
  recomputeRegion(region(), { briefsTopN: 5, useLLM: false }),
);

// ---------------------------------------------------------------- auth
const auth = def("auth");
auth("POST", "/auth/login", null, "Email + password login (sets an httpOnly session cookie)", async ({ req }) => {
  rateLimit(req, "login", 10);
  const b = await body<{ email: string; password: string }>(req);
  const s = await login(String(b.email || ""), String(b.password || ""));
  if (!s) throw new ApiError(401, "bad_credentials", "Invalid email or password");
  const token = await signSession(s);
  const res = ok({ user: s });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 12 * 3600 });
  return res;
});
auth("POST", "/auth/logout", null, "Clear session", async () => {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
auth("GET", "/auth/me", "view", "Current user", async ({ session }) => ({ user: session }));

// ---------------------------------------------------------------- public (citizens)
const pub = def("public");
pub("GET", "/public/regions", null, "Pilot regions and languages", async () => publicRegions());
pub("POST", "/public/requests", null, "Submit a request (multipart: text?, audio?, transcript?, language?, lat?, lng?, region_code, consent=true)", async ({ req }) => {
  rateLimit(req, "submit", 15);
  const form = await req.formData();
  if (form.get("consent") !== "true") throw new ApiError(400, "consent_required", "Consent is required");
  const region = String(form.get("region_code") || "");
  if (!REGION_BY_CODE[region]) throw new ApiError(400, "bad_region", "Unknown region");
  let text = String(form.get("text") || "").slice(0, 4000);
  const transcript = String(form.get("transcript") || "").slice(0, 4000);
  const audio = form.get("audio");
  let audioData: { data: Buffer; mime: string } | null = null;
  if (audio && typeof audio !== "string" && audio.size > 0) {
    if (audio.size > 8 * 1024 * 1024) throw new ApiError(413, "too_large", "Audio must be under 8 MB");
    audioData = { data: Buffer.from(await audio.arrayBuffer()), mime: audio.type || "audio/webm" };
  }
  if (!text && !audioData && !transcript) throw new ApiError(400, "empty", "Provide text or a voice note");

  const photo = form.get("photo");
  let photoUrl: string | null = null;
  if (photo && typeof photo !== "string" && photo.size > 0) {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "hglonsuu",
      api_key: process.env.CLOUDINARY_API_KEY || "344452153514944",
      api_secret: process.env.CLOUDINARY_API_SECRET || "tQsLfT1364ddMuNCb6DZPb5IJiY",
    });
    const buffer = Buffer.from(await photo.arrayBuffer());
    const b64 = buffer.toString("base64");
    const dataUri = `data:${photo.type || "image/jpeg"};base64,${b64}`;
    try {
      const res = await cloudinary.uploader.upload(dataUri, { folder: "civicpulse_reports" });
      photoUrl = res.secure_url;
    } catch (e) {
      console.error("Cloudinary upload failed", e);
    }
  }

  if (photoUrl) {
    text = [text, `[Attached Photo](${photoUrl})`].filter(Boolean).join("\n\n");
  }

  const lat = form.get("lat") ? Number(form.get("lat")) : null;
  const lng = form.get("lng") ? Number(form.get("lng")) : null;
  const anon = req.cookies.get("cp_anon")?.value || crypto.randomUUID();
  const res = await intake({
    region,
    channel: "web",
    externalUserId: `web:${anon}`,
    externalMessageId: String(form.get("client_id") || "") || null,
    text: text || null,
    transcriptHint: transcript || null,
    audio: audioData,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    language: (form.get("language") as string) || null,
  });
  if (!res.duplicate) after(() => processRequest(res.requestId));
  const out = ok({ tracking_code: res.trackingCode, duplicate: res.duplicate });
  out.cookies.set("cp_anon", anon, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return out;
});
pub("GET", "/public/requests/:code", null, "Track a request (no PII)", async ({ params }) => trackRequest(params.code));
pub("GET", "/public/stats/:region", null, "k-anonymous public aggregates (res-7 grid)", async ({ params }) => publicStats(getRegion(params.region).code));
pub("GET", "/public/transparency", null, "Public decision log and ledger verification", async () => transparency());
pub("GET", "/ledger/verify", null, "Verify the SHA-256 hash chain of the audit log", async () => verifyLedger());
pub("GET", "/federation/aggregate/:region", null, "Signed aggregate-only federation payload for one instance", async ({ params }) => federationAggregate(getRegion(params.region).code));
pub("GET", "/stream", null, "Live Pulse server-sent events (coarsened for anonymous viewers)", async ({ req, session }) => stream(req, session));

// ---------------------------------------------------------------- channels / webhooks
const ch = def("channels");
ch("POST", "/webhooks/telegram/:secret", null, "Telegram webhook (webhook mode)", async ({ req, params }) => {
  if (params.secret !== config.telegramWebhookSecret) throw new ApiError(403, "bad_secret", "Invalid webhook secret");
  const update = await body(req);
  after(() => handleTelegramUpdate(update as never));
  return { ok: true };
});
ch("POST", "/intake/ivr", null, "IVR recording intake (X-Intake-Key; multipart: audio, caller, region)", async ({ req }) => {
  if (req.headers.get("x-intake-key") !== config.intakeKey) throw new ApiError(401, "bad_key", "Invalid X-Intake-Key");
  const form = await req.formData();
  const audio = form.get("audio");
  if (!audio || typeof audio === "string") throw new ApiError(400, "no_audio", "audio file required");
  const res = await intake({
    region: getRegion(String(form.get("region") || "")).code,
    channel: "ivr",
    externalUserId: String(form.get("caller") || "unknown"),
    externalMessageId: String(form.get("call_id") || "") || null,
    audio: { data: Buffer.from(await audio.arrayBuffer()), mime: audio.type || "audio/wav" },
    transcriptHint: (form.get("transcript") as string) || null,
    language: (form.get("language") as string) || null,
  });
  after(() => processRequest(res.requestId));
  return { tracking_code: res.trackingCode };
});
ch("POST", "/intake/ussd", null, "USSD gateway callback (Africa's Talking format; returns CON/END text)", async ({ req }) => {
  rateLimit(req, "ussd", 60);
  const ct = req.headers.get("content-type") || "";
  const b = ct.includes("json") ? await body<Record<string, string>>(req) : Object.fromEntries((await req.formData()).entries());
  const text = await ussd({ sessionId: String(b.sessionId), phoneNumber: String(b.phoneNumber), text: String(b.text ?? ""), region: String(b.region || "") || undefined });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
});

// ---------------------------------------------------------------- dashboard
const dash = def("dashboard");
dash("GET", "/overview", "view", "KPIs, trends, top recommendations, pipeline health", async ({ region }) => overview(region()));
dash("GET", "/requests", "view", "Filterable, paginated request list", async ({ req, region }) => {
  const sp = req.nextUrl.searchParams;
  return listRequests(
    region(),
    {
      category: sp.get("category"), urgency: sp.get("urgency"), status: sp.get("status"), channel: sp.get("channel"), language: sp.get("language"),
      q: sp.get("q"), from: sp.get("from"), to: sp.get("to"), h3: sp.get("h3"), cluster: sp.get("cluster_id"), pipeline: sp.get("pipeline"),
      unlocated: sp.get("unlocated") === "true", live: sp.get("live") === "true",
    },
    page(req),
  );
});
dash("GET", "/requests/:id", "view", "Request detail with cluster siblings", async ({ params, region }) => requestDetail(region(), params.id));
dash("PATCH", "/requests/:id", "editRequests", "Analyst override: category, urgency, status, pin (audited)", async ({ req, params, region, session }) =>
  patchRequest(region(), params.id, await body(req), session!),
);
dash("GET", "/map/cells", "view", "Compact H3 values for a category + metric", async ({ req, region }) =>
  mapCells(region(), req.nextUrl.searchParams.get("category") || "all", req.nextUrl.searchParams.get("metric") || "priority"),
);
dash("GET", "/map/cells/:h3", "view", "Why-this-score breakdown for one cell", async ({ params, region }) => cellDetail(region(), params.h3));
dash("GET", "/map/layers", "view", "Facilities, projects, recommendation areas, recent requests", async ({ region }) => mapLayers(region()));
dash("GET", "/recommendations", "view", "Ranked recommendations", async ({ req, region }) =>
  listRecommendations(region(), { category: req.nextUrl.searchParams.get("category"), status: req.nextUrl.searchParams.get("status"), all: req.nextUrl.searchParams.get("all") === "true" }),
);
dash("GET", "/recommendations/:id", "view", "Recommendation detail, evidence and latest brief", async ({ params, region }) => recommendationDetail(region(), params.id));
dash("PATCH", "/recommendations/:id", "decideRecommendations", "Accept / reject / defer (writes to the hash-chained ledger)", async ({ req, params, region, session }) =>
  decideRecommendation(region(), params.id, await body(req), session!),
);
dash("POST", "/recommendations/:id/brief", "view", "Regenerate the AI policy brief", async ({ params, region, session }) => regenerateBrief(region(), params.id, session!));
dash("GET", "/budget/alignment", "view", "Demand share vs investment share", async ({ region }) => budgetAlignment(region()));
dash("GET", "/impact/projects", "view", "Before/after + control for completed projects", async ({ region }) => impactProjects(region()));
dash("GET", "/impact/platform-metrics", "view", "DPI metrics of the platform itself", async ({ region }) => platformMetrics(region()));
dash("GET", "/forecast", "view", "3-month category forecast and emerging hotspots", async ({ region }) => forecast(region()));
dash("POST", "/optimizer", "view", "Budget optimizer with equity floor", async ({ req, region }) => {
  const b = await body<{ budgetUsd?: number; equityShare?: number }>(req);
  return optimize(region(), Math.max(0, Number(b.budgetUsd) || 5_000_000), Math.min(1, Math.max(0, Number(b.equityShare ?? 0.4))));
});
dash("POST", "/copilot", "view", "Ask CivicPulse (tool-using policy copilot)", async ({ req, region }) => {
  rateLimit(req, "copilot", 30);
  const b = await body<{ question: string; history?: { role: "user" | "assistant"; content: string }[] }>(req);
  if (!b.question?.trim()) throw new ApiError(400, "empty", "question required");
  return askCopilot(region(), b.question.slice(0, 500), b.history ?? []);
});
dash("GET", "/copilot/suggestions", "view", "Example questions", async () => COPILOT_SUGGESTIONS);
dash("GET", "/brics/compare", "view", "Cross-country aggregate comparison", async () => bricsCompare());
dash("GET", "/settings/scoring", "view", "Scoring weights", async ({ region }) => ({ weights: await getWeights(region()), defaults: DEFAULT_WEIGHTS }));
dash("PUT", "/settings/scoring", "tuneScoring", "Save weights and recompute", async ({ req, region, session }) => saveWeights(region(), await body(req), session!));
dash("POST", "/settings/scoring/preview", "view", "Top-10 ranking under candidate weights (not saved)", async ({ req, region }) => previewWeights(region(), await body(req)));
dash("GET", "/datasets", "view", "Datasets, sources and freshness", async ({ region }) => datasets(region()));
dash("POST", "/datasets/projects", "manageDatasets", "Upload planned-projects CSV", async ({ req, region, session }) => uploadProjectsCsv(region(), await req.text(), session!));
dash("POST", "/datasets/documents", "manageDatasets", "Upload a plan/budget document (text) for RAG", async ({ req, region, session }) => uploadDocument(region(), await body(req), session!));
dash("POST", "/datasets/ivr-test", "view", "IVR simulator (dashboard upload)", async ({ req, region }) => {
  const form = await req.formData();
  const audio = form.get("audio");
  const res = await intake({
    region: region(),
    channel: "ivr",
    externalUserId: "ivr-simulator",
    audio: audio && typeof audio !== "string" && audio.size ? { data: Buffer.from(await audio.arrayBuffer()), mime: audio.type || "audio/wav" } : null,
    transcriptHint: (form.get("transcript") as string) || null,
    text: (form.get("text") as string) || null,
  });
  after(() => processRequest(res.requestId));
  return { tracking_code: res.trackingCode, id: res.requestId };
});
dash("POST", "/simulate/wave", "view", "Demo: stream synthetic citizens through the real pipeline", async ({ req, region }) => {
  const b = await body<{ count?: number; seconds?: number; category?: string }>(req);
  return simulateWave(region(), Number(b.count) || 12, Math.min(120, Number(b.seconds) || 25), b.category || null);
});
dash("GET", "/audit", "view", "Audit ledger entries", async ({ req }) => auditLog(Math.min(500, Number(req.nextUrl.searchParams.get("limit")) || 200), req.nextUrl.searchParams.get("region")));
dash("GET", "/export/cells.csv", null, "Open data: cell scores (CSV, k-anonymised)", async ({ region }) => file(await exportCells(region(), "csv"), "text/csv", "cells.csv"));
dash("GET", "/export/cells.geojson", null, "Open data: cell scores (GeoJSON, k-anonymised)", async ({ region }) => file(await exportCells(region(), "geojson"), "application/geo+json", "cells.geojson"));
dash("GET", "/export/recommendations.csv", null, "Open data: recommendations (CSV)", async ({ region }) => file(await exportRecommendations(region()), "text/csv", "recommendations.csv"));

function file(content: string, type: string, name: string) {
  return new Response(content, { headers: { "content-type": `${type}; charset=utf-8`, "content-disposition": `attachment; filename="${name}"` } });
}

// ---------------------------------------------------------------- SSE

function stream(req: NextRequest, session: Session | null) {
  const region = req.nextUrl.searchParams.get("region");
  const enc = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream({
    start(controller) {
      const send = (ev: PulseEvent) => {
        if (region && ev.region !== region) return;
        const out = session
          ? ev
          : ev.type === "request"
            ? { type: ev.type, region: ev.region, category: ev.category, urgency: ev.urgency, language: ev.language, channel: ev.channel, h3: coarse(ev.h3), at: ev.at }
            : ev.type === "pipeline"
              ? { type: ev.type, region: ev.region, step: ev.step, at: ev.at }
              : ev;
        controller.enqueue(enc.encode(`data: ${JSON.stringify(out)}\n\n`));
      };
      const ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 15000);
      bus.on("pulse", send);
      controller.enqueue(enc.encode(`retry: 3000\n\n`));
      cleanup = () => {
        clearInterval(ping);
        bus.off("pulse", send);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}

// ---------------------------------------------------------------- dispatch

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export async function dispatch(req: NextRequest, segments: string[]): Promise<Response> {
  const path = "/" + segments.join("/");
  try {
    let methodMismatch = false;
    for (const r of routes) {
      const params = match(r.path, path);
      if (!params) continue;
      if (r.method !== req.method) {
        methodMismatch = true;
        continue;
      }
      const session = await currentSession();
      if (r.perm) {
        if (!session) throw new ApiError(401, "unauthenticated", "Login required");
        if (!can(session, r.perm)) throw new ApiError(403, "forbidden", `Role '${session.role}' is not allowed to ${r.perm}`);
      }
      const out = await r.handler({ req, params, session, region: () => regionParam(req, session) });
      return out instanceof Response ? out : ok(out);
    }
    if (methodMismatch) throw new ApiError(405, "method_not_allowed", `${req.method} not allowed on ${path}`);
    throw new ApiError(404, "not_found", `No route ${req.method} ${path}`);
  } catch (e) {
    const { fail } = await import("@/lib/api");
    return fail(e);
  }
}

function openapi() {
  const paths: Record<string, Record<string, object>> = {};
  for (const r of routes) {
    const p = "/api/v1" + r.path.replace(/:(\w+)/g, "{$1}");
    paths[p] ??= {};
    paths[p][r.method.toLowerCase()] = {
      tags: [r.tag],
      summary: r.summary,
      security: r.perm ? [{ cookieAuth: [] }] : [],
      "x-required-permission": r.perm,
      parameters: [...r.path.matchAll(/:(\w+)/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } })),
      responses: { 200: { description: "OK" }, default: { description: "Error: {error: {code, message, details}}" } },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: `${config.appName} API`, version: "1.0.0", license: { name: "Apache-2.0" } },
    components: { securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: SESSION_COOKIE } } },
    paths,
  };
}
