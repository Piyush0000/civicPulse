import { z } from "zod";
import { CATEGORIES, URGENCIES } from "../categories";
import { chat, hasLLM, parseJsonObject } from "./llm";
import { EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM } from "./prompts";
import { ruleExtract } from "./rules";

export const ExtractionSchema = z.object({
  is_actionable: z.boolean(),
  is_spam: z.boolean(),
  category: z.enum(CATEGORIES),
  subcategory: z.string().min(1).max(80),
  urgency: z.enum(URGENCIES),
  urgency_reason: z.string().max(200).default(""),
  summary: z.string().min(1).max(400),
  affected_group: z.string().max(120).default("residents"),
  estimated_people_affected: z.number().int().nonnegative().nullable().default(null),
  location_text: z.string().max(200).nullable().default(null),
  location_granularity: z.enum(["exact_pin", "street", "locality", "district", "unknown"]).default("unknown"),
  person_names_detected: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const FALLBACK_EXTRACTION: Extraction = {
  is_actionable: false,
  is_spam: false,
  category: "other",
  subcategory: "unclassified",
  urgency: "low",
  urgency_reason: "extraction failed",
  summary: "Could not be structured automatically; needs analyst review.",
  affected_group: "unspecified",
  estimated_people_affected: null,
  location_text: null,
  location_granularity: "unknown",
  person_names_detected: [],
  confidence: 0,
};

/** Validate model JSON. Returns the parsed extraction or the validation error text. */
export function validateExtraction(raw: unknown): { ok: true; value: Extraction } | { ok: false; error: string } {
  const r = ExtractionSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}

export async function extract(input: {
  original: string;
  english: string;
  language: string;
  region: string;
  channel: string;
}): Promise<{ value: Extraction; provider: string; promptVersion: string }> {
  if (!hasLLM()) return { value: ruleExtract(input.original, input.english), provider: "rules", promptVersion: "rules_v1" };
  const user = `REGION: ${input.region}\nCHANNEL: ${input.channel}\nORIGINAL (${input.language}): ${input.original}\nENGLISH: ${input.english}`;
  const messages = [
    { role: "system" as const, content: EXTRACT_SYSTEM },
    { role: "user" as const, content: user },
  ];
  try {
    const first = await chat({ messages, json: true, temperature: 0 });
    let parsed: unknown;
    let err = "";
    try {
      parsed = parseJsonObject(first.text);
      const v = validateExtraction(parsed);
      if (v.ok) return { value: v.value, provider: `${first.provider}:${first.model}`, promptVersion: EXTRACT_PROMPT_VERSION };
      err = v.error;
    } catch (e) {
      err = (e as Error).message;
    }
    // Retry once with the validation error appended.
    const second = await chat({
      messages: [
        ...messages,
        { role: "assistant", content: first.text },
        { role: "user", content: `Your JSON was invalid: ${err}. Return ONLY a corrected JSON object.` },
      ],
      json: true,
      temperature: 0,
    });
    const v2 = validateExtraction(parseJsonObject(second.text));
    if (v2.ok) return { value: v2.value, provider: `${second.provider}:${second.model}`, promptVersion: EXTRACT_PROMPT_VERSION };
    return { value: FALLBACK_EXTRACTION, provider: `${second.provider}:invalid`, promptVersion: EXTRACT_PROMPT_VERSION };
  } catch {
    // Every provider failed (rate limit, network): degrade to rules rather than lose the request.
    return { value: ruleExtract(input.original, input.english), provider: "rules (llm unavailable)", promptVersion: "rules_v1" };
  }
}
