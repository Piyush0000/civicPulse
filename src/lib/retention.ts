import fs from "node:fs/promises";
import { config } from "./config";
import { q } from "./db";

/** Privacy retention: delete raw audio after N days, strip old request text, drop opted-out contacts. */
export async function retentionCleanup() {
  const audioCutoff = new Date(Date.now() - config.rawAudioRetentionDays * 86400000);
  const textCutoff = new Date(Date.now() - config.requestTextRetentionDays * 86400000);
  const audio = await q<{ id: string; audio_path: string }>(
    "SELECT id, audio_path FROM raw_messages WHERE audio_path IS NOT NULL AND received_at < $1",
    [audioCutoff],
  );
  for (const a of audio) await fs.rm(a.audio_path, { force: true }).catch(() => undefined);
  if (audio.length) await q("UPDATE raw_messages SET audio_path=NULL WHERE id = ANY($1::uuid[])", [audio.map((a) => a.id)]);
  const texts = await q<{ n: number }>(
    `WITH u AS (UPDATE raw_messages SET text_original=NULL, transcript_hint=NULL WHERE received_at < $1 AND text_original IS NOT NULL RETURNING 1)
     SELECT count(*)::int n FROM u`,
    [textCutoff],
  );
  await q(
    "UPDATE requests SET text_original_redacted='[expired]', text_english_redacted='[expired]' WHERE submitted_at < $1 AND text_original_redacted <> '[expired]'",
    [textCutoff],
  );
  await q("DELETE FROM reporter_contacts WHERE reporter_id IN (SELECT id FROM reporters WHERE opted_out_at IS NOT NULL)");
  await q("INSERT INTO job_runs (name, finished_at, status, detail) VALUES ('retention', now(), 'ok', $1::jsonb)", [
    JSON.stringify({ audioDeleted: audio.length, textsExpired: texts[0]?.n ?? 0 }),
  ]);
  return { audioDeleted: audio.length, textsExpired: texts[0]?.n ?? 0 };
}
