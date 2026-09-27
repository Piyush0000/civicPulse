// Offline language identification for the languages CivicPulse pilots. Script first, then
// stop-word voting for Latin-script text (English, Portuguese, Hinglish, isiZulu).

const LATIN_HINTS: Record<string, string[]> = {
  en: ["the", "is", "are", "has", "have", "been", "not", "and", "near", "for", "our", "there", "please", "water", "road"],
  pt: ["não", "nao", "está", "esta", "rua", "há", "perto", "da", "do", "com", "uma", "para", "bairro", "água", "por", "favor"],
  hi: ["hai", "nahi", "mein", "ke", "paas", "se", "aur", "bahut", "kar", "raha", "rahi", "gaya", "pichhle", "karo", "hain", "ki"],
  zu: ["sawubona", "siyacela", "amanzi", "ugesi", "umgwaqo", "eduze", "izinsuku", "amaviki", "izinyanga", "kakhulu", "awekho"],
};

export function detectLanguage(text: string): { lang: string; confidence: number } {
  const t = text.trim();
  if (!t) return { lang: "und", confidence: 0 };
  const count = (re: RegExp) => (t.match(re) || []).length;
  const deva = count(/[ऀ-ॿ]/g);
  const cyr = count(/[Ѐ-ӿ]/g);
  const han = count(/[一-鿿]/g);
  const letters = count(/\p{L}/gu) || 1;
  if (deva / letters > 0.3) return { lang: "hi", confidence: 0.95 };
  if (cyr / letters > 0.3) return { lang: "ru", confidence: 0.95 };
  if (han / letters > 0.2) return { lang: "zh", confidence: 0.95 };
  const words = t.toLowerCase().normalize("NFC").split(/[^\p{L}]+/u).filter(Boolean);
  const scores = Object.fromEntries(Object.keys(LATIN_HINTS).map((k) => [k, 0])) as Record<string, number>;
  for (const w of words) for (const [k, list] of Object.entries(LATIN_HINTS)) if (list.includes(w)) scores[k]++;
  if (/[ãõçáéíóúâê]/i.test(t)) scores.pt += 2;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [best, bs] = ranked[0];
  const second = ranked[1][1];
  if (bs === 0) return { lang: "en", confidence: 0.3 };
  return { lang: best, confidence: Math.min(0.95, 0.5 + (bs - second) / Math.max(4, words.length / 2)) };
}
