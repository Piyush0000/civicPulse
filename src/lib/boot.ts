import { config } from "./config";
import { q1 } from "./db";
import { startTelegramPolling } from "./messaging/telegram";
import { SEED_VERSION, seedAll, seedStatus } from "./seed/run";

type G = { __cpBooted?: boolean; __cpSeeding?: Promise<void> };
const g = globalThis as unknown as G;

/** Seed the demo world on first run (or when the seed format changed), then start channel pollers. */
export async function ensureSeeded(): Promise<void> {
  if (g.__cpSeeding) return g.__cpSeeding;
  const st = await seedStatus();
  const hasData = await q1("SELECT 1 FROM regions LIMIT 1");
  const stale = st?.version !== SEED_VERSION || st?.status !== "done";
  if (hasData && !stale) return;
  if (!config.autoSeed && hasData) return;
  console.log(`[civicpulse] seeding demo data (reason: ${hasData ? "seed format changed or interrupted" : "empty database"})…`);
  g.__cpSeeding = seedAll({ reset: true })
    .then(() => console.log("[civicpulse] demo data ready"))
    .catch((e) => console.error("[civicpulse] seed failed", e))
    .finally(() => {
      g.__cpSeeding = undefined;
    });
  return g.__cpSeeding;
}

export async function boot() {
  if (g.__cpBooted) return;
  g.__cpBooted = true;
  // Channels start immediately; citizens must never wait for the demo world to (re)build.
  startTelegramPolling();
  try {
    await ensureSeeded();
  } catch (e) {
    console.error("[civicpulse] boot failed", e);
  }
  // Retention housekeeping every 12h (serverless deployments call POST /api/v1/admin/retention from a free cron).
  const { retentionCleanup } = await import("./retention");
  const run = () => void retentionCleanup().catch((e) => console.error("[retention]", e));
  setTimeout(run, 60_000);
  setInterval(run, 12 * 3600_000).unref?.();
}
