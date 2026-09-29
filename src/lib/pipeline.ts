import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gridDisk, latLngToCell } from "h3-js";
import { embedText } from "./ai/embed";
import { extract } from "./ai/extract";
import { detectLanguage } from "./ai/langdetect";
import { transcribe, translateToEnglish } from "./ai/speech";
import { ClusterIndex } from "./analytics/clustering";
import { recomputeRegion } from "./analytics/engine";
import { config } from "./config";
import { getDb, q, q1 } from "./db";
import { publish } from "./events";
import { geocode } from "./geocode";
import { insideRegion, nearestLocality } from "./geo";
import { encrypt, pseudonym, redactNames, redactRegex, trackingCode } from "./privacy";
import { getRegion } from "./regions";

export type IntakeInput = {
  region: string;
  channel: "web" | "telegram" | "ivr" | "ussd" | "sms" | "whatsapp";
  externalUserId?: string | null; // chat id / phone; hashed, never stored in clear
  externalMessageId?: string | null;
  text?: string | null;
  transcriptHint?: string | null; // browser Web Speech transcript
  audio?: { data: Buffer; mime: string } | null;
  lat?: number | null;
  lng?: number | null;
  language?: string | null;
  replyTo?: { channel: "telegram"; chatId: string } | null;
  photoUrl?: string | null;
};

export type IntakeResult = { requestId: string; trackingCode: string; duplicate: boolean };

type LogEntry = { step: string; ms: number; info?: string };

