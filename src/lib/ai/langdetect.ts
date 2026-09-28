// Offline language identification for Indian pilot languages. Script first (Devanagari, Tamil,
// Telugu, Bengali), then stop-word voting: Marathi vs Hindi share Devanagari; English vs Hinglish share Latin.

const DEVANAGARI_HINTS: Record<string, string[]> = {
  hi: ["है", "हैं", "में", "नहीं", "से", "की", "का", "के", "और", "रहा", "रही", "पिछले", "कृपया", "पास"],
  mr: ["आहे", "आहेत", "मध्ये", "नाही", "नाहीये", "येत", "आणि", "गेल्या", "पासून", "जवळ", "कृपया", "झाले", "होत"],
};

const LATIN_HINTS: Record<string, string[]> = {
  en: ["the", "is", "are", "has", "have", "been", "not", "and", "near", "for", "our", "there", "please", "water", "road"],
  hi: ["hai", "nahi", "mein", "ke", "paas", "se", "aur", "bahut", "kar", "raha", "rahi", "gaya", "pichhle", "karo", "hain", "ki"],
};

export function detectLanguage(text: string): { lang: string; confidence: number } {
  const t = text.trim();
  if (!t) return { lang: "und", confidence: 0 };
  const count = (re: RegExp) => (t.match(re) || []).length;
  const letters = count(/\p{L}/gu) || 1;
  const scripts: [string, number][] = [
    ["deva", count(/[ऀ-ॿ]/g)],
    ["ta", count(/[஀-௿]/g)],
    ["te", count(/[ఀ-౿]/g)],
    ["bn", count(/[ঀ-৿]/g)],
  ];
  const [script, n] = scripts.sort((a, b) => b[1] - a[1])[0];
  if (n / letters > 0.3) {
    if (script !== "deva") return { lang: script, confidence: 0.95 };
    const words = t.split(/[\s,।.!?]+/).filter(Boolean);
    const score = (k: string) => words.filter((w) => DEVANAGARI_HINTS[k].some((h) => w === h || w.endsWith(h))).length;
    const mr = score("mr"),
      hi = score("hi");
    return { lang: mr > hi ? "mr" : "hi", confidence: mr === hi ? 0.6 : 0.9 };
  }
  const words = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const scores: Record<string, number> = { en: 0, hi: 0 };
  for (const w of words) for (const [k, list] of Object.entries(LATIN_HINTS)) if (list.includes(w)) scores[k]++;
  if (scores.en === 0 && scores.hi === 0) return { lang: "en", confidence: 0.3 };
  const best = scores.hi > scores.en ? "hi" : "en";
  return { lang: best, confidence: Math.min(0.95, 0.5 + Math.abs(scores.hi - scores.en) / Math.max(4, words.length / 2)) };
}
