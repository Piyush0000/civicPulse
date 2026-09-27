# CivicPulse — Product Spec & Build Brief (for Claude Code)

> Place this file at the repo root as `CLAUDE.md` (or `docs/SPEC.md` and reference it from `CLAUDE.md`).
> It is the single source of truth for what we are building. Read it fully before writing code.

---

## 0. How to work on this project (instructions for Claude Code)

1. Read this whole document before starting. Then write `docs/PLAN.md` summarising your build plan per phase (Section 17) and any assumptions you had to make.
2. Build **phase by phase**. At the end of each phase: run the app, run tests, fix failures, update `README.md`, and make a git commit named `phase-N: <summary>`.
3. Never silently stub a feature. If something must be mocked (e.g. a paid API), put it behind a clearly named provider interface with a working local/mock implementation and a `TODO(real-provider)` comment, and list it in `docs/PLAN.md`.
4. Everything must run locally with **one command**: `docker compose up --build`, plus `make seed` to load demo data. No paid API keys should be required for the demo to work end to end (use local/mock providers by default; real providers are opt-in via `.env`).
5. Prefer boring, well-known libraries. Pin versions. Type everything (Python type hints + mypy-friendly, TypeScript strict mode).
6. Keep secrets out of git. Provide `.env.example` with every variable documented.
7. When a design decision is not covered here, choose the simplest option consistent with the goals in Section 2, and record it in `docs/DECISIONS.md` (one line per decision: date, decision, reason).
8. Write tests as you go (Section 15). Business logic (extraction parsing, scoring, hotspot detection, dedup) must have unit tests.

---

## 1. Context

**Competition theme:** BRICS — Innovation.

**Problem:** Governments struggle to consolidate citizen feedback and align it with national infrastructure priorities. Development requests live in fragmented systems, which leads to misaligned public spending, unaddressed infrastructure gaps, and no way to measure the impact of large-scale digital public infrastructure (DPI) initiatives.

**Challenge:** Build a scalable, multilingual AI platform, designed as a **Digital Public Good (DPG)**, that:
- aggregates citizen development requests via **voice, text, and messaging apps** across diverse linguistic regions;
- analyses large datasets combining that feedback with **national demographic data, infrastructure indices, and public investment plans**;
- surfaces **demand hotspots** and **recommends high-priority development projects** to national policymakers across BRICS nations.

**Product name:** CivicPulse (working name; keep it in one config constant so it can be renamed).

---

## 2. Goals and non-goals

### Goals (MVP)
- G1. A citizen can submit a development request by **voice or text** in **Hindi, English, or Portuguese** (Russian and Chinese are a stretch goal) through **web form, Telegram bot, or WhatsApp (Twilio sandbox, optional)**, plus an **IVR simulator** (audio upload endpoint that behaves like a phone call).
- G2. Every submission is transcribed, language-detected, translated to English (pivot), PII-redacted, and converted into a **structured request** (category, location, urgency, affected group, summary).
- G3. Near-duplicate requests are **clustered** into demand signals.
- G4. Requests are aggregated on an **H3 hexagon grid** and fused with **population, infrastructure, vulnerability, and planned-investment** data.
- G5. A transparent, configurable **priority score** and a statistical **hotspot analysis** (Getis-Ord Gi*) rank areas and categories.
- G6. The system produces **ranked project recommendations**, each with an **AI-generated policy brief** that cites the data used and relevant investment-plan documents.
- G7. A **policymaker dashboard** shows: overview KPIs, hotspot map, request explorer, recommendations, budget-alignment (planned spend vs demand), and impact tracking (before/after for completed projects).
- G8. Built as a DPG: open license, privacy by design, self-hostable per country, documented, open data formats.
- G9. Runs fully locally with seeded realistic demo data for at least one pilot region.

