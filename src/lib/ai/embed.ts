import { config } from "../config";
import { hashString } from "../stats";

// Deterministic, offline embeddings: feature hashing of words, word bigrams and char 4-grams into
// 256 dimensions. We always embed the ENGLISH pivot text (after translation), so this works across
// languages. It is used for near-duplicate clustering and document retrieval, where lexical overlap
// is exactly the signal we want, and it keeps the platform free of any mandatory API.

const STOP = new Set(
  "a an the and or of to in on at for from by with near has have had been is are was were be this that it its our we us please sir madam kindly soon there not no".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function embedText(text: string, dim = config.embedDim): number[] {
  const v = new Float64Array(dim);
  const toks = tokenize(text);
  const add = (feat: string, w: number) => {
    const h = hashString(feat);
    const sign = h & 1 ? 1 : -1;
    v[(h >>> 1) % dim] += sign * w;
  };
  for (let i = 0; i < toks.length; i++) {
    add("w:" + stem(toks[i]), 1);
    if (i + 1 < toks.length) add("b:" + stem(toks[i]) + "_" + stem(toks[i + 1]), 0.6);
    const t = `#${toks[i]}#`;
    for (let j = 0; j + 4 <= t.length; j++) add("c:" + t.slice(j, j + 4), 0.25);
  }
  let n = 0;
  for (let i = 0; i < dim; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => Math.round((x / n) * 1e5) / 1e5);
}

function stem(t: string): string {
  return t.replace(/(ing|ed|es|s)$/u, "");
}

export function centroidUpdate(centroid: number[], v: number[], countBefore: number): number[] {
  const out = centroid.map((c, i) => (c * countBefore + v[i]) / (countBefore + 1));
  const n = Math.sqrt(out.reduce((a, x) => a + x * x, 0)) || 1;
  return out.map((x) => Math.round((x / n) * 1e5) / 1e5);
}
