# Digital Public Good Standard: compliance mapping

| # | Indicator | How CivicPulse meets it |
|---|---|---|
| 1 | Relevance to the SDGs | SDG 6 (clean water & sanitation: water and drainage hotspots), SDG 9 (resilient infrastructure: gap indices, budget alignment), SDG 11 (inclusive cities: participation via voice, USSD and 6 languages), SDG 16 (accountable institutions: public decision ledger, transparency page), SDG 10 (reduced inequality: equity floor, under-reporting correction). |
| 2 | Open licence | Apache-2.0 (`LICENSE`). Open-data exports are published under CC BY 4.0. |
| 3 | Clear ownership | Public repository; each national deployment is owned and operated by its government or partner. |
| 4 | Platform independence | No mandatory proprietary dependency. Every optional external service has an open or offline alternative: Supabase ↔ PGlite/any Postgres; Groq/Gemini ↔ rule-based pipeline; Supabase Realtime ↔ SSE; Nominatim ↔ offline gazetteer; OpenFreeMap ↔ any MapLibre style. |
| 5 | Documentation | README, `docs/` (architecture, deploy, decisions, privacy, data sources, demo script), OpenAPI 3.1 at `/api/v1/openapi.json`, typed code, 50 tests. |
| 6 | Mechanism for extracting non-PII data | `/api/v1/export/cells.csv|geojson`, `/api/v1/export/recommendations.csv`, `/api/v1/federation/aggregate/<region>`. All k-anonymised (k = 5 distinct reporters). |
| 7 | Adherence to privacy & applicable laws | Data minimisation, consent before processing (web checkbox, bot consent flow), pseudonymisation, encryption of contact mappings, automatic PII redaction, retention limits, opt-out (`STOP`). Designed with India's DPDP Act 2023, Brazil's LGPD, South Africa's POPIA, Russia's 152-FZ and China's PIPL in mind. *Design considerations, not legal advice.* Data sovereignty through per-country instances with aggregate-only federation. |
| 8 | Adherence to standards & best practices | H3, GeoJSON, OpenAPI 3.1, ISO 639-1 / ISO 3166-1, WCAG AA contrast and keyboard focus styles, security headers, RBAC, rate limiting, typed code, CI-ready tests. |
| 9 | Do no harm by design | No individual-level tracking views and no search by reporter; quotes are shown redacted and only in the authenticated dashboard; the public map is coarsened (res 7) and k-anonymous; every official action goes to a tamper-evident ledger; bias transparency (proxy flags, connectivity correction, score breakdowns); synthetic data is clearly labelled. |
