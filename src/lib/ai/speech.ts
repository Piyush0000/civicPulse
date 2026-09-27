import { config } from "../config";
import { chat, hasLLM } from "./llm";
import { TRANSLATE_SYSTEM } from "./prompts";

// ---------------------------------------------------------------- speech-to-text

export type SttResult = { text: string; language: string | null; provider: string };

/** Groq Whisper-large-v3 (free) -> Gemini audio understanding (free) -> null (caller uses browser transcript). */
export async function transcribe(audio: Buffer, mime: string, languageHint?: string): Promise<SttResult | null> {
  if (config.groqKey) {
    try {
      const form = new FormData();
      const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : mime.includes("mp4") || mime.includes("m4a") ? "m4a" : "webm";
      form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), `audio.${ext}`);
      form.append("model", config.groqSttModel);
      form.append("response_format", "verbose_json");
      if (languageHint && languageHint !== "auto") form.append("language", languageHint);
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${config.groqKey}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        const data = (await res.json()) as { text: string; language?: string };
        return { text: data.text.trim(), language: whisperLang(data.language), provider: `groq:${config.groqSttModel}` };
      }
    } catch {
      /* fall through */
    }
  }
  if (config.geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: 'Transcribe this voice note verbatim in its original language. Reply ONLY with JSON: {"text": "...", "language": "<ISO 639-1>"}' },
                { inline_data: { mime_type: mime.split(";")[0], data: audio.toString("base64") } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
        const out = JSON.parse(data.candidates[0].content.parts[0].text) as { text: string; language?: string };
        return { text: out.text.trim(), language: out.language || null, provider: `gemini:${config.geminiModel}` };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

function whisperLang(l?: string): string | null {
  if (!l) return null;
  const m: Record<string, string> = { english: "en", hindi: "hi", portuguese: "pt", russian: "ru", chinese: "zh", zulu: "zu", urdu: "hi" };
  return m[l.toLowerCase()] || (l.length === 2 ? l : null);
}

// ---------------------------------------------------------------- translation to the English pivot

export type TranslateResult = { text: string; provider: string };

export async function translateToEnglish(text: string, sourceLang: string): Promise<TranslateResult> {
  if (!text.trim() || sourceLang === "en") return { text, provider: "identity" };
  if (hasLLM()) {
    try {
      const r = await chat({
        messages: [
          { role: "system", content: TRANSLATE_SYSTEM },
          { role: "user", content: text },
        ],
        temperature: 0,
        maxTokens: 800,
      });
      if (r.text.trim()) return { text: r.text.trim(), provider: `${r.provider}:${r.model}` };
    } catch {
      /* fall through */
    }
  }
  if (config.translateFallback === "mymemory") {
    // MyMemory: free public translation API, no key (fair-use daily quota).
    try {
      const pair = `${sourceLang === "zh" ? "zh-CN" : sourceLang}|en`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${pair}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
        const t = data.responseData?.translatedText;
        if (t && data.responseStatus === 200 && !/MYMEMORY WARNING/i.test(t)) return { text: t, provider: "mymemory (free)" };
      }
    } catch {
      /* fall through */
    }
  }
  return { text: `[untranslated ${sourceLang}] ${text}`, provider: "none" };
}
