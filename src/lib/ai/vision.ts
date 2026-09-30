import { CATEGORIES, URGENCIES, type Category, type Urgency } from "../categories";
import { config } from "../config";
import { readLocalPhoto } from "../photos";
import { parseJsonObject } from "./llm";

// Evidence-photo analysis with a free vision model (Groq first, Gemini as fallback). The result is
// shown to officials next to the complaint; it never replaces the citizen's own words. Faces, number
// plates and names are never transcribed or identified.

export type PhotoAnalysis = {
  status: "done" | "failed" | "skipped";
  description: string;
  issue_category: Category | "none";
  severity: Urgency | "none";
  hazards: string[];
  matches_complaint: "yes" | "partly" | "no" | "no_text";
  match_reason: string;
  suggested_action: string;
  people_visible: boolean;
  confidence: number;
  analyzed_at: string;
  provider?: string; // backend only, never rendered
  error?: string;
};

const PROMPT_VERSION = "vision-v1";

const SYSTEM = `You are a civic infrastructure inspector for Indian city governments.
A citizen attached this photo as evidence for a public-service complaint. Analyse ONLY what is visible.
Rules:
- Never identify, name or describe any person's face or identity. Never transcribe number plates, phone numbers or names.
- If the photo does not show a civic problem (selfie, meme, screenshot, blank, unrelated), use issue_category "none".
- Be concrete and brief; officials read this on a phone.
Reply with ONE JSON object and nothing else:
{
 "description": "1-2 sentences: what the photo shows (the problem, not the people)",
 "issue_category": one of ${JSON.stringify([...CATEGORIES, "none"])},
 "severity": one of ["low","medium","high","critical","none"]  (critical = immediate danger to life or health),
 "hazards": ["short phrases, e.g. 'open manhole', 'exposed live wire', 'stagnant water / mosquito risk'"],
 "matches_complaint": "yes" | "partly" | "no" | "no_text"  (does the photo support the complaint text? "no_text" if none was given),
 "match_reason": "one short sentence",
 "suggested_action": "the first concrete repair/response step for the department",
 "people_visible": true | false,
 "confidence": 0.0-1.0
}`;

type Vp = { name: string; url: string; key: string; model: string };

function visionProviders(): Vp[] {
  const out: Vp[] = [];
  if (config.groqKey) out.push({ name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: config.groqKey, model: config.groqVisionModel });
  if (config.geminiKey)
    out.push({ name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: config.geminiKey, model: config.geminiModel });
  return out;
}

export const hasVision = () => config.photoAi && visionProviders().length > 0;

/** Load a stored photo (local or Cloudinary) and shrink it: 1024px keeps detail while halving vision tokens (free-tier TPM). */
async function loadAsDataUrl(photoUrl: string): Promise<string> {
  let data: Buffer;
  const local = photoUrl.match(/\/api\/v1\/public\/photos\/([^/?#]+)$/);
  if (local) {
    const p = await readLocalPhoto(local[1]);
    if (!p) throw new Error("photo file not found");
    data = p.data;
  } else if (/^https:\/\//.test(photoUrl)) {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`photo download ${res.status}`);
    data = Buffer.from(await res.arrayBuffer());
  } else throw new Error("unsupported photo location");
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(data).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : dflt);

/** Coerce model output into a safe, fully-typed shape (models occasionally drift from the schema). */
export function normalizeAnalysis(raw: unknown, hadText: boolean): Omit<PhotoAnalysis, "status" | "analyzed_at" | "provider"> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const conf = Number(o.confidence);
  return {
    description: str(o.description, 400) || "No description.",
    issue_category: pick(o.issue_category, [...CATEGORIES, "none"] as const, "none"),
    severity: pick(o.severity, [...URGENCIES, "none"] as const, "none"),
    hazards: (Array.isArray(o.hazards) ? o.hazards : []).filter((h): h is string => typeof h === "string" && h.trim() !== "").map((h) => h.trim().slice(0, 80)).slice(0, 6),
    matches_complaint: hadText ? pick(o.matches_complaint, ["yes", "partly", "no"] as const, "partly") : "no_text",
    match_reason: str(o.match_reason, 240),
    suggested_action: str(o.suggested_action, 240),
    people_visible: o.people_visible === true,
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
  };
}

const stripThinking = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

export async function analyzePhoto(photoUrl: string, complaintText: string | null): Promise<PhotoAnalysis> {
  const base = { analyzed_at: new Date().toISOString() };
  const empty = normalizeAnalysis({}, !!complaintText);
  if (!hasVision()) return { ...empty, ...base, status: "skipped", error: "photo analysis not configured" };
  let image: string;
  try {
    image = await loadAsDataUrl(photoUrl);
  } catch (e) {
    return { ...empty, ...base, status: "failed", error: `could not read photo: ${(e as Error).message}` };
  }
  const userText = complaintText?.trim()
    ? `Citizen's complaint text (may be in an Indian language):\n"""${complaintText.trim().slice(0, 1500)}"""`
    : "The citizen sent only this photo, with no text.";
  const errors: string[] = [];
  for (const p of visionProviders()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const body: Record<string, unknown> = {
          model: p.model,
          temperature: 0,
          max_tokens: 700,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: [{ type: "text", text: userText }, { type: "image_url", image_url: { url: image } }] },
          ],
        };
        if (p.name === "groq") body.response_format = { type: "json_object" };
        const res = await fetch(p.url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) {
          const msg = `${res.status} ${(await res.text()).slice(0, 200)}`;
          if ((res.status === 429 || res.status === 503) && attempt === 0) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error(msg);
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
        const parsed = parseJsonObject(stripThinking(data.choices?.[0]?.message?.content ?? ""));
        return { ...normalizeAnalysis(parsed, !!complaintText?.trim()), ...base, status: "done", provider: `${p.name}:${p.model} [${PROMPT_VERSION}]` };
      } catch (e) {
        errors.push(`${p.name}: ${(e as Error).message}`);
        break;
      }
    }
  }
  return { ...empty, ...base, status: "failed", error: errors.join(" | ").slice(0, 500) };
}
