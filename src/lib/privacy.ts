import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { config } from "./config";

// ---------- PII redaction (step 1: regex; step 2: names returned by the extractor) ----------

const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]"],
  // Brazil CPF 123.456.789-09
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[ID]"],
  // India Aadhaar 1234 5678 9012 / 123456789012
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[ID]"],
  // South Africa ID (13 digits)
  [/\b\d{13}\b/g, "[ID]"],
  // Russian SNILS 123-456-789 01
  [/\b\d{3}-\d{3}-\d{3}\s?\d{2}\b/g, "[ID]"],
  // Chinese resident ID (18 chars)
  [/\b\d{17}[\dXx]\b/g, "[ID]"],
  // phone numbers: +91 98765 43210, (81) 99999-9999, 8 (843) 123-45-67, 138 0013 8000
  [/(?:\+|00)?\d[\d\s().-]{7,}\d/g, "[PHONE]"],
];

export function redactRegex(text: string): string {
  let out = text;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

export function redactNames(text: string, names: string[]): string {
  let out = text;
  for (const n of names) {
    const name = n.trim();
    if (name.length < 2) continue;
    out = out.split(name).join("[NAME]");
  }
  return out;
}

// ---------- pseudonymous reporters ----------

export function pseudonym(channel: string, externalId: string): string {
  return createHmac("sha256", config.pseudonymSecret).update(`${channel}:${externalId}`).digest("hex");
}

// AES-256-GCM for the (pseudonym -> chat id) mapping needed to reply. Deleted on STOP.
function key(): Buffer {
  return createHash("sha256").update(config.contactKey).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, enc] = token.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ---------- tracking codes: CP-XXXXXX without ambiguous characters ----------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function trackingCode(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `CP-${s}`;
}

// ---------- k-anonymity for public aggregates ----------

export function kAnon<T extends { unique_reporters?: number }>(rows: T[], k = config.kAnonThreshold): T[] {
  return rows.filter((r) => (r.unique_reporters ?? 0) >= k);
}