export async function intake(input: IntakeInput): Promise<IntakeResult> {
  const db = await getDb();
  const region = getRegion(input.region);
  const extId = input.externalMessageId || randomUUID();
  const dup = await q1<{ tracking_code: string; id: string }>(
    `SELECT r.tracking_code, r.id FROM raw_messages m JOIN requests r ON r.raw_message_id = m.id
      WHERE m.channel=$1 AND m.external_message_id=$2`,
    [input.channel, extId],
  );
  if (dup) return { requestId: dup.id, trackingCode: dup.tracking_code, duplicate: true };

  let reporterId: string | null = null;
  if (input.externalUserId) {
    const ph = pseudonym(input.channel, input.externalUserId);
    const [rep] = await db.query<{ id: string }>(
      `INSERT INTO reporters (region_code, pseudonym_hash, preferred_language, consent_given_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (pseudonym_hash) DO UPDATE SET last_seen_at=now() RETURNING id`,
      [region.code, ph, input.language ?? null],
    );
    reporterId = rep.id;
    if (input.replyTo) {
      await db.query(
        `INSERT INTO reporter_contacts (reporter_id, channel, external_id_encrypted) VALUES ($1,$2,$3)
         ON CONFLICT (reporter_id) DO UPDATE SET external_id_encrypted=EXCLUDED.external_id_encrypted, updated_at=now()`,
        [reporterId, input.replyTo.channel, encrypt(input.replyTo.chatId)],
      );
    }
  }

  let audioPath: string | null = null;
  if (input.audio?.data.length) {
    const dir = path.join(config.dataDir, "audio");
    await fs.mkdir(dir, { recursive: true });
    const ext = input.audio.mime.includes("ogg") ? "ogg" : input.audio.mime.includes("wav") ? "wav" : input.audio.mime.includes("mpeg") ? "mp3" : "webm";
    audioPath = path.join(dir, `${randomUUID()}.${ext}`);
    await fs.writeFile(audioPath, input.audio.data);
  }

  const [raw] = await db.query<{ id: string }>(
    `INSERT INTO raw_messages (region_code, reporter_id, channel, external_message_id, content_type, text_original, transcript_hint, audio_path, audio_mime, lat, lng, photo_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [region.code, reporterId, input.channel, extId, audioPath ? "audio" : "text", input.text ?? null, input.transcriptHint ?? null, audioPath, input.audio?.mime ?? null, input.lat ?? null, input.lng ?? null, input.photoUrl ?? null],
  );

  let code = trackingCode();
  for (let i = 0; i < 5; i++) {
    const exists = await q1("SELECT 1 FROM requests WHERE tracking_code=$1", [code]);
    if (!exists) break;
    code = trackingCode();
  }
  const [req] = await db.query<{ id: string }>(
    `INSERT INTO requests (region_code, raw_message_id, reporter_id, tracking_code, channel, pipeline_status, language_detected, input_mode, photo_url)
     VALUES ($1,$2,$3,$4,$5,'received',$6,$7,$8) RETURNING id`,
    [region.code, raw.id, reporterId, code, input.channel, input.language ?? null, audioPath || input.transcriptHint ? "voice" : "text", input.photoUrl ?? null],
  );
  await publish({ type: "pipeline", region: region.code, id: req.id, tracking: code, step: "received", at: new Date().toISOString() });
  return { requestId: req.id, trackingCode: code, duplicate: false };
}

async function setStatus(id: string, status: string, log: LogEntry[], extra: Record<string, unknown> = {}) {
  const keys = Object.keys(extra);
  const sets = keys.map((k, i) => `${k}=$${i + 4}`);
  await q(
    `UPDATE requests SET pipeline_status=$2, pipeline_log=$3::jsonb${sets.length ? ", " + sets.join(", ") : ""} WHERE id=$1`,
    [id, status, JSON.stringify(log), ...keys.map((k) => extra[k])],
  );
}

/** Idempotent pipeline: re-running rewrites the same fields. Failures are recorded on the request. */
export async function processRequest(requestId: string): Promise<void> {
  const req = await q1<{ id: string; region_code: string; tracking_code: string; channel: string; reporter_id: string | null; language_detected: string | null; raw_message_id: string }>(
    "SELECT id, region_code, tracking_code, channel, reporter_id, language_detected, raw_message_id FROM requests WHERE id=$1",
    [requestId],
  );
  if (!req) return;
  const raw = await q1<{ text_original: string | null; transcript_hint: string | null; audio_path: string | null; audio_mime: string | null; lat: number | null; lng: number | null }>(
    "SELECT text_original, transcript_hint, audio_path, audio_mime, lat, lng FROM raw_messages WHERE id=$1",
    [req.raw_message_id],
  );
  if (!raw) return;
  const region = getRegion(req.region_code);
  const log: LogEntry[] = [];
  const step = async <T>(name: string, fn: () => Promise<T>, info?: (v: T) => string): Promise<T> => {
    const t = Date.now();
    const v = await fn();
    log.push({ step: name, ms: Date.now() - t, info: info?.(v) });
    await publish({ type: "pipeline", region: region.code, id: req.id, tracking: req.tracking_code, step: name, at: new Date().toISOString() });
    return v;
  };

  try {
    // 1. speech-to-text
    let text = raw.text_original?.trim() || "";
    let sttLang: string | null = null;
    if (raw.audio_path) {
      const stt = await step(
        "transcribed",
        async () => {
          const data = await fs.readFile(raw.audio_path!);
          return transcribe(data, raw.audio_mime || "audio/webm", req.language_detected ?? undefined);
        },
        (r) => (r ? r.provider : raw.transcript_hint ? "browser transcript" : "none"),
      );
      if (stt?.text) {
        text = [text, stt.text].filter(Boolean).join("\n");
        sttLang = stt.language;
      } else if (raw.transcript_hint) text = [text, raw.transcript_hint].filter(Boolean).join("\n");
    } else if (!text && raw.transcript_hint) text = raw.transcript_hint;
    if (!text) throw new Error("No text or transcript available: speech-to-text is not configured on the server.");
    await setStatus(req.id, "transcribed", log);

    // 2. language
    const detected = detectLanguage(text);
    const language = sttLang || (detected.confidence >= 0.6 ? detected.lang : req.language_detected || detected.lang);
    log.push({ step: "language", ms: 0, info: `${language} (${detected.confidence.toFixed(2)})` });

    // 3. translate to English pivot (on regex-redacted text so PII never leaves the server)
    const redacted = redactRegex(text);
    const tr = await step("translated", () => translateToEnglish(redacted, language), (r) => r.provider);
    const english = redactRegex(tr.text);
    await setStatus(req.id, "translated", log, { language_detected: language });

    // 4 + 5. structured extraction (also returns person names for redaction)
    const ex = await step(
      "extracted",
      () => extract({ original: redacted, english, language, region: region.name, channel: req.channel }),
      (r) => `${r.provider} → ${r.value.category}/${r.value.urgency} (${r.value.confidence})`,
    );
    const e = ex.value;
    const origFinal = redactNames(redacted, e.person_names_detected);
    const engFinal = redactNames(english, e.person_names_detected);
    await setStatus(req.id, "extracted", log, {
      text_original_redacted: origFinal,
      text_english_redacted: engFinal,
      category: e.category,
      subcategory: e.subcategory,
      urgency: e.urgency,
      urgency_reason: e.urgency_reason,
      summary: redactNames(e.summary, e.person_names_detected),
      affected_group: e.affected_group,
      estimated_people_affected: e.estimated_people_affected,
      location_text: e.location_text,
      is_actionable: e.is_actionable && !e.is_spam,
      is_spam: e.is_spam,
      extraction_confidence: e.confidence,
      extraction_provider: `${ex.provider} [${ex.promptVersion}]`,
    });

    // 6. geocode: pin > gazetteer > Nominatim
    let lat: number | null = null,
      lng: number | null = null,
      precision = "unknown",
      admin: string | null = null;
    if (raw.lat !== null && raw.lng !== null && insideRegion(region, raw.lat, raw.lng)) {
      lat = raw.lat;
      lng = raw.lng;
      precision = "exact_pin";
      admin = nearestLocality(region, lat, lng).loc.name;
      log.push({ step: "geocoded", ms: 0, info: "exact pin" });
    } else if (e.is_actionable && !e.is_spam) {
      // Only real complaints are geocoded: free text like "ok" must never be matched to a place.
      const hit = await step("geocoded", () => geocode(region.code, e.location_text || `${origFinal} ${engFinal}`), (h) => (h ? `${h.source} → ${h.admin ?? "point"}` : "unlocated"));
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
        precision = hit.precision;
        admin = hit.admin ?? nearestLocality(region, hit.lat, hit.lng).loc.name;
      }
    }
    const h3 = lat !== null && lng !== null ? latLngToCell(lat, lng, region.h3Res) : null;
    const cellOk = h3 ? await q1("SELECT 1 FROM h3_cells WHERE region_code=$1 AND h3_cell=$2", [region.code, h3]) : null;
    await setStatus(req.id, "geocoded", log, {
      lat,
      lng,
      h3_cell: cellOk ? h3 : null,
      location_precision: cellOk ? precision : "unknown",
      admin_name: cellOk ? admin : null,
    });

    // 7 + 8. embed and assign to a cluster
    const embedding = embedText(`${e.summary} | ${e.subcategory}`);
    let clusterId: string | null = null;
    if (cellOk && h3 && e.is_actionable && !e.is_spam) {
      clusterId = await step("clustered", () => assignCluster(region.code, req.id, e.category, h3, embedding, req.reporter_id), (c) => c);
    }
    await setStatus(req.id, "completed", log, { embedding, cluster_id: clusterId, processed_at: new Date(), pipeline_error: null });

    const done = await q1<{ summary: string; category: string; urgency: string; language_detected: string; lat: number | null; lng: number | null; h3_cell: string | null }>(
      "SELECT summary, category, urgency, language_detected, lat, lng, h3_cell FROM requests WHERE id=$1",
      [req.id],
    );
    await publish({
      type: "request",
      region: region.code,
      id: req.id,
      tracking: req.tracking_code,
      category: done!.category,
      urgency: done!.urgency,
      language: done!.language_detected,
      channel: req.channel,
      summary: done!.summary,
      lat: done!.lat,
      lng: done!.lng,
      h3: done!.h3_cell,
      at: new Date().toISOString(),
    });
    scheduleRecompute(region.code);
  } catch (err) {
    log.push({ step: "failed", ms: 0, info: String((err as Error).message) });
    await setStatus(req.id, "failed", log, { pipeline_error: String((err as Error).message).slice(0, 500) });
    await publish({ type: "pipeline", region: region.code, id: req.id, tracking: req.tracking_code, step: "failed", at: new Date().toISOString() });
  }
}

async function assignCluster(region: string, requestId: string, category: string, h3: string, embedding: number[], reporter: string | null): Promise<string> {
  const ring = gridDisk(h3, 1);
  const rows = await q<{ id: string; category: string; centroid: number[]; h3_cells: string[]; request_count: number; unique_reporter_count: number; first_seen_at: Date; last_seen_at: Date; representative_request_id: string }>(
    "SELECT * FROM clusters WHERE region_code=$1 AND category=$2 AND h3_cells && $3::text[]",
    [region, category, ring],
  );
  const idx = new ClusterIndex(config.clusterSimThreshold, () => randomUUID());
  for (const r of rows)
    idx.add({
      id: r.id,
      category: r.category,
      centroid: r.centroid,
      cells: new Set(r.h3_cells),
      count: r.request_count,
      reporters: new Set(),
      firstSeen: new Date(r.first_seen_at),
      lastSeen: new Date(r.last_seen_at),
      representative: r.representative_request_id,
    });
  const { cluster, created } = idx.assign({ id: requestId, category, h3, embedding, reporter, at: new Date() });
  if (created) {
    await q(
      `INSERT INTO clusters (id, region_code, category, centroid, representative_request_id, label, request_count, unique_reporter_count, h3_cells)
       VALUES ($1,$2,$3,$4,$5,(SELECT subcategory FROM requests WHERE id=$5),1,1,$6)`,
      [cluster.id, region, category, cluster.centroid, requestId, [...cluster.cells]],
    );
  } else {
    await q(
      `UPDATE clusters SET centroid=$2, request_count=request_count+1, h3_cells=$3, last_seen_at=now(),
         unique_reporter_count=(SELECT count(DISTINCT reporter_id)::int FROM requests WHERE cluster_id=$1 OR id=$4)
       WHERE id=$1`,
      [cluster.id, cluster.centroid, [...cluster.cells], requestId],
    );
  }
  return cluster.id;
}

// ---------------------------------------------------------------- debounced re-scoring

type Timers = { __cpRecompute?: Map<string, { timer: NodeJS.Timeout; last: number }> };
const gt = globalThis as unknown as Timers;
const timers = gt.__cpRecompute ?? (gt.__cpRecompute = new Map());

export function scheduleRecompute(region: string, delayMs = 4000) {
  const cur = timers.get(region);
  if (cur) clearTimeout(cur.timer);
  const last = cur?.last ?? 0;
  const wait = Math.max(delayMs, last + 15000 - Date.now());
  const timer = setTimeout(async () => {
    timers.set(region, { timer, last: Date.now() });
    try {
      await recomputeRegion(region, { briefsTopN: 3, useLLM: false });
    } catch (e) {
      console.error("recompute failed", e);
    }
  }, wait);
  timers.set(region, { timer, last });
}
