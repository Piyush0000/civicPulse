# CivicPulse: Build Plan (hackathon edition)

Base spec: [SPEC.md](SPEC.md). This plan records how we deviate from it and what we add.

## Hard constraints (from the team)
- **No Docker, no Ollama, no paid services.** Only free, online services with free tiers, and everything
  must still run with zero keys using built-in fallbacks.
- One command to run locally: `npm install && npm run dev`. The DB seeds itself on first boot.

## Stack (replaces spec §6)
| Concern | Spec | Here | Why |
|---|---|---|---|
| App/API | FastAPI + Next.js | **Next.js 16 full-stack** (route handlers under `/api/v1`) | one deployable, free on Vercel |
| DB | Postgres+PostGIS+pgvector in Docker | **Supabase free** (Postgres + pgvector) when `DATABASE_URL` set; otherwise **PGlite** (Postgres compiled to WASM, runs in-process, with pgvector) | no Docker; same SQL both ways |
| Geo | PostGIS | **H3 (h3-js)** + haversine in TS | the whole analysis is on an H3 grid anyway |
| Queue | Celery + Redis | in-process pipeline + `after()`; periodic jobs run on demand and after every intake batch | no Redis to host |
| STT | faster-whisper | **Groq Whisper-large-v3 (free)** → Gemini (free) → browser **Web Speech API** transcript | free, fast, 99 languages |
| LLM | Anthropic/Ollama | **Groq Llama 3.3 70B (free)** → **Gemini Flash (free)** → rule-based mock | both are OpenAI-compatible |
| Embeddings | e5-small local | **Gemini embeddings (free)** → deterministic multilingual char n-gram hashing | |
| Realtime | none | **Supabase Realtime** broadcast, or SSE locally | the Live Pulse feature |
| Geocoding | Nominatim | local gazetteer → **Nominatim** (free, 1 rps, cached) | |
| Messaging | Telegram, Twilio | **Telegram** (free, polling or webhook) + **USSD/SMS feature-phone simulator**; Twilio dropped (paid) | |
| Maps | MapLibre + deck.gl | same, **OpenFreeMap** tiles (free, no key) | |

## The parts judges should remember
1. **Live Pulse map**: a 3D extruded H3 map where each new citizen request lands as a ripple in real time,
   with a "simulate citizen wave" button for demos that works without Telegram.
2. **5 BRICS pilot cities**: Delhi (hi/en), Recife (pt), Johannesburg (en/zu), Kazan (ru), Chengdu (zh).
   Federation uses only k-anonymous, HMAC-signed aggregates and adds a cross-country comparison view.
3. **Ask CivicPulse copilot**: a policymaker asks in plain language ("where is water need worst and
   unfunded?"). The LLM calls analytics tools and answers with numbers taken only from tool output.
4. **Budget Optimizer**: given a budget, picks the portfolio of recommended projects that serves the most
   people, with an equity floor for the most vulnerable areas, and compares it with the current government plan.
5. **Predictive hotspots**: seasonal forecasting per category, plus "emerging hotspot" detection
   (a Poisson rate-change test on the last 30 days vs the prior 60).
6. **Tamper-evident decision ledger**: every analyst/policymaker action goes into a SHA-256 hash chain.
   A public transparency page lets anyone verify the chain.
7. **Inclusion by design**: voice in 5+ languages, a USSD `*123#` feature-phone flow, an offline-tolerant
   PWA submit form, and correction for under-reporting (demand ÷ connectivity).
8. **Explainable scores**: every score breaks down into its components ("why is this ranked high?"),
   and briefs are checked number by number against their inputs.

## Phases
1. Skeleton: config, DB layer (PGlite/Supabase), schema, auth + RBAC, app shell. ✅ when login works.
2. Data + analytics: regions/H3 grid, synthetic indicators, projects, docs, citizens; scoring, Gi*,
   recommendations, budget, impact, forecast.
3. Intake + AI pipeline: providers (Groq/Gemini/mock), web submit (text + voice + pin), track page,
   Telegram, USSD simulator, Live Pulse stream.
4. Dashboard: overview, map, requests, recommendations + briefs, budget, impact, settings, datasets.
5. Differentiators: copilot, optimizer, BRICS federation view, ledger + transparency page.
6. Hardening + docs: tests, DPG compliance, demo script, deploy guide (Vercel + Supabase).

## Assumptions
- Region boundaries are approximated as H3 discs around the city centre. Localities are real neighbourhood
  names at approximate coordinates. All indicators, projects and documents are **synthetic and labelled illustrative**.
- Embedding dimension is fixed at 256 for both providers. Switching provider triggers a re-embed.