### Non-goals (MVP)
- Real government integrations, real SMS gateways at scale, production-grade IVR telephony.
- Mobile native apps.
- Real-time federation across countries (design for it; don't build it).
- Perfect geocoding of informal addresses (best effort + user pin).

---

## 3. Users and roles

| Role | Who | What they do |
|---|---|---|
| Citizen | Any resident | Submits requests, receives acknowledgement + tracking ID, can check status. No account needed. |
| Analyst | Government data/planning staff | Reviews requests, corrects categories, manages datasets, tunes scoring weights. |
| Policymaker | Ministry/department decision-makers | Views dashboard, recommendations, briefs; marks recommendations as accepted/rejected; views impact. |
| Admin | Platform operator | Manages users, regions, channels, retention settings. |

Auth: email + password with JWT (access + refresh). Role-based access control. Seed one user per role (Section 14).

---

## 4. Core user journeys (these are the demo)

1. **Voice note to dashboard:** A citizen sends a Hindi voice note on Telegram: "Our village water tanker comes once a week, the handpump near the school is broken for 3 months." Within ~15 seconds it appears in the dashboard as a structured `water_supply` request, `urgency: high`, geocoded, attached to an existing cluster, and the hex's priority score updates.
2. **Hotspot to recommendation:** A policymaker opens the map, sees a significant water-supply hotspot, clicks it, sees the ranked recommendation "Restore/expand drinking-water points in <area>", reads the policy brief (population affected, gap vs standard, citizen quotes anonymised, overlap with planned budget), and marks it **Accepted**.
3. **Budget misalignment:** The budget-alignment view shows categories/areas where planned investment is high but citizen demand is low, and vice versa.
4. **Impact:** For a completed project, the impact view shows request volume in its footprint for 90 days before vs after completion, with the percentage change.
5. **Citizen tracking:** Citizen receives a tracking ID (e.g. `CP-7F3K9Q`) and can check its status on a public page or by replying "status CP-7F3K9Q" to the bot.

---

## 5. System architecture

```
Channels (web form, Telegram, WhatsApp/Twilio, IVR simulator)
        │  HTTP webhooks / uploads
        ▼
  API (FastAPI)  ──► stores raw_message, returns tracking ID
        │  enqueue
        ▼
  Queue (Redis) ──► Celery workers (pipeline tasks)
        │
        ├─ 1. stt            (audio → text)            [faster-whisper local | API provider]
        ├─ 2. langdetect     (text → language code)
        ├─ 3. translate      (→ English pivot, keep original)
        ├─ 4. redact_pii     (regex + LLM)
        ├─ 5. extract        (LLM → structured JSON, schema-validated)
        ├─ 6. geocode        (place text / pin → lat,lng → H3 cell)
        ├─ 7. embed          (multilingual embedding → pgvector)
        ├─ 8. cluster_assign (nearest cluster or new)
        └─ 9. mark_cell_dirty (for scoring job)
        │
  Periodic jobs (Celery beat):
        ├─ recompute_scores     (every 5 min, dirty cells only; full nightly)
        ├─ hotspot_analysis     (every 15 min)
        ├─ build_recommendations(every 15 min)
        ├─ recluster            (nightly, HDBSCAN full re-cluster)
        └─ retention_cleanup    (nightly)
        │
  PostgreSQL 16 + PostGIS + pgvector
        │
        ▼
  Web app (Next.js) ── dashboard + public citizen pages
```

Design principles:
- **Idempotent pipeline steps.** Each step writes its output and a `pipeline_status` on the request; re-running a step must be safe. Failed steps retry with exponential backoff (max 3), then mark `failed` with the error recorded.
- **Provider interfaces** for STT, translation, LLM, embeddings, geocoding, messaging. Each has a local/mock implementation and optional real ones selected by env var.
- **Multi-tenant by region.** Every domain row has `region_id`. A deployment can host several regions (e.g. one Indian district and one Brazilian municipality) but each country could also self-host its own instance (data sovereignty).

---

## 6. Tech stack (pin versions in lock files)

**Backend**
- Python 3.11, FastAPI, Uvicorn
- SQLAlchemy 2.x (async) + Alembic migrations, Pydantic v2
- Celery 5 + Redis 7 (broker and result backend), Celery beat
- PostgreSQL 16 with PostGIS 3.4 and pgvector (build a custom image: `FROM postgis/postgis:16-3.4` then install `postgresql-16-pgvector` via apt)
- Geo/analytics: `h3` (v4 API), `geopandas`, `shapely`, `pyproj`, `libpysal`, `esda` (Getis-Ord), `numpy`, `pandas`, `rasterio` (for WorldPop raster), `osmium` or `pyrosm` (OSM extracts)
- NLP: `faster-whisper` (default model `small`, configurable), `langdetect` or `fasttext lid.176` (prefer fasttext if easy), `sentence-transformers` with `intfloat/multilingual-e5-small` (384-dim) for embeddings, `hdbscan`
- LLM client: thin internal abstraction supporting `anthropic`, `openai`-compatible (covers Ollama/vLLM), and `mock`
- Testing: `pytest`, `pytest-asyncio`, `httpx`, `factory-boy` (optional)
- Lint/format: `ruff`, `black` (or ruff format), `mypy`

**Frontend**
- Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, shadcn/ui
- MapLibre GL JS + deck.gl (`H3HexagonLayer`, `ScatterplotLayer`) — use a free basemap style (e.g. OpenFreeMap or MapLibre demo tiles); make the style URL configurable
- TanStack Query for data fetching, Recharts for charts
- `next-intl` for i18n (citizen pages in en/hi/pt; dashboard in en, structured for more)
- Browser voice recording via MediaRecorder API

**Infra**
- Docker Compose services: `db`, `redis`, `api`, `worker`, `beat`, `web`, optional `ollama` (profile `local-llm`)
- `Makefile` targets: `up`, `down`, `seed`, `test`, `lint`, `migrate`, `reset`
- License: **Apache-2.0**

---

## 7. Repository structure

```
civicpulse/
├── CLAUDE.md                  # this spec (or pointer to docs/SPEC.md)
├── README.md
├── LICENSE                    # Apache-2.0
├── docker-compose.yml
├── Makefile
├── .env.example
├── docs/
│   ├── PLAN.md  DECISIONS.md  ARCHITECTURE.md  DATA_SOURCES.md
│   ├── PRIVACY.md  DPG_COMPLIANCE.md  API.md  DEMO_SCRIPT.md
├── infra/
│   └── db/Dockerfile          # postgis + pgvector
├── backend/
│   ├── pyproject.toml
│   ├── alembic/
│   ├── app/
│   │   ├── main.py            # FastAPI app factory
│   │   ├── config.py          # pydantic-settings
│   │   ├── db.py
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── api/               # routers: auth, intake, webhooks, requests, map, scores,
│   │   │                      #   recommendations, briefs, budget, impact, datasets, admin, public
│   │   ├── pipeline/          # one module per step + orchestrator
│   │   ├── providers/         # stt/, translate/, llm/, embed/, geocode/, messaging/
│   │   ├── analytics/         # h3_utils, indicators, scoring, hotspots, recommendations, impact
│   │   ├── rag/               # document ingestion, chunking, retrieval
│   │   ├── privacy/           # redaction, pseudonymisation, retention
│   │   ├── tasks/             # celery app + task definitions + beat schedule
│   │   ├── prompts/           # versioned prompt templates (.md / .jinja)
│   │   └── seed/              # demo data loaders + synthetic generator
│   └── tests/
└── frontend/
    ├── package.json
    ├── app/
    │   ├── (public)/submit, (public)/track/[id], (public)/about
    │   └── (dashboard)/overview, map, requests, recommendations, recommendations/[id],
    │                   budget, impact, datasets, settings, login
    ├── components/  lib/  messages/ (en.json, hi.json, pt.json)
```

---

## 8. Domain model (PostgreSQL)

Use UUID primary keys, `created_at`/`updated_at` timestamps (timestamptz, UTC) on all tables. Geometry in SRID 4326.

```
regions(id, code UNIQUE, name, country_code ISO-3166 alpha-2, default_language,
        supported_languages text[], h3_resolution int DEFAULT 7,
        boundary geometry(MultiPolygon,4326), bbox, timezone, config jsonb)

users(id, email UNIQUE, password_hash, full_name, role enum[admin,analyst,policymaker],
      region_ids uuid[], is_active)

reporters(id, region_id, pseudonym_hash UNIQUE,     -- HMAC-SHA256(channel + ":" + external_id, SECRET)
          preferred_language, consent_given_at, first_seen_at, last_seen_at)

raw_messages(id, region_id, reporter_id, channel enum[web,telegram,whatsapp,ivr,sms],
             external_message_id, content_type enum[text,audio],
             text_original, audio_path, received_at,
             UNIQUE(channel, external_message_id))       -- dedupe webhook retries

requests(id, region_id, raw_message_id UNIQUE, reporter_id, tracking_code UNIQUE,
         language_detected, text_original_redacted, text_english_redacted,
         category enum (see §9.4), subcategory text, urgency enum[low,medium,high,critical],
         summary text, affected_group text, estimated_people_affected int NULL,
         location_text text, location_precision enum[exact_pin,street,locality,district,unknown],
         geom geometry(Point,4326) NULL, h3_cell text NULL,
         embedding vector(384) NULL, cluster_id NULL,
         is_actionable bool, is_spam bool,
         pipeline_status enum[received,transcribed,translated,redacted,extracted,
                              geocoded,embedded,clustered,completed,failed],
         pipeline_error text NULL, extraction_confidence float,
         status enum[new,under_review,linked_to_project,resolved,rejected] DEFAULT new,
         analyst_overrides jsonb, submitted_at)

clusters(id, region_id, category, centroid vector(384), representative_request_id,
         label text, request_count int, unique_reporter_count int,
         h3_cells text[], first_seen_at, last_seen_at)

h3_cells(h3_cell PK part, region_id PK part, resolution, geom geometry(Polygon,4326),
         population float, admin_name text,
         vulnerability_index float,            -- 0..1, higher = more deprived
         connectivity_index float,             -- 0..1, proxy for ability to report
         is_dirty bool DEFAULT true)

cell_indicators(region_id, h3_cell, category, key text, value float, source text, as_of date,
                PRIMARY KEY(region_id,h3_cell,category,key))
   -- e.g. (health, km_to_nearest_facility, 7.2), (education, schools_per_1000, 0.3)

facilities(id, region_id, category, type text, name, geom Point, source, source_id)

planned_projects(id, region_id, external_ref, title, description, category,
                 status enum[planned,approved,in_progress,completed,cancelled],
                 budget_amount numeric, currency, start_date, end_date, completed_date,
                 footprint geometry(MultiPolygon,4326) NULL, h3_cells text[],
                 source_document_id NULL)

cell_scores(region_id, h3_cell, category, computed_at,
            demand_raw float, demand_adj float,
            d_norm, g_norm, p_norm, v_norm, f_coverage float,
            priority_score float,                 -- 0..100
            gi_z float, gi_p float, is_hotspot bool,
            request_count_90d int, unique_reporters_90d int,
            PRIMARY KEY(region_id,h3_cell,category))

recommendations(id, region_id, category, title, h3_cells text[], footprint geometry,
                priority_score float, rank int,
                people_affected_est int, request_count int, unique_reporters int,
                gap_summary jsonb, funded_overlap float,
                status enum[proposed,accepted,rejected,deferred] DEFAULT proposed,
                decided_by NULL, decided_at NULL, decision_note text,
                fingerprint text UNIQUE,            -- stable hash of category+sorted cells to avoid duplicates on rebuild
                created_at, updated_at)

policy_briefs(id, recommendation_id, version int, content_md text, citations jsonb,
              model_name, prompt_version, generated_at)

documents(id, region_id, title, doc_type enum[budget,plan,policy,report], source_url, file_path,
          published_date, language)
doc_chunks(id, document_id, chunk_index, text, embedding vector(384), page int)

audit_log(id, user_id NULL, action, entity_type, entity_id, diff jsonb, at)
settings(region_id, key, value jsonb)          -- scoring weights, thresholds, retention days
```

Indexes: GIST on all geometry columns; `ivfflat` or `hnsw` on vector columns; btree on `(region_id, h3_cell)`, `(region_id, category)`, `(region_id, submitted_at)`, `tracking_code`.

---

## 9. Ingestion & AI pipeline (detailed)

### 9.1 Channels
- **Web form** (`/submit`, public, i18n): language picker, text box, **record voice** button (MediaRecorder → webm/opus upload), optional **location pin** on a small map or "use my location", optional photo (store only; not analysed in MVP), consent checkbox. Returns tracking code.
- **Telegram bot** (python-telegram-bot or raw Bot API webhook): handles text and voice messages, location shares, `/start` (consent flow in user's language), `/status <code>`. Webhook endpoint: `POST /webhooks/telegram/{secret}`. If `TELEGRAM_BOT_TOKEN` is unset, the channel is disabled and the dashboard shows that.
- **WhatsApp via Twilio sandbox** (optional, feature flag): `POST /webhooks/twilio/whatsapp`, validate Twilio signature, download media for voice notes.
- **IVR simulator**: `POST /api/intake/ivr` accepts an audio file + caller number + region; behaves like a recorded phone call. Also a small page in the dashboard (`/datasets` or `/settings` → "IVR simulator") to upload test audio. Document how a real IVR (Exotel/Twilio Voice) would call this.
- **Consent**: first contact from a new reporter on messaging channels receives a short consent message in their language (what is collected, why, retention, how to opt out by sending `STOP`). Messages are processed only after consent (web form: checkbox).
- **Acknowledgement**: reply with tracking code in the reporter's language. Reply again when the request is linked to an accepted recommendation (status notification) — implement via the messaging provider interface.

### 9.2 Speech-to-text
- Provider interface `STTProvider.transcribe(audio_path, language_hint) -> (text, language, confidence)`.
- Default: `faster-whisper` model size from env `WHISPER_MODEL=small`, CPU int8. Convert audio with ffmpeg to 16kHz mono wav first (include ffmpeg in the worker image).
- Mock provider for tests returns fixture transcripts keyed by filename.
- Document AI4Bharat IndicConformer as a recommended upgrade for Indian languages (don't implement unless trivial).

### 9.3 Language detection and translation
- Detect language on the original text (fasttext lid.176 preferred; fallback langdetect). Store ISO-639-1 code.
- Translation provider interface: `translate(text, source_lang, target_lang="en")`.
  - Default: LLM-based translation via the LLM provider (with a strict "translate only, no commentary" prompt).
  - Mock: returns text unchanged with a `[mock-translation]` prefix in tests only.
  - Documented optional: NLLB-200 distilled 600M via transformers.
- Always keep the redacted original-language text; the dashboard shows both.

### 9.4 Category taxonomy (fixed enum, config-extendable later)
```
water_supply, sanitation_drainage, roads_transport, electricity, health, education,
housing, waste_management, public_safety_lighting, digital_connectivity,
agriculture_irrigation, other
```
Each category has in config: display names (en/hi/pt), icon name, related OSM facility tags, and the infrastructure-gap indicator used for scoring (§10.2).

### 9.5 PII redaction
- Step 1 regex: phone numbers (international formats), emails, national ID-like numbers (Aadhaar 12 digits, CPF `\d{3}\.\d{3}\.\d{3}-\d{2}`, etc.), exact house numbers optional.
- Step 2: the extraction LLM call also returns `person_names_detected[]`; replace those in stored text with `[NAME]`.
- Raw unredacted text is never shown in the UI. Raw audio is deleted after `RAW_AUDIO_RETENTION_DAYS` (default 30).
- Reporter identity stored only as HMAC pseudonym. The mapping from pseudonym back to a chat ID for replies is kept in a separate table `reporter_contacts(reporter_id, channel, external_id_encrypted)` encrypted with Fernet (key from env), deleted on `STOP` or retention expiry.

### 9.6 Structured extraction (LLM)
- One LLM call per request, temperature 0, JSON output validated with Pydantic. On validation failure retry once with the error appended; then fall back to `category=other, is_actionable=false, extraction_confidence=0`.
- Store prompt templates in `app/prompts/extract_v1.md` with a `PROMPT_VERSION` constant.

Output schema:
```json
{
  "is_actionable": true,
  "is_spam": false,
  "category": "water_supply",
  "subcategory": "broken handpump",
  "urgency": "high",
  "urgency_reason": "drinking water unavailable for months; affects school",
  "summary": "Handpump near the village school has been broken for 3 months; water tanker comes weekly.",
  "affected_group": "school children and village residents",
  "estimated_people_affected": null,
  "location_text": "near the government school, <village name>",
  "location_granularity": "locality",
  "person_names_detected": [],
  "confidence": 0.86
}
```

Prompt requirements (write the full prompt in the file):
- System: you are a civic-request classifier for a government planning tool; output ONLY valid JSON matching the schema; do not invent locations or numbers; `estimated_people_affected` only if stated or clearly implied; urgency rubric:
  - `critical`: immediate risk to life/health (e.g. no drinking water at all, collapsed bridge, disease outbreak)
  - `high`: essential service unavailable for an extended period or affecting vulnerable groups
  - `medium`: degraded service, recurring inconvenience
  - `low`: improvement suggestions, aesthetics
- Include the category list with one-line definitions and 4–6 few-shot examples covering Hindi, Portuguese, English, a spam message, and a non-actionable complaint.
- Input includes both original text and English translation, the region name, and channel.

### 9.7 Geocoding
Order of precedence:
1. Explicit pin / shared location from the channel → `exact_pin`.
2. `location_text` → local **gazetteer** match first (admin areas + OSM named places loaded during seeding, fuzzy match with `rapidfuzz`, constrained to region boundary).
3. Then Nominatim (public instance, 1 req/sec rate limit, custom User-Agent, results cached in a `geocode_cache` table) constrained by region viewbox. Disabled when `GEOCODER=offline`.
4. If still unknown → `location_precision=unknown`, no H3 cell; appears in an "Unlocated" queue for analysts to pin manually in the dashboard.
- Point must fall inside region boundary, else treat as unknown.
- Compute `h3_cell = h3.latlng_to_cell(lat, lng, region.h3_resolution)`.
- For `district`-level precision, do NOT pin to the district centroid cell; store `admin_name` and distribute weight evenly across that district's cells when computing demand (weight = 1 / number of cells), flagged as low precision.

### 9.8 Embeddings & clustering
- Embed `"query: " + summary + " | " + subcategory` with `multilingual-e5-small` (normalize vectors). Store in `requests.embedding`.
- **Online assignment** (per request): find candidate clusters with the same `category` whose `h3_cells` include the request cell or its k-ring(1) neighbours; pick highest cosine similarity; assign if similarity ≥ `CLUSTER_SIM_THRESHOLD` (default 0.82); else create a new cluster. Update centroid as running mean; update counts (unique reporters counted by `reporter_id`).
- **Nightly re-cluster**: per region+category, HDBSCAN on embeddings concatenated with scaled lat/lng (weight configurable) to fix drift; preserve cluster IDs where overlap ≥ 50% (Jaccard on members).
- Cluster `label`: short LLM-generated title from 5 representative summaries (cached; regenerate when membership changes >20%).
- Anti-gaming: count **unique reporters**, not raw messages; cap one reporter's contribution per cluster per 7 days to 1 in demand calculations.

---

## 10. Analytics: data fusion, scoring, hotspots, recommendations

### 10.1 Grid
- H3 resolution per region (default 7 ≈ 5.2 km²; use 8 for dense cities). Precompute all cells covering the region boundary during seeding (`h3.polygon_to_cells` / `h3shape_to_cells`) and store polygons.

### 10.2 Indicators per cell (loaded by seed/dataset import jobs)
- **Population**: WorldPop 100m raster (country, latest year) summed per H3 cell via rasterio. Fallback when raster unavailable: distribute district census population by OSM building count or uniformly.
- **Infrastructure gap per category** (normalised 0–1, higher = worse):
  - `health`: distance (km) from cell centroid to nearest hospital/clinic (OSM `amenity=hospital|clinic|doctors`); gap = clip(dist / 10km, 0, 1)
  - `education`: schools per 1,000 population within k-ring(1) (`amenity=school`); gap = 1 − clip(ratio / target, 0, 1) with target configurable
  - `water_supply`: water points per 1,000 pop (`amenity=drinking_water`, `man_made=water_well|water_tower`) — OSM is sparse, so blend 50/50 with census "households with tap water" if a district CSV is provided
  - `roads_transport`: road length (km) per km² from OSM `highway=*` (exclude footway/path); gap = 1 − percentile rank
  - `electricity`: VIIRS night-light radiance per capita (optional raster); gap = 1 − percentile rank; if not available, use vulnerability as proxy and flag it
  - `sanitation_drainage`, `waste_management`, `housing`, `public_safety_lighting`, `digital_connectivity`, `agriculture_irrigation`, `other`: use census district CSV indicators if present; else default gap = vulnerability_index (flag `proxy=true`)
- **Vulnerability index** (0–1): from a district-level deprivation CSV (e.g. multidimensional poverty share) mapped to cells; fallback: inverse night-light percentile.
- **Connectivity index** (0–1): proxy for how likely people are to report (mobile/internet access). From CSV if available; fallback 1 − vulnerability × 0.5.
- Every indicator row stores `source` and `as_of`. `docs/DATA_SOURCES.md` lists each dataset, license, URL, and how to refresh it.

### 10.3 Priority score (per cell × category)
All components normalised to 0–1 within the region using percentile rank (robust to outliers).

```
demand_raw   = Σ over requests in last 90 days (weight_precision × weight_urgency × recency_decay)
               counted per unique reporter per cluster per 7 days
               weight_urgency  = {low:0.5, medium:1, high:1.5, critical:2.5}
               weight_precision= {exact_pin:1, street:1, locality:0.9, district:1/n_cells}
               recency_decay   = exp(−age_days / 45)
demand_adj   = demand_raw / max(connectivity_index, 0.2)    # correct under-reporting bias
D = pct_rank(demand_adj)
G = infrastructure gap for this category (§10.2)
P = pct_rank(population)
V = vulnerability_index
F = funded coverage = share of this cell covered by planned/approved/in_progress projects of same category (0..1)

priority_score = 100 × (wD·D + wG·G + wP·P + wV·V) × (1 − α·F)
defaults: wD=0.35, wG=0.25, wP=0.20, wV=0.20, α=0.7   (editable per region in Settings; must sum to 1)
Cells with zero requests in 90 days still get a score (latent need) but are flagged `no_signal=true`.
```
Store every component in `cell_scores` so the UI can explain any score ("why is this ranked high?").

### 10.4 Hotspot detection
- Per region × category, run Getis-Ord Gi* (`esda.G_Local` with `star=True`) on `demand_adj` using H3 k-ring(1) contiguity weights (build a `libpysal.weights.W` from neighbour dict). 999 permutations.
- `is_hotspot = gi_z > 1.96 and gi_p < 0.05 and request_count_90d >= MIN_REQUESTS (default 3)`.
- Skip categories with fewer than 30 cells having data; mark "insufficient data".

### 10.5 Recommendations
- Per region × category: take hotspot cells plus cells with `priority_score ≥ 70`; merge contiguous cells (connected components over k-ring(1) adjacency) into candidate areas; cap area size at 25 cells (split by score if larger).
- For each candidate: aggregate score = population-weighted mean priority; people_affected_est = Σ population of cells × category-specific share (config; default 1.0 for water/health/roads, 0.25 for education [school-age share], etc.); request/reporter counts; top 3 representative anonymised citizen quotes (redacted, original + English); gap summary (indicator values vs region median); funded overlap and list of overlapping planned projects.
- Title: template `"{action verb for category} in {admin_name(s)}"` (e.g. "Improve drinking-water access in Narela"); optional LLM polish.
- Upsert by `fingerprint`; keep decision status if the fingerprint already exists. Rank within region across all categories by aggregate score.

### 10.6 Policy brief (LLM + RAG)
- Retrieval: embed a query built from category + area name + gap summary; retrieve top 5 `doc_chunks` from the region's documents (budgets/plans).
- Generate markdown brief with sections: **Summary** (3 sentences), **Evidence** (demand, gap, population, vulnerability — exact numbers from the data passed in), **What citizens are saying** (the provided quotes only), **Alignment with current plans** (cite retrieved chunks as [D1], [D2]…; if none relevant, say so), **Suggested intervention options** (2–3, clearly labelled as suggestions), **Risks & data limitations** (proxy indicators, reporting bias, geocoding precision).
- Hard rule in prompt: use only numbers provided in the input JSON; never invent budgets, names, or statistics. Validate after generation: every number in the brief must appear in the input payload (simple regex check); if validation fails, regenerate once, then store with a `validation_warning` flag shown in UI.
- Store citations JSON mapping [D#] → document/page. Version briefs; regenerate on demand from UI.

### 10.7 Budget alignment
- For each category (and admin area): planned investment share (Σ budget of planned/approved/in_progress projects) vs demand share (Σ demand_adj) → alignment gap = demand_share − investment_share. Show a diverging bar chart and a table; also per-area scatter (x = demand share, y = investment share, bubble = population).

### 10.8 Impact tracking
- For each `completed` project with a footprint and completed_date: compare request rate (per 1,000 population per 30 days) for its category in footprint cells over 90 days before vs 90 days after (exclude 14 days around completion). Show % change, and a comparison against a **control** = same category in non-project cells with similar pre-period rate (nearest 20 by pre-rate) to show difference-in-differences. Label clearly as indicative, not causal proof.
- Also track the platform's own DPI metrics: requests per channel, % voice, median time-to-structure, % geocoded, languages used, recommendations accepted.

---

## 11. API (FastAPI, prefix `/api/v1`, OpenAPI auto-docs at `/docs`)

Public (no auth, rate-limited per IP with a simple Redis limiter):
- `POST /public/requests` — multipart: text?, audio?, language?, lat?, lng?, region_code, consent=true → `{tracking_code}`
- `GET  /public/requests/{tracking_code}` — status + category + summary (redacted), no PII
- `GET  /public/regions` — list regions with supported languages
- `GET  /public/stats/{region_code}` — aggregate counts (k-anonymity: suppress cells < 5 reporters)

Webhooks:
- `POST /webhooks/telegram/{secret}`
- `POST /webhooks/twilio/whatsapp`
- `POST /intake/ivr` (auth: API key header `X-Intake-Key`)

Auth:
- `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`

Dashboard (JWT, role-checked, region-scoped):
- `GET /overview?region=` — KPIs: total requests, last 7/30 days, by channel, by language, by category, by urgency, % geocoded, active hotspots, top 5 recommendations, pipeline health (queue depth, failed count)
- `GET /requests?region=&category=&urgency=&status=&channel=&language=&q=&from=&to=&h3=&cluster_id=&page=` — paginated
- `GET /requests/{id}`, `PATCH /requests/{id}` (analyst: override category/urgency/location/status; writes audit_log and re-runs downstream steps)
- `GET /requests/unlocated`, `POST /requests/{id}/pin`
- `GET /clusters?region=&category=`, `GET /clusters/{id}`
- `GET /map/cells?region=&category=&metric=priority|demand|gap|population|vulnerability` — returns `[{h3, value, is_hotspot, ...}]` (compact)
- `GET /map/cells/{h3}?region=` — full breakdown for side panel (all categories, components, recent requests, facilities nearby)
- `GET /recommendations?region=&category=&status=`, `GET /recommendations/{id}`, `PATCH /recommendations/{id}` (policymaker: status + note)
- `GET /recommendations/{id}/brief`, `POST /recommendations/{id}/brief:regenerate`
- `GET /budget/alignment?region=`
- `GET /impact/projects?region=`, `GET /impact/projects/{id}`
- `GET /impact/platform-metrics?region=`
- `GET/POST /datasets/...` — list datasets & freshness; upload planned-projects CSV; upload documents (PDF → text via `pypdf`, chunk ~800 tokens with overlap 100, embed)
- `GET/PUT /settings/scoring?region=` — weights, thresholds (validates sum = 1); triggers full recompute
- `GET /admin/users`, `POST /admin/users` (admin)
- `GET /export/cells.csv|geojson`, `GET /export/recommendations.csv` (open-data exports, k-anonymised)

All list endpoints: pagination (`page`, `page_size` ≤ 200), consistent error format `{error: {code, message, details}}`.

---

## 12. Frontend (Next.js)

Global: clean, government-appropriate design (neutral palette, one accent colour, accessible contrast WCAG AA, keyboard navigable). Region switcher in the top bar. Left nav. Dark mode optional.

Public pages (i18n en/hi/pt, mobile-first):
- `/submit` — language select, text area, big record button with waveform/timer (max 2 min), map pin (optional), consent, submit → success screen with tracking code and copy/share button.
- `/track/[code]` — status timeline (received → understood → under review → linked to project → resolved).
- `/about` — what the platform does, privacy notice, open-source link, DPG statement.

Dashboard pages:
- `/overview` — KPI cards; requests-over-time line chart (by category toggle); channel & language donut/bar; top recommendations list; pipeline health widget.
- `/map` — full-screen MapLibre + deck.gl H3 layer. Controls: category, metric (priority/demand/gap/population/vulnerability), hotspot-only toggle, time window. Hotspots outlined. Toggle layers: facilities (points), planned projects (polygons). Click a hex → side panel with score breakdown bar ("why this score"), request count, recent requests (redacted, with original language + English), linked recommendation.
- `/requests` — filterable table (TanStack Table), row → detail drawer with original text, translation, extracted fields, confidence, audio player (if not expired), edit controls for analysts, cluster siblings. "Unlocated" tab with pin-on-map tool.
- `/recommendations` — ranked cards/table with score, category, area, people affected, requests, funded overlap, status; filters.
- `/recommendations/[id]` — mini-map of footprint, evidence panel, policy brief (rendered markdown with citation hovers), quotes, overlapping plans, Accept / Reject / Defer with note, regenerate brief, export brief as PDF (browser print stylesheet is fine).
- `/budget` — diverging bar (demand share − investment share by category), scatter by area, table.
- `/impact` — completed projects list with before/after + control chart and % change; platform DPI metrics.
- `/datasets` — dataset list with source, license, as_of, row counts; upload planned-projects CSV and documents; IVR simulator upload.
- `/settings` — scoring weight sliders (auto-normalise to 1, live preview of top-10 ranking change), thresholds, retention days (admin).
- `/login`.

---

## 13. Privacy, security & DPG compliance

Write `docs/DPG_COMPLIANCE.md` mapping the project to the **DPG Standard's 9 indicators** (relevance to SDGs — primarily SDG 6, 9, 11, 16; open license; clear ownership; platform independence (no mandatory proprietary dependency — every paid provider has an open alternative); documentation; mechanism for extracting non-PII data (CSV/GeoJSON exports); adherence to privacy and applicable laws (India DPDP Act 2023, Brazil LGPD, South Africa POPIA, etc. — note as design considerations, not legal advice); adherence to standards & best practices; do-no-harm by design).

Implement:
- Pseudonymised reporters, encrypted contact mapping, PII redaction, retention cleanup job, `STOP` opt-out handling.
- **k-anonymity** threshold (default 5 unique reporters) for any public/exported aggregate; quotes shown only in authenticated dashboard and only redacted.
- Do-no-harm: no individual-level tracking views; no search by reporter; audit log for every analyst/policymaker action; rate limiting; webhook signature validation; CORS locked to web origin; passwords with argon2/bcrypt; security headers.
- Bias transparency: every score explains its components; dashboard shows data-quality flags (proxy indicators, low geocoding precision, low reporting connectivity).

---

## 14. Seed & synthetic demo data (critical for the demo)

`make seed` must produce a convincing demo in < 10 minutes on a laptop, **offline-capable** (bundle small pre-processed data files in `backend/app/seed/data/`; network downloads are optional enhancements).

Pilot region (primary): **Delhi NCT, India** (`region_code=IN-DL`, languages en/hi, H3 res 8).
Secondary region (stretch but preferred for the BRICS story): **Recife, Brazil** (`BR-PE-REC`, languages pt/en, H3 res 8), smaller dataset.

Seed steps:
1. Region boundaries (small GeoJSON bundled; simplified).
2. H3 cells for each region.
3. Population per cell: if WorldPop raster present in `data/raw/`, compute; else use bundled pre-computed CSV; else synthetic smooth population surface (gaussian blobs) — log which one was used.
4. Facilities: bundled pre-extracted OSM subset (hospitals, clinics, schools, water points, major roads length per cell) as CSV/GeoJSON. Provide a script `scripts/fetch_osm.py` that regenerates it from Geofabrik/Overpass when online.
5. Vulnerability & connectivity: bundled district CSV (clearly marked "illustrative values" if not real) mapped to cells.
6. Planned projects: ~40 synthetic projects per region across categories and statuses (include ~8 completed with dates 6–10 months ago, footprints), with budgets. Deliberately misalign some (heavy spend on roads in low-demand areas) so the budget view tells a story.
7. Documents: 3 short synthetic "annual plan / budget" markdown→PDF or text documents per region mentioning some of the planned projects, for RAG.
8. Synthetic citizen requests: **~5,000 for Delhi, ~1,500 for Recife** over the past 12 months via `app/seed/synthetic.py`:
   - Config file `seed/scenarios.yaml` defines 6–10 hotspot scenarios (category, centre, radius, intensity, time pattern e.g. monsoon peak for drainage in Jul–Sep), plus background noise across all categories.
   - Reporting bias: sampling probability ∝ connectivity_index.
   - Text generation: template bank with slot filling in en/hi/pt (≥ 15 templates per category per language, varied phrasing, some code-mixed Hinglish), 10% near-duplicates, 3% spam/off-topic, 5% vague location (district-level only), 8% no location. Optional `--llm` flag generates more natural variants.
   - Completed projects: requests in their footprints drop ~40–60% after completion (so impact view shows a real effect), control areas stay flat.
   - Seeded requests **bypass STT and the LLM by default** (they already carry ground-truth structured fields from the generator) but still run embedding, clustering, geocoding-by-pin, and scoring — flag `--full-pipeline` runs everything through the real pipeline for a sample of 200.
   - Include 3 short sample audio files (Hindi, English, Portuguese) for the live demo in `seed/data/audio/`. Generate them with a local TTS tool if one is available; otherwise document how to record them.
9. Users: `admin@civicpulse.local`, `analyst@civicpulse.local`, `policy@civicpulse.local`, password `demo1234` (print on seed; README warns to change).
10. Run scoring, hotspots, recommendations, and generate briefs for top 10 recommendations per region (mock LLM produces a deterministic template brief if no LLM key).

---

## 15. Testing & quality

- Unit tests: PII regex; pseudonymisation; extraction JSON validation & fallback; urgency/precision weights; percentile normalisation; priority score formula (hand-computed fixtures); weight validation; Gi* wrapper on a toy grid with a planted hotspot (must detect it); cluster assignment threshold logic; contiguous-cell merging; fingerprint stability; brief number-validation; k-anonymity suppression.
- Integration tests (docker db): intake → pipeline (mock providers) → request completed with cell and cluster; scoring job produces scores; recommendation upsert preserves decision status.
- API tests for auth/RBAC (policymaker cannot edit requests; analyst cannot accept recommendations; region scoping enforced).
- Frontend: typecheck + lint in CI; one Playwright smoke test (login → map renders → open recommendation) if time allows.
- GitHub Actions workflow: backend lint+tests, frontend lint+typecheck+build.

---

## 16. Configuration (`.env.example`)

```
APP_NAME=CivicPulse
ENV=local
SECRET_KEY=change-me
PSEUDONYM_HMAC_SECRET=change-me
CONTACT_ENCRYPTION_KEY=           # Fernet key; `make keys` generates
DATABASE_URL=postgresql+asyncpg://civic:civic@db:5432/civicpulse
REDIS_URL=redis://redis:6379/0
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty

LLM_PROVIDER=mock                 # mock | anthropic | openai_compatible
LLM_MODEL=
ANTHROPIC_API_KEY=
OPENAI_BASE_URL=                  # e.g. http://ollama:11434/v1
OPENAI_API_KEY=
STT_PROVIDER=faster_whisper       # faster_whisper | mock
WHISPER_MODEL=small
TRANSLATE_PROVIDER=llm            # llm | nllb | mock
EMBED_MODEL=intfloat/multilingual-e5-small
GEOCODER=gazetteer_then_nominatim # offline | gazetteer_then_nominatim
NOMINATIM_USER_AGENT=civicpulse-demo (contact@example.org)

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TWILIO_ENABLED=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
INTAKE_API_KEY=change-me

CLUSTER_SIM_THRESHOLD=0.82
HOTSPOT_MIN_REQUESTS=3
K_ANON_THRESHOLD=5
RAW_AUDIO_RETENTION_DAYS=30
REQUEST_TEXT_RETENTION_DAYS=730
```
With `LLM_PROVIDER=mock`, the mock must still produce plausible output: keyword-based category classifier, rule-based urgency, template summaries, deterministic template briefs — so the whole demo works offline.

For local Telegram testing, document using `ngrok`/`cloudflared` to expose the webhook, or long-polling mode (`TELEGRAM_MODE=polling` runs a small poller in the worker) — implement polling mode, it's easiest for demos.

---

## 17. Build phases & acceptance criteria

**Phase 1 — Skeleton**
Repo layout, Docker Compose (db with PostGIS+pgvector, redis, api, worker, beat, web), health endpoints, Alembic baseline with all tables from §8, auth + RBAC, Next.js shell with login and nav, CI workflow.
✅ `docker compose up` → `GET /api/v1/health` ok; login works for seeded users; web shows empty dashboard.

**Phase 2 — Intake & pipeline**
Web form (text + voice + pin), IVR simulator endpoint, Telegram polling bot, provider interfaces with mock + faster-whisper + LLM implementations, full pipeline steps §9.2–9.8 as Celery chain, tracking page.
✅ Submitting a Hindi voice note via the web form produces a completed request with category, translation, h3 cell, and cluster within ~30s (CPU). Pipeline failures visible in overview.

**Phase 3 — Data & analytics**
Seed loaders (§14 steps 1–7), indicators, scoring, Gi* hotspots, recommendations, budget alignment, impact computation, Beat schedule.
✅ `make seed` completes; `cell_scores` populated; ≥ 1 planted hotspot per scenario detected; recommendations ranked; unit tests for scoring/hotspots pass.

**Phase 4 — Synthetic citizens & RAG briefs**
Synthetic generator (§14 step 8), document ingestion + retrieval, policy brief generation with number validation.
✅ Top 10 recommendations have briefs with citations; mock mode works without any API key.

**Phase 5 — Dashboard**
All pages in §12 with real data, map with H3 layer and side panel, recommendation decisions, settings with live weight preview, exports.
✅ Demo journeys 1–5 (§4) can be performed end to end in the UI.

**Phase 6 — Hardening & docs**
Privacy features (§13), retention job, k-anonymity, audit log UI (simple table), rate limiting, i18n for public pages, README with screenshots placeholders, all docs in `docs/`, `DEMO_SCRIPT.md` (5-minute walkthrough), load test script (`locust`) showing ingestion throughput.
✅ Tests green; `docs/DPG_COMPLIANCE.md` complete; fresh clone → `make up && make seed` works.

**Stretch (only after Phase 6):** Recife region full data; Russian and Chinese; WhatsApp via Twilio; NLLB translation; IndicConformer STT; SMS; PDF brief export server-side; per-country federation design doc (aggregate-only sharing between national instances for BRICS-level comparison).

---

## 18. Demo script summary (put the full version in docs/DEMO_SCRIPT.md)

1. (30s) Problem: fragmented feedback, misaligned spending.
2. (60s) Live: send a Hindi voice note to the Telegram bot → show it land in `/requests` structured and translated.
3. (60s) `/map`: water-supply hotspot → side panel "why this score".
4. (60s) Recommendation page: brief with evidence, citizen quotes, plan alignment → Accept.
5. (45s) `/budget`: planned roads spend vs water demand misalignment.
6. (30s) `/impact`: completed project, −50% requests vs flat control.
7. (15s) DPG: open source, self-hostable per country, privacy by design, open-data exports.

---

## 19. Definition of done (MVP)

- One-command local run + seed, no paid keys required.
- All five demo journeys work in the UI.
- Scores are explainable; briefs cite sources and contain no invented numbers.
- Tests pass in CI; docs complete; Apache-2.0 licensed.