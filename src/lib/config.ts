// Central runtime configuration. Every provider is optional: with no keys the app runs on
// built-in fallbacks (PGlite, rule-based AI, hashed embeddings, SSE).

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "CivicPulse";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  appName: APP_NAME,
  databaseUrl: env("DATABASE_URL"),
  pgliteDir: env("PGLITE_DIR") || ".data/pglite",
  dataDir: env("DATA_DIR") || ".data",
  secretKey: env("SECRET_KEY") || "dev-secret-change-me-dev-secret-change-me",
  pseudonymSecret: env("PSEUDONYM_HMAC_SECRET") || "dev-pseudonym-secret",
  contactKey: env("CONTACT_ENCRYPTION_KEY") || "dev-contact-key-change-me",
  intakeKey: env("INTAKE_API_KEY") || "dev-intake-key",
  groqKey: env("GROQ_API_KEY"),
  groqModel: env("GROQ_MODEL") || "llama-3.3-70b-versatile",
  groqSttModel: env("GROQ_STT_MODEL") || "whisper-large-v3",
  geminiKey: env("GEMINI_API_KEY"),
  geminiModel: env("GEMINI_MODEL") || "gemini-2.5-flash",
  geminiEmbedModel: env("GEMINI_EMBED_MODEL") || "gemini-embedding-001",
  translateFallback: (env("TRANSLATE_FALLBACK") || "mymemory") as "mymemory" | "none",
  geocoder: (env("GEOCODER") || "gazetteer_then_nominatim") as "offline" | "gazetteer_then_nominatim",
  nominatimUserAgent: env("NOMINATIM_USER_AGENT") || "civicpulse-hackathon-demo",
  telegramToken: env("TELEGRAM_BOT_TOKEN"),
  telegramMode: (env("TELEGRAM_MODE") || "polling") as "polling" | "webhook",
  telegramWebhookSecret: env("TELEGRAM_WEBHOOK_SECRET") || "dev-telegram-secret",
  supabaseUrl: env("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  clusterSimThreshold: Number(env("CLUSTER_SIM_THRESHOLD") || 0.8),
  hotspotMinRequests: Number(env("HOTSPOT_MIN_REQUESTS") || 3),
  kAnonThreshold: Number(env("K_ANON_THRESHOLD") || 5),
  rawAudioRetentionDays: Number(env("RAW_AUDIO_RETENTION_DAYS") || 30),
  requestTextRetentionDays: Number(env("REQUEST_TEXT_RETENTION_DAYS") || 730),
  autoSeed: env("AUTO_SEED") !== "false",
  embedDim: 256,
};

export type ProviderStatus = {
  database: "supabase/postgres" | "pglite (embedded)";
  llm: string[];
  stt: string[];
  embeddings: string;
  realtime: "supabase" | "sse";
  telegram: "disabled" | "polling" | "webhook";
  geocoder: string;
};

export function providerStatus(): ProviderStatus {
  const llm: string[] = [];
  if (config.groqKey) llm.push(`groq:${config.groqModel}`);
  if (config.geminiKey) llm.push(`gemini:${config.geminiModel}`);
  llm.push("rules (offline fallback)");
  const stt: string[] = [];
  if (config.groqKey) stt.push(`groq:${config.groqSttModel}`);
  if (config.geminiKey) stt.push(`gemini:${config.geminiModel}`);
  stt.push("browser Web Speech transcript");
  return {
    database: config.databaseUrl ? "supabase/postgres" : "pglite (embedded)",
    llm,
    stt,
    embeddings: config.geminiKey ? `gemini:${config.geminiEmbedModel}` : "hashed char n-grams (offline)",
    realtime: config.supabaseUrl ? "supabase" : "sse",
    telegram: config.telegramToken ? config.telegramMode : "disabled",
    geocoder: config.geocoder,
  };
}
