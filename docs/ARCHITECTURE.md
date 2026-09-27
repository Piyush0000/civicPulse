# Architecture

## Components

| Layer | Where | Notes |
|---|---|---|
| Web app + API | `src/app`, `src/server/router.ts` | Next.js 16. One catch-all route handler dispatches a typed route table (45+ endpoints) with RBAC per route and generates `/api/v1/openapi.json`. |
| DB access | `src/lib/db` | A single `Db` interface over **PGlite** (embedded WASM Postgres, default) or **postgres.js** (Supabase/any Postgres via `DATABASE_URL`). The idempotent schema is applied on boot. |
| Intake | `src/lib/pipeline.ts` | `intake()` stores the raw message, dedupes webhook retries on `(channel, external_message_id)` and returns a tracking code immediately. `processRequest()` runs after the response via `after()`. |
| AI providers | `src/lib/ai` | `llm.ts`: Groq → Gemini (both OpenAI-compatible) → rules. `speech.ts`: Groq Whisper → Gemini audio → browser Web Speech transcript; translation LLM → MyMemory. `extract.ts`: zod-validated JSON with one retry, then a safe fallback. `embed.ts`: deterministic hashed n-gram embeddings on the English pivot. |
| Geo | `src/lib/geo.ts`, `src/lib/geocode.ts` | H3 (res 8) grid; region = H3 disc minus a water mask. Geocoding: explicit pin → gazetteer (exact, local script, fuzzy) → Nominatim (cached, 1 rps) → "unlocated" queue. |
| Analytics | `src/lib/analytics` | `scoring.ts` (priority formula, anti-gaming, Gi* with conditional permutations, Poisson emerging test), `clustering.ts` (online assignment), `recommendations.ts` (connected components, split to ≤ 25 cells, fingerprint + Jaccard upsert that preserves decisions), `insights.ts` (DiD impact, forecast, optimizer), `engine.ts` (DB I/O, briefs). |
| RAG | `src/lib/rag.ts` | 120-word chunks with 25-word overlap, cosine retrieval, `[D#]` citations. |
| Realtime | `src/lib/events.ts` | In-process bus → SSE (`/api/v1/stream`, coarsened to res-7 for anonymous viewers) and Supabase Realtime broadcast when configured. |
| Channels | `src/lib/messaging` | Telegram (long polling or webhook, consent flow in 5 languages, `STOP`, `/status`, `/city`), USSD (`/intake/ussd`), IVR (`/intake/ivr`). |
| Trust | `src/lib/ledger.ts`, `src/lib/privacy.ts`, `src/lib/retention.ts` | SHA-256 hash-chained audit log, HMAC pseudonyms, AES-256-GCM contacts, regex + LLM name redaction, retention cleanup. |
| Synthetic world | `src/lib/seed` | Deterministic cities, population, facilities, indicators, projects, documents and ~14k multilingual requests with planted scenarios. |

## Pipeline states

`received → transcribed → translated → extracted → geocoded → completed` (or `failed` with the error recorded).
Each step appends `{step, ms, info}` to `pipeline_log`, which the request drawer shows as an "AI pipeline trace".
Re-running `processRequest` is idempotent: it rewrites the same fields.

## Periodic work without a queue

- After every completed intake: a debounced recompute per region (4 s debounce, at most every 15 s).
- On settings change or analyst correction: an immediate or debounced recompute.
- Every 12 h (long-running server) or via `POST /admin/retention` (serverless cron): the retention cleanup.
- A full-region recompute takes about 0.4–2 s (1,300 cells × 12 categories, Gi* with 199 permutations).

## Scaling notes

- Postgres is the only state; the app is stateless apart from the SSE bus, which Supabase Realtime replaces.
- For a national rollout: partition `requests` by region, move the recompute to a worker (the engine functions are pure and queue-ready), and switch embeddings to pgvector once a semantic model is used.
