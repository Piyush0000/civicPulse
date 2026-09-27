@AGENTS.md

# CivicPulse

- Product brief: `docs/SPEC.md`; how this build deviates (no Docker/Ollama/paid services): `docs/PLAN.md`, `docs/DECISIONS.md`.
- Run: `npm run dev` (auto-seeds an embedded PGlite DB in `.data/`). Test: `npm test`. Checks: `npm run typecheck && npm run lint && npm run build`.
- API lives in one route table: `src/server/router.ts` (+ services in `src/server/services`). Add endpoints there; OpenAPI is generated from it.
- Analytics are pure functions in `src/lib/analytics` (tested in `tests/`); DB I/O stays in `engine.ts` and services.
- Every provider must degrade to an offline fallback; never introduce a required paid service.
- Bump `SEED_VERSION` in `src/lib/seed/run.ts` when the synthetic world changes (triggers auto-reseed).
