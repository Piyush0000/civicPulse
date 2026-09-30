import { catLabel } from "../categories";
import { config } from "../config";
import { q, q1 } from "../db";
import { pseudonym } from "../privacy";
import { intake, processRequest } from "../pipeline";
import { REGIONS } from "../regions";
import { MSG, pickLang } from "./i18n";

// Telegram Bot API (free). Works in long-polling mode locally (no public URL needed) or via webhook.

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; language_code?: string };
    text?: string;
    voice?: { file_id: string; mime_type?: string; duration: number };
    audio?: { file_id: string; mime_type?: string };
    location?: { latitude: number; longitude: number };
  };
};

async function api<T = unknown>(method: string, body: object): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40000),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`telegram ${method}: ${data.description}`);
  return data.result;
}

export async function sendTelegram(chatId: string | number, text: string) {
  if (!config.telegramToken) return;
  await api("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" }).catch(() => undefined);
}

async function download(fileId: string): Promise<Buffer> {
  const f = await api<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegramToken}/${f.file_path}`);
  return Buffer.from(await res.arrayBuffer());
}

type State = { region?: string; consent?: boolean; lang?: string; lat?: number; lng?: number; pending?: { text?: string; voice?: string; mime?: string } };

async function getState(chatId: string): Promise<State> {
  const ph = pseudonym("telegram", chatId);
  const row = await q1<{ pending_state: State | null; opted_out_at: Date | null; consent_given_at: Date | null }>(
    `SELECT c.pending_state, r.opted_out_at, r.consent_given_at FROM reporters r LEFT JOIN reporter_contacts c ON c.reporter_id=r.id WHERE r.pseudonym_hash=$1`,
    [ph],
  );
  const s = row?.pending_state ?? {};
  if (row?.consent_given_at && !row.opted_out_at) s.consent = true;
  return s;
}

async function saveState(chatId: string, s: State) {
  const ph = pseudonym("telegram", chatId);
  const [rep] = await q<{ id: string }>(
    `INSERT INTO reporters (region_code, pseudonym_hash, preferred_language, consent_given_at)
     VALUES ($1,$2,$3,$4) ON CONFLICT (pseudonym_hash) DO UPDATE SET last_seen_at=now(), preferred_language=EXCLUDED.preferred_language,
       consent_given_at=COALESCE(reporters.consent_given_at, EXCLUDED.consent_given_at), opted_out_at=NULL RETURNING id`,
    [s.region ?? "IN-DL", ph, s.lang ?? "en", s.consent ? new Date() : null],
  );
  const { encrypt } = await import("../privacy");
  await q(
    `INSERT INTO reporter_contacts (reporter_id, channel, external_id_encrypted, pending_state) VALUES ($1,'telegram',$2,$3::jsonb)
     ON CONFLICT (reporter_id) DO UPDATE SET pending_state=EXCLUDED.pending_state, updated_at=now()`,
    [rep.id, encrypt(chatId), JSON.stringify(s)],
  );
}

const CITY_ALIASES: Record<string, string> = {
  delhi: "IN-DL", दिल्ली: "IN-DL", mumbai: "IN-MH", मुंबई: "IN-MH", chennai: "IN-TN", சென்னை: "IN-TN",
  kolkata: "IN-WB", কলকাতা: "IN-WB", hyderabad: "IN-TS", హైదరాబాద్: "IN-TS",
};

// "ok", "thanks", "hi", "theek hai", emoji-only… (whole message, any case)
export const SMALLTALK = /^(ok(ay)?|k|kk|thanks?|thank you|thx|ty|hi+|hello|hey|good (morning|night|evening)|bye|done|sure|fine|great|nice|cool|theek hai|thik hai|accha|achha|haan|han|ji|dhanyavad|dhanyawad|shukriya|धन्यवाद|शुक्रिया|ठीक है|अच्छा|हाँ|नमस्ते|[\p{Extended_Pictographic}\s!.]+)[\s!.]*$/iu;
const YES = /^(yes|y|ok|haan|हाँ|हां|ha|हो|होय|ஆம்|అవును|হ্যাঁ)/i;

export async function handleTelegramUpdate(u: TgUpdate): Promise<void> {
  const m = u.message;
  if (!m) return;
  const chatId = String(m.chat.id);
  const state = await getState(chatId);
  const lang = state.lang ?? pickLang(m.from?.language_code, m.text);
  state.lang = lang;
  const t = MSG[lang] ?? MSG.en;
  const text = (m.text ?? "").trim();

  if (/^\/?stop$/i.test(text)) {
    const ph = pseudonym("telegram", chatId);
    await q("UPDATE reporters SET opted_out_at=now() WHERE pseudonym_hash=$1", [ph]);
    await q("DELETE FROM reporter_contacts WHERE reporter_id IN (SELECT id FROM reporters WHERE pseudonym_hash=$1)", [ph]);
    return sendTelegram(chatId, t.stopped);
  }
  const status = text.match(/^\/?status\s+(CP-[A-Z0-9]{6})/i);
  if (status) {
    const r = await q1<{ status: string; category: string | null; pipeline_status: string }>(
      "SELECT status, category, pipeline_status FROM requests WHERE tracking_code=$1",
      [status[1].toUpperCase()],
    );
    return sendTelegram(chatId, r ? t.status(status[1].toUpperCase(), r.status, r.category ? catLabel(r.category, lang) : "…") : t.notFound);
  }
  const city = text.match(/^\/?city\s+(.+)/i);
  if (city) {
    const code = CITY_ALIASES[city[1].trim().toLowerCase()];
    if (code) state.region = code;
    await saveState(chatId, state);
    return sendTelegram(chatId, t.city(REGIONS.find((r) => r.code === state.region)?.name ?? "Delhi NCT"));
  }
  if (m.location) {
    state.lat = m.location.latitude;
    state.lng = m.location.longitude;
    await saveState(chatId, state);
    return sendTelegram(chatId, t.gotLocation);
  }
  if (text === "/start" || (!state.consent && !YES.test(text))) {
    if (text !== "/start") state.pending = { text: m.text, voice: m.voice?.file_id ?? m.audio?.file_id, mime: m.voice?.mime_type ?? m.audio?.mime_type };
    await saveState(chatId, state);
    return sendTelegram(chatId, t.consent);
  }
  let payload: State["pending"] = { text: m.text, voice: m.voice?.file_id ?? m.audio?.file_id, mime: m.voice?.mime_type ?? m.audio?.mime_type };
  if (!state.consent && YES.test(text)) {
    state.consent = true;
    payload = state.pending;
    state.pending = undefined;
    await saveState(chatId, state);
    await sendTelegram(chatId, t.thanksConsent);
    if (!payload || (!payload.text && !payload.voice)) return;
  }
  // Acknowledgements and greetings are conversation, not complaints.
  if (!payload?.voice && SMALLTALK.test((payload?.text ?? "").trim())) return sendTelegram(chatId, t.smalltalk ?? MSG.en.smalltalk!);
  const audio = payload?.voice ? { data: await download(payload.voice), mime: payload.mime ?? "audio/ogg" } : null;
  const res = await intake({
    region: state.region ?? "IN-DL",
    channel: "telegram",
    externalUserId: chatId,
    externalMessageId: `${chatId}:${m.message_id}`,
    text: payload?.text && !payload.text.startsWith("/") ? payload.text : null,
    audio,
    lat: state.lat ?? null,
    lng: state.lng ?? null,
    language: lang,
    replyTo: { channel: "telegram", chatId },
  });
  state.lat = undefined;
  state.lng = undefined;
  await saveState(chatId, state);
  await sendTelegram(chatId, t.received(res.trackingCode));
  if (res.duplicate) return;
  await processRequest(res.requestId);
  const done = await q1<{ category: string; urgency: string; admin_name: string | null; pipeline_status: string; pipeline_error: string | null; is_actionable: boolean }>(
    "SELECT category, urgency, admin_name, pipeline_status, pipeline_error, is_actionable FROM requests WHERE id=$1",
    [res.requestId],
  );
  if (done?.pipeline_status === "completed" && !done.is_actionable) await sendTelegram(chatId, t.notActionable ?? MSG.en.notActionable!);
  else if (done?.pipeline_status === "completed")
    await sendTelegram(chatId, t.understood(catLabel(done.category, lang), done.urgency, done.admin_name));
  else await sendTelegram(chatId, t.failed);
}

// ---------------------------------------------------------------- long polling

type G = { __cpTgPolling?: boolean };
const g = globalThis as unknown as G;

export function startTelegramPolling() {
  if (!config.telegramToken || config.telegramMode !== "polling" || g.__cpTgPolling) return;
  g.__cpTgPolling = true;
  let offset = 0;
  const loop = async () => {
    try {
      // A webhook means a deployed server owns this bot: never take it over from a dev machine.
      const hook = await api<{ url: string }>("getWebhookInfo", {}).catch(() => ({ url: "" }));
      if (hook.url) {
        console.warn("[telegram] a deployed server owns this bot (webhook active): local polling disabled");
        return;
      }
      for (;;) {
        let webhookActive = false;
        const updates = await api<TgUpdate[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }).catch(async (e) => {
          const msg = (e as Error).message;
          if (/webhook is active/i.test(msg)) webhookActive = true;
          else console.error("[telegram]", msg);
          await new Promise((r) => setTimeout(r, 5000));
          return [] as TgUpdate[];
        });
        if (webhookActive) {
          console.warn("[telegram] a deployed server took over this bot (webhook set): local polling stopped");
          return;
        }
        for (const u of updates) {
          offset = u.update_id + 1;
          handleTelegramUpdate(u).catch((e) => console.error("[telegram] handler", e));
        }
      }
    } finally {
      g.__cpTgPolling = false;
    }
  };
  void loop();
  console.log("[telegram] polling started");
}

/** Webhook mode: point Telegram at this server (idempotent). Needs a public HTTPS APP_URL. */
export async function registerTelegramWebhook() {
  if (!config.telegramToken || config.telegramMode !== "webhook" || !config.appUrl) return;
  const url = `${config.appUrl.replace(/\/$/, "")}/api/v1/webhooks/telegram/${config.telegramWebhookSecret}`;
  await api("setWebhook", { url, allowed_updates: ["message"] })
    .then(() => console.log("[telegram] webhook registered"))
    .catch((e) => console.error("[telegram] setWebhook failed:", (e as Error).message));
}
