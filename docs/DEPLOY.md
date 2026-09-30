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

## A2. VPS with auto-deploy (what the live demo uses)

Any Ubuntu VPS with Node 20+, nginx, pm2 and certbot. Layout under `/var/www/civicpulse`:
`shared/.env.local` (secrets), `releases/<sha>/` (one build per deploy, last 3 kept), `current -> releases/<sha>` (served by pm2 on 127.0.0.1:3100 behind nginx + Let's Encrypt).

- `scripts/deploy-vps.sh` is installed as `/usr/local/bin/civicpulse-deploy`. It builds a commit next to the live release, flips `current` only after a successful build, restarts pm2, health-checks, and rolls back if the new release is unhealthy. Run it by hand to deploy the latest `main`.
- On the VPS set `TELEGRAM_MODE=webhook` and `APP_URL=https://<your-host>`: the bot registers its webhook on boot, and dev machines polling the same token back off automatically.
- GitHub Actions connects with a deploy-only key whose `authorized_keys` line forces that one command:
  `command="/usr/local/bin/civicpulse-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA… github-actions-civicpulse-deploy`

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

## CI/CD (GitHub Actions)

- **`CI`** (`.github/workflows/ci.yml`) runs on every push to `main`, every PR, and on demand. It has two parallel jobs:
  - *Typecheck · Lint · Unit tests*: `npm run typecheck` (runs `next typegen` first, because Next 16 route types live in the gitignored `.next/types`), `npm run lint` (zero warnings allowed), `npm test`.
  - *Build · End-to-end smoke test*: `npm run build`, `npm start`, then `npm run smoke`. The smoke test waits for the demo world to seed and checks portals, RBAC, the AI pipeline, analytics, what-if and the ledger. It uses offline providers only.
- **`Deploy`** (`.github/workflows/deploy.yml`) runs after a green CI on `main`: it SSHes to the VPS with the deploy-only key (repository secret `VPS_SSH_KEY`, host key pinned in the workflow), deploys the exact commit CI tested, then checks the public health endpoint. Without the secret it logs a notice and skips.

Run the same checks locally with `npm run ci`, and the smoke test against a running server with `npm run smoke`.
