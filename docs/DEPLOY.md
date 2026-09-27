# Deploying CivicPulse for free

No paid service is required anywhere. Pick one path.

## A. Laptop / on-prem server (simplest, fully offline-capable)

```bash
npm install
npm run build
npm start          # http://localhost:3000, embedded PGlite in .data/
```

Any machine with Node 20+ works: a ministry server, a Raspberry Pi 5, a cloud VM free tier.
For a public URL without opening ports, use a free Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`).

## B. Vercel (free Hobby) + Supabase (free)

1. **Supabase**: create a free project.
   - Settings → Database → *Connection string* → **Transaction pooler** URI → `DATABASE_URL`.
   - Settings → API → Project URL and `anon` key → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (enables Realtime broadcast, so Live Pulse works across serverless instances).
   - The schema is created automatically on first request, with no migrations to run.
2. **Seed once** from your laptop against Supabase: `DATABASE_URL=... npm run seed -- --reset` (about 1–2 min over the network).
3. **Vercel**: import the repo and set the environment variables from `.env.example`. Also set:
   - `DATA_DIR=/tmp` (voice notes are processed immediately; `/tmp` is ephemeral).
   - `AUTO_SEED=false` (you seeded in step 2).
   - `TELEGRAM_MODE=webhook`, then register the webhook once:
     `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>.vercel.app/api/v1/webhooks/telegram/<TELEGRAM_WEBHOOK_SECRET>`
4. Optional free keys: `GROQ_API_KEY`, `GEMINI_API_KEY`.
5. Retention: add a free cron (e.g. cron-job.org or a GitHub Actions schedule) that calls `POST /api/v1/admin/retention` with an admin session.

## C. Per-country federation

Each BRICS member runs its own instance (A or B) on national infrastructure. Peers exchange only
`GET /api/v1/federation/aggregate/<region>`: k-anonymous, HMAC-signed aggregates (schema `civicpulse.federation.v1`).
No personal data crosses borders.
