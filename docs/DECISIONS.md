# Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-09-27 | No Docker, no Ollama, no paid services (team constraint). Next.js full-stack instead of FastAPI + Celery + Redis. | One deployable that runs with `npm run dev` and deploys free on Vercel. |
| 2026-09-27 | PGlite (embedded Postgres) by default, Supabase via `DATABASE_URL`. | Real Postgres semantics with zero install; the same SQL on both. |
| 2026-09-27 | No PostGIS: geography is modelled entirely on the H3 grid (lat/lng + cell ids). | The analytics are H3-native; this avoids extension incompatibilities between PGlite and hosted Postgres. |
| 2026-09-27 | Embeddings stored as `real[]` with cosine in JS; deterministic hashed n-gram embeddings on the English pivot. | PGlite's pgvector build is a separate early package; candidate sets are small (k-ring filtered). The translation step makes lexical similarity cross-lingual. |
| 2026-09-27 | Region boundaries approximated as H3 discs (+ a coastline mask for Recife). | Offline and deterministic; real boundaries can be loaded later. |
| 2026-09-27 | Free AI chain: Groq (Whisper + Llama 3.3) → Gemini → rule-based offline pipeline. | Speed and free tiers, with graceful degradation to fully offline. |
| 2026-09-27 | Browser Web Speech transcript is sent alongside audio. | Voice works even without server STT keys. |
| 2026-09-27 | MyMemory public API as the translation fallback. | Free and keyless; used only when no LLM key is configured. |
| 2026-09-27 | Gi* p-values from 199 conditional permutations (spec: 999). | 5× faster recompute on every intake; results at α = 0.05 are stable. |
| 2026-09-27 | Minimum cells with data for Gi*: `min(30, max(10, 2% of cells))` instead of a flat 30. | Small pilot grids (Recife: 241 cells) otherwise never qualify; a test caught a missed planted hotspot in Chengdu. |
| 2026-09-27 | Demand percentile keeps zero-demand cells at D = 0. | A plain percentile rank gave "no requests" cells a mid-rank. |
| 2026-09-27 | Recommendation evidence floor: a hotspot cell, or ≥ 8 requests from ≥ 5 reporters. | Prevents areas with 3–4 requests from outranking real hotspots on latent need alone. |
| 2026-09-27 | Recommendation upsert by exact fingerprint, else Jaccard ≥ 0.4 within the category. | Keeps decision status when areas shift slightly on recompute. |
| 2026-09-27 | Sequential single-hue map ramp; hotspot and emerging state as outlines. | Data-viz rule: magnitude = one hue; state never rides on fill colour alone. |
| 2026-09-27 | Federation aggregates signed with HMAC (demo key). | Shows the protocol; production would use per-country Ed25519 keys. |
| 2026-09-27 | USSD handler speaks the Africa's Talking callback format. | The most common gateway format in the pilot geographies; any gateway can adapt. |
| 2026-09-27 | Twilio/WhatsApp dropped. | Paid; Telegram, USSD and IVR cover the channels for free. |
| 2026-09-28 | Pivot from BRICS to India (team PR): 5 Indian cities, Marathi/Tamil/Telugu/Bengali. Re-added deprived neighbourhoods and rewrote city stories with Indian seasonality. | The PR removed localities the scenarios depended on and broke the seed and 12 type checks. |
| 2026-09-28 | Removed hard-coded Cloudinary credentials; photos are optional, stored in their own column (never injected into complaint text), Cloudinary only via env, local fallback. | Secrets in a public repo; photo URLs were being sent to translation/LLMs; a mandatory photo excluded voice-only and feature-phone users. |
| 2026-09-28 | Separate citizen and government portals on one session format; government accounts are never self-registered. | Item 6: citizens need their own history; officials need provisioned, auditable identities. |
| 2026-09-28 | CM's office (role `cm`) approves; MPs/MLAs endorse; departments execute. | Item 9: mirrors how approvals actually flow in Indian states. |
| 2026-09-28 | Work is "verified" only when ≥3 residents respond and ≥60% say fixed; ≤40% marks it "disputed" and reopens complaints. | Item 9: outcome, not output. Departments cannot close the loop alone. |
| 2026-09-28 | What-if numbers are computed deterministically; Gemini (preferred for this feature) only narrates, and every number is checked. | Item 10: MPs must be able to trust the figures; LLM free tiers are intermittently unavailable (503). |
| 2026-09-28 | Retry once on 429/503 before falling back to the next provider. | Gemini free tier returns 503 "high demand" under load. |
| 2026-09-30 | AI routing per task: Groq first for speech-to-text, translation, extraction and the copilot (fast, high volume); Gemini first for policy briefs and what-if briefings (long-form writing). Each falls back to the other, then to offline rules. Provider/model names are kept in backend logs and hidden from the UI. | Speed and free-tier limits for high-volume steps; Gemini for writing quality; UI stays vendor-neutral. |
| 2026-09-30 | Firebase (Spark, free) for citizen Google Sign-In and FCM web push only; Postgres stays the single database. Google-only citizen accounts get an unusable password; government accounts cannot sign in with Google. Push targets are matched by recomputing reporter pseudonyms, so no identity-to-complaint mapping is stored. | Uses Google services where they add real value (one-tap login, closing the verification loop on the web) without a second datastore or a paid plan. |
