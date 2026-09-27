# CivicPulse

**Every citizen's voice, turned into investment.** CivicPulse is an open-source, multilingual AI platform, built as a
**Digital Public Good** for the BRICS Innovation challenge. It collects citizen development requests by **voice, text,
Telegram, IVR calls and USSD on feature phones**. It fuses them with population, infrastructure, vulnerability and
budget data on an H3 hexagon grid, detects statistically significant **demand hotspots**, and gives policymakers
**ranked, evidence-backed project recommendations** with AI policy briefs. Every decision goes into a public,
tamper-evident ledger.

> **Zero paid services. Zero Docker. Zero API keys required.** `npm install && npm run dev` gives you the full platform,
> with 5 BRICS pilot cities and ~14,000 synthetic multilingual citizen requests. Free-tier AI (Groq, Gemini) and
> infrastructure (Supabase, Telegram) are optional upgrades.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first boot the app builds its demo world (~15 s, progress is shown in the console).

| Role | Email | Password |
|---|---|---|
| Policymaker | `policy@civicpulse.local` | `demo1234` |
| Analyst | `analyst@civicpulse.local` | `demo1234` |
| Admin | `admin@civicpulse.local` | `demo1234` |

⚠️ Demo credentials. Change `SECRET_KEY` and the passwords before any public deployment.

Other commands: `npm test` (50 unit + integration tests), `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run seed -- --reset` (rebuild the demo world; stop `npm run dev` first when using the embedded database).

## What's inside

| | |
|---|---|
| 🌍 **5 BRICS pilot cities** | Delhi 🇮🇳 (Hindi, Hinglish, English), Recife 🇧🇷 (Portuguese), Johannesburg 🇿🇦 (English, isiZulu), Kazan 🇷🇺 (Russian), Chengdu 🇨🇳 (Chinese) |
| 🎙 **Every channel** | Web + voice PWA with offline queue, Telegram bot (voice notes, location, consent, `STOP`, `status CP-…`), IVR webhook, USSD `*123#` feature-phone flow |
| 🧠 **AI pipeline** | STT → language ID → translation → PII redaction → structured extraction (schema-validated, retried, with fallback) → geocoding → embedding → clustering |
| 📡 **Live Pulse** | 3D extruded H3 map; new reports ripple in real time (SSE, or Supabase Realtime); "simulate a citizen wave" for demos |
| 📊 **Explainable scoring** | `100 × (wD·D + wG·G + wP·P + wV·V) × (1 − α·F)`. Every component is shown per cell, and the weights are editable with a live ranking preview |
| 🔥 **Hotspots** | Getis-Ord Gi* with conditional permutations on k-ring contiguity; Poisson-test **emerging** hotspots |
| 🎯 **Recommendations** | Contiguous hotspot areas → ranked projects with RAG policy briefs. **Every number in a brief is verified** against its evidence |
| 🤖 **Ask CivicPulse** | Tool-calling policy copilot (Groq/Gemini, with offline routing) that can only answer from analytics tools |
| 💰 **Budget** | Demand-vs-investment alignment + **optimizer** (people reached per $ with an equity floor) vs the current plan |
| 📈 **Impact & foresight** | Difference-in-differences for completed projects; 3-month seasonal forecasts |
| 🤝 **BRICS federation** | k-anonymous, HMAC-signed aggregates. Raw data never leaves a country |
| 🔐 **Trust** | Hash-chained audit ledger with public verification, HMAC pseudonyms, AES-GCM contacts, retention job, RBAC |

## Architecture (one deployable)

```
Channels ─► Next.js 16 route handlers (/api/v1, 45+ endpoints, OpenAPI at /api/v1/openapi.json)
             │ intake → raw_messages → requests (tracking code returned immediately)
             ▼ after(): AI pipeline (Groq → Gemini → rules), geocode (gazetteer → Nominatim), cluster
          Postgres (PGlite embedded ⟷ Supabase free) ──► analytics engine (H3, scoring, Gi*, recs, DiD, forecast)
             │                                            └► debounced recompute after each intake
             ▼
          Live Pulse bus (SSE ⟷ Supabase Realtime) ─► dashboard + public pages (MapLibre + deck.gl)
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](docs/DECISIONS.md) ·
Deploy for free: [docs/DEPLOY.md](docs/DEPLOY.md) · Demo: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) ·
DPG: [docs/DPG_COMPLIANCE.md](docs/DPG_COMPLIANCE.md) · Privacy: [docs/PRIVACY.md](docs/PRIVACY.md) ·
Data: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) · Original brief: [docs/SPEC.md](docs/SPEC.md)

## Turning on the free upgrades

Copy `.env.example` to `.env.local`:

- `GROQ_API_KEY`: Whisper-large-v3 speech-to-text + Llama 3.3 70B for extraction, translation, briefs and the copilot.
- `GEMINI_API_KEY`: automatic fallback for all of the above, plus audio understanding.
- `TELEGRAM_BOT_TOKEN`: the bot starts in polling mode automatically. No public URL needed.
- `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_*`: move from embedded PGlite to Supabase and get cross-instance realtime.

## Honesty notes

All indicators, projects, plan documents and citizen requests in the demo are **synthetic and illustrative**, generated
deterministically from `src/lib/seed/`. Neighbourhood names are real; values are not official statistics.
Impact estimates are indicative (difference-in-differences), not causal proof.

## License

Apache-2.0. See [LICENSE](LICENSE).
