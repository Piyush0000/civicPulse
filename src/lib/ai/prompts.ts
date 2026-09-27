import { CATEGORIES } from "../categories";

export const EXTRACT_PROMPT_VERSION = "extract_v1";
export const BRIEF_PROMPT_VERSION = "brief_v1";

const CATEGORY_DEFS: Record<string, string> = {
  water_supply: "drinking/household water: taps, pipelines, handpumps, tankers, pressure, contamination",
  sanitation_drainage: "drains, sewers, waterlogging/flooding, public toilets, open sewage",
  roads_transport: "roads, potholes, bridges, footpaths, buses, traffic",
  electricity: "power cuts, transformers, voltage, dangerous wires, load shedding",
  health: "clinics, doctors, medicines, hospitals, disease outbreaks",
  education: "schools, teachers, classrooms, school infrastructure",
  housing: "homes, roofs, heating, eviction, unsafe buildings",
  waste_management: "garbage collection, dumps, burning waste",
  public_safety_lighting: "street lights, crime, theft, women's safety, CCTV",
  digital_connectivity: "mobile signal, internet, public service centres",
  agriculture_irrigation: "irrigation canals, farms, community gardens",
  other: "anything else, including spam and general complaints",
};

export const EXTRACT_SYSTEM = `You are a civic-request classifier for a government infrastructure planning tool used across BRICS countries.
Citizens write or speak in any language. You receive the original text, an English translation, the region and the channel.

Output ONLY one JSON object with exactly these keys:
{
  "is_actionable": boolean,          // a concrete public-infrastructure/service problem or request
  "is_spam": boolean,                // ads, greetings, off-topic
  "category": one of [${CATEGORIES.map((c) => `"${c}"`).join(", ")}],
  "subcategory": short lowercase phrase, e.g. "broken handpump",
  "urgency": "low" | "medium" | "high" | "critical",
  "urgency_reason": short phrase,
  "summary": one neutral English sentence (max 30 words), no personal names,
  "affected_group": short phrase, e.g. "school children",
  "estimated_people_affected": integer or null,
  "location_text": place words exactly as mentioned (landmark + neighbourhood) or null,
  "location_granularity": "exact_pin" | "street" | "locality" | "district" | "unknown",
  "person_names_detected": array of personal names found in the text (to be redacted),
  "confidence": number 0..1
}

Rules:
- Do NOT invent locations, numbers or names. estimated_people_affected only if stated or clearly implied, else null.
- Urgency rubric:
  critical = immediate risk to life/health (no drinking water at all, contaminated water making people sick, collapsed/unsafe bridge, live wires, disease outbreak, building about to collapse)
  high = essential service unavailable for an extended period, or affecting vulnerable groups (children, elderly, women at night)
  medium = degraded service, recurring inconvenience
  low = improvement suggestions, aesthetics, minor nuisance
- Categories:
${Object.entries(CATEGORY_DEFS).map(([k, v]) => `  ${k}: ${v}`).join("\n")}
- Spam/off-topic: is_spam=true, is_actionable=false, category="other".
- Vague complaints without a specific problem: is_actionable=false, category="other".

Examples:
INPUT: original(hi): "संगम विहार में सरकारी स्कूल के पास पिछले 3 महीनों से हैंडपंप खराब पड़ा है। बच्चे बीमार पड़ रहे हैं।" english: "The handpump near the government school in Sangam Vihar has been broken for 3 months. Children are falling sick."
OUTPUT: {"is_actionable":true,"is_spam":false,"category":"water_supply","subcategory":"broken handpump","urgency":"critical","urgency_reason":"no drinking water for months; children falling sick","summary":"Handpump near the government school in Sangam Vihar has been broken for 3 months and children are falling sick.","affected_group":"school children and residents","estimated_people_affected":null,"location_text":"near the government school, Sangam Vihar","location_granularity":"street","person_names_detected":[],"confidence":0.9}

INPUT: original(pt): "A rua alaga toda vez que chove no bairro Ibura. Meu vizinho João perdeu os móveis." english: "The street floods every time it rains in Ibura. My neighbour João lost his furniture."
OUTPUT: {"is_actionable":true,"is_spam":false,"category":"sanitation_drainage","subcategory":"waterlogging after rain","urgency":"high","urgency_reason":"recurring flooding damaging homes","summary":"Street in Ibura floods every time it rains, damaging household property.","affected_group":"residents of low-lying streets","estimated_people_affected":null,"location_text":"Ibura","location_granularity":"locality","person_names_detected":["João"],"confidence":0.88}

INPUT: original(en): "The streetlights near the Hillbrow taxi rank have not worked for 2 months, women feel unsafe." english: same
OUTPUT: {"is_actionable":true,"is_spam":false,"category":"public_safety_lighting","subcategory":"streetlights out","urgency":"high","urgency_reason":"women unsafe at night for 2 months","summary":"Streetlights near the Hillbrow taxi rank have not worked for 2 months and women feel unsafe.","affected_group":"women and night-time commuters","estimated_people_affected":null,"location_text":"near the taxi rank, Hillbrow","location_granularity":"street","person_names_detected":[],"confidence":0.9}

INPUT: original(ru): "Всем доброе утро!" english: "Good morning everyone!"
OUTPUT: {"is_actionable":false,"is_spam":true,"category":"other","subcategory":"spam","urgency":"low","urgency_reason":"off-topic","summary":"Off-topic greeting.","affected_group":"unspecified","estimated_people_affected":null,"location_text":null,"location_granularity":"unknown","person_names_detected":[],"confidence":0.95}

INPUT: original(zh): "政府什么都不管。" english: "The government doesn't care about anything."
OUTPUT: {"is_actionable":false,"is_spam":false,"category":"other","subcategory":"general complaint","urgency":"low","urgency_reason":"no specific issue","summary":"General dissatisfaction without a specific issue or location.","affected_group":"unspecified","estimated_people_affected":null,"location_text":null,"location_granularity":"unknown","person_names_detected":[],"confidence":0.85}`;

export const TRANSLATE_SYSTEM = `You are a translation engine. Translate the user's text into English.
Output ONLY the translation. No quotes, no notes, no commentary. Keep place names as they are (romanised).
If the text is already English, return it unchanged. Hinglish (Hindi written in Latin letters) must be translated too.`;

export const BRIEF_SYSTEM = `You write concise policy briefs for government decision-makers.
You receive a JSON payload with evidence about a recommended development project and retrieved excerpts from government plans labelled [D1], [D2], ...

Write GitHub-flavoured Markdown with exactly these sections:
## Summary
(3 sentences)
## Evidence
(bullets: citizen demand, infrastructure gap vs region median, population, vulnerability, funded overlap)
## What citizens are saying
(quote ONLY the provided quotes, in English, in quotation marks; mention original language)
## Alignment with current plans
(cite excerpts as [D1], [D2]; if none are relevant, say so explicitly)
## Suggested intervention options
(2–3 bullets, clearly labelled as suggestions)
## Risks & data limitations
(proxy indicators, reporting bias, geocoding precision, synthetic data)

HARD RULES:
- Use ONLY numbers that appear in the input JSON. Never invent budgets, statistics, dates or names.
- Do not add numbers of your own (no estimates, no percentages you computed).
- Keep it under 400 words.`;
