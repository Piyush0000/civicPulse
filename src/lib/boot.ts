import { config } from "./config";
import { q1 } from "./db";
import { registerTelegramWebhook, startTelegramPolling } from "./messaging/telegram";
import { resetAll, SEED_VERSION, seedAll, seedStatus } from "./seed/run";

type G = { __cpBooted?: boolean; __cpSeeding?: Promise<void> };
const g = globalThis as unknown as G;

/** Seed the demo world on first run (or when the seed format changed), then start channel pollers. */
export async function ensureSeeded(): Promise<void> {
  if (g.__cpSeeding) return; // already building in the background
  const st = await seedStatus();
  const hasData = await q1("SELECT 1 FROM regions LIMIT 1");
  const stale = st?.version !== SEED_VERSION || st?.status !== "done";
  if (hasData && !stale) return;
  if (!config.autoSeed && hasData) return;
  // Never wipe real citizen data automatically. A reset only happens when every request is synthetic;
  // otherwise an operator must run `npm run seed -- --reset` deliberately.
  const live = await q1<{ n: number }>("SELECT count(*)::int n FROM requests WHERE NOT is_synthetic");
  if (hasData && (live?.n ?? 0) > 0) {
    console.warn(`[civicpulse] demo data is outdated, but ${live!.n} real citizen request(s) exist: NOT resetting. Run \`npm run seed -- --reset\` to rebuild.`);
    return;
  }
  console.log(`[civicpulse] seeding demo data (reason: ${hasData ? "seed format changed or interrupted" : "empty database"})…`);
  // Wipe first and wait for it, so nothing that arrives afterwards (e.g. a Telegram message) can be erased.
  await resetAll();
  g.__cpSeeding = seedAll({ reset: false })
    .then(() => console.log("[civicpulse] demo data ready"))
    .catch((e) => console.error("[civicpulse] seed failed", e))
    .finally(() => {
      g.__cpSeeding = undefined;
    });
  // Seeding continues in the background; callers only wait for the reset above.
}

export async function boot() {
  if (g.__cpBooted) return;
  g.__cpBooted = true;
  try {
    // Returns as soon as any reset is done; the demo world keeps building in the background.
    await ensureSeeded();
  } catch (e) {
    console.error("[civicpulse] boot failed", e);
  }
  // Channels start only after a possible reset, so no citizen message can be wiped, and never wait for seeding.
  startTelegramPolling();
  void registerTelegramWebhook();
  // Retention housekeeping every 12h (serverless deployments call POST /api/v1/admin/retention from a free cron).
  const { retentionCleanup } = await import("./retention");
  const run = () => void retentionCleanup().catch((e) => console.error("[retention]", e));
  setTimeout(run, 60_000);
  setInterval(run, 12 * 3600_000).unref?.();
}
