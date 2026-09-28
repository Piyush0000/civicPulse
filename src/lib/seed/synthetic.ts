import { latLngToCell } from "h3-js";
import type { Category, Precision, Urgency } from "../categories";
import { CATEGORIES } from "../categories";
import type { RegionDef } from "../regions";
import { clip, hashString, rng, type Rng } from "../stats";
import { trackingCode } from "../privacy";
import { STORIES } from "./scenarios";
import {
  assemble, CLOSERS, duration, IMPACTS, LANDMARKS, locationPhrase, NON_ACTIONABLE, OPENERS, PROBLEMS, SICK_IMPACT, SPAM,
  type P, type Problem, type TLang,
} from "./templates";
import { locality, type World, type WorldCell } from "./world";

export type SynthRequest = {
  trackingCode: string;
  submittedAt: Date;
  channel: "web" | "telegram" | "ivr" | "ussd" | "sms";
  contentType: "text" | "audio";
  language: string;
  textOriginal: string;
  textEnglish: string;
  category: Category;
  subcategory: string;
  urgency: Urgency;
  urgencyReason: string;
  summary: string;
  affectedGroup: string;
  locationText: string | null;
  precision: Precision;
  admin: string | null;
  lat: number | null;
  lng: number | null;
  h3: string | null;
  reporterKey: string;
  isSpam: boolean;
  isActionable: boolean;
  confidence: number;
  source: string; // background | scenario:<cat>@<loc> | project:<ref>
};

const DAY = 86400000;
const ORDER: Urgency[] = ["low", "medium", "high", "critical"];
const bump = (u: Urgency, by = 1): Urgency => ORDER[Math.min(3, ORDER.indexOf(u) + by)];

const AFFECTED: Partial<Record<Category, string>> = {
  water_supply: "households without reliable drinking water",
  sanitation_drainage: "residents of low-lying lanes",
  roads_transport: "commuters and residents",
  electricity: "households and small shops",
  health: "patients and families",
  education: "school children",
  housing: "families in poor-quality housing",
  waste_management: "residents near dumping sites",
  public_safety_lighting: "women and night-time commuters",
  digital_connectivity: "students and residents",
  agriculture_irrigation: "farmers and gardeners",
  other: "residents",
};

function sampleDay(r: Rng, weight: (d: Date) => number, now: Date, from = 364, to = 0): Date {
  for (let i = 0; i < 50; i++) {
    const off = r.int(to, from);
    const d = new Date(now.getTime() - off * DAY - r.int(0, 86399) * 1000);
    if (r.next() * 4 < weight(d)) return d;
  }
  return new Date(now.getTime() - r.int(to, from) * DAY);
}

const month = (d: Date) => d.getUTCMonth() + 1;

export function generateRequests(region: RegionDef, world: World, now: Date): SynthRequest[] {
  const r = rng(hashString(region.code + ":citizens"));
  const story = STORIES[region.code];
  const cellSet = new Map(world.cells.map((c) => [c.h3, c]));
  const total = region.syntheticRequests;
  const out: SynthRequest[] = [];
  const usedCodes = new Set<string>();
  const reporters = Math.round(total * 0.7);

  const langKeys = Object.keys(region.langMix) as TLang[];
  const langWeights = langKeys.map((k) => region.langMix[k]);

  const localName = (name: string, lang: TLang) => {
    const l = region.localities.find((x) => x.name === name);
    if (!l) return name;
    // Local-script names for Indian languages; Latin-script (English, Hinglish) keeps the romanised name.
    if (lang !== "en" && lang !== "hl" && l.local) return l.local;
    return name;
  };

  function problemsFor(cat: Category, keys?: string[]): Problem[] {
    const ps = PROBLEMS[cat].filter((p) => !p.regions || p.regions.includes(region.code));
    const f = keys ? ps.filter((p) => keys.includes(p.key)) : ps;
    return f.length ? f : ps.length ? ps : PROBLEMS[cat];
  }

  function make(opts: {
    cat: Category;
    date: Date;
    point: [number, number] | null;
    problems?: string[];
    source: string;
    forcePrecision?: Precision;
  }): SynthRequest | null {
    let { point } = opts;
    let cell: WorldCell | undefined;
    if (point) {
      const h = latLngToCell(point[0], point[1], region.h3Res);
      cell = cellSet.get(h);
      if (!cell) return null;
    }
    const langKey = r.weighted(langKeys, langWeights);
    const problem = r.pick(problemsFor(opts.cat, opts.problems));
    // Fall back to English when a phrase has no translation in the sampled language.
    const lang: TLang = problem.p[langKey as keyof P] ? langKey : "en";
    const pick = (p: P, l: TLang) => p[l as keyof P] ?? p.en;

    // location precision
    const roll = r.next();
    let precision: Precision =
      opts.forcePrecision ?? (roll < 0.08 ? "unknown" : roll < 0.14 ? "district" : roll < 0.44 ? "street" : "exact_pin");
    if (!cell) precision = "unknown";
    const admin = cell?.admin ?? null;
    const landmark = precision === "street" || precision === "exact_pin" ? r.pick(LANDMARKS) : null;
    const locOrig = precision === "unknown" || !admin ? "" : locationPhrase(lang, localName(admin, lang), landmark);
    const locEn = precision === "unknown" || !admin ? "" : locationPhrase("en", admin, landmark);
    if (precision === "district" && admin) {
      const l = locality(region, admin);
      point = [l.lat, l.lng];
    }

    const unit = r.weighted(["day", "week", "month"] as const, [0.3, 0.4, 0.3]);
    const n = unit === "day" ? r.int(2, 6) : unit === "week" ? r.int(2, 6) : r.int(1, 5);
    const sick = !!problem.sick && r.chance(0.5);
    const impact = sick ? SICK_IMPACT : r.chance(0.7) ? r.pick(IMPACTS) : null;
    const oi = r.int(0, OPENERS[lang].length - 1);
    const ci = r.int(0, CLOSERS[lang].length - 1);
    const text = assemble(lang, {
      opener: OPENERS[lang][oi],
      problem: pick(problem.p, lang),
      loc: locOrig,
      dur: duration(lang, n, unit),
      impact: impact ? pick(impact, lang) : "",
      closer: CLOSERS[lang][ci],
    });
    const textEn = assemble("en", {
      opener: OPENERS.en[Math.min(oi, OPENERS.en.length - 1)],
      problem: problem.p.en,
      loc: locEn,
      dur: duration("en", n, unit),
      impact: impact ? impact.en : "",
      closer: CLOSERS.en[Math.min(ci, CLOSERS.en.length - 1)],
    });

    let urgency = problem.urgency;
    const reasons: string[] = [];
    if (unit === "month" && n >= 2 && urgency !== "critical") {
      urgency = bump(urgency);
      reasons.push(`unresolved for ${n} months`);
    }
    if (sick && urgency === "high") {
      urgency = "critical";
      reasons.push("people falling sick");
    }
    if (!reasons.length) reasons.push(`${problem.key} reported`);

    const channel = r.weighted(["web", "telegram", "ivr", "ussd", "sms"] as const, [0.25, 0.35, 0.15, 0.15, 0.1]);
    const contentType = channel === "ivr" || (channel === "telegram" && r.chance(0.4)) ? "audio" : "text";
    const jitter = precision === "exact_pin" ? 0.0025 : 0.0008;
    const lat = point ? point[0] + (precision === "district" ? 0 : r.normal() * jitter) : null;
    const lng = point ? point[1] + (precision === "district" ? 0 : r.normal() * jitter) : null;
    let h3 = lat !== null && lng !== null ? latLngToCell(lat, lng, region.h3Res) : null;
    if (h3 && !cellSet.has(h3)) h3 = cell?.h3 ?? null;

    return {
      trackingCode: uniqueCode(),
      submittedAt: opts.date,
      channel,
      contentType,
      language: lang === "hl" ? "hi" : lang,
      textOriginal: text,
      textEnglish: textEn,
      category: opts.cat,
      subcategory: problem.key,
      urgency,
      urgencyReason: reasons.join("; "),
      summary: `${problem.p.en}${locEn ? " " + locEn : ""}.`,
      affectedGroup: AFFECTED[opts.cat] || "residents",
      locationText: locEn || null,
      precision,
      admin: precision === "unknown" ? null : admin,
      lat: precision === "unknown" ? null : lat,
      lng: precision === "unknown" ? null : lng,
      h3: precision === "unknown" ? null : h3,
      reporterKey: `r${r.int(1, reporters)}`,
      isSpam: false,
      isActionable: true,
      confidence: Math.round((0.72 + r.next() * 0.25) * 100) / 100,
      source: opts.source,
    };
  }

  function uniqueCode(): string {
    let c = trackingCode(r.next);
    while (usedCodes.has(c)) c = trackingCode(r.next);
    usedCodes.add(c);
    return c;
  }

  const popWeights = world.cells.map((c) => c.population * (0.5 + c.vuln) * c.conn);
  const randomPointIn = (c: WorldCell): [number, number] => [c.lat + r.normal() * 0.002, c.lng + r.normal() * 0.002];
  const gaussianAround = (lat: number, lng: number, km: number): [number, number] => {
    const dLat = (r.normal() * km * 0.6) / 111;
    const dLng = (r.normal() * km * 0.6) / (111 * Math.cos((lat * Math.PI) / 180));
    return [lat + dLat, lng + dLng];
  };

  // 1) scenarios
  const nScenario = Math.round(total * story.scenarioShare);
  for (const s of story.scenarios) {
    const l = locality(region, s.locality);
    const count = Math.round(nScenario * s.share);
    let made = 0;
    let guard = 0;
    while (made < count && guard++ < count * 5) {
      let date: Date;
      if (s.pattern === "emerging") {
        date = r.chance(0.72)
          ? new Date(now.getTime() - r.int(0, 32) * DAY - r.int(0, 86399) * 1000)
          : sampleDay(r, () => 4, now, 364, 95);
      } else if (s.pattern === "seasonal") {
        const peaks = s.months || [];
        date = sampleDay(r, (d) => (peaks.includes(month(d)) ? 4 : 0.35), now);
      } else {
        date = sampleDay(r, () => 4, now);
      }
      const pt = gaussianAround(l.lat, l.lng, s.radiusKm);
      const req = make({ cat: s.category, date, point: pt, problems: s.problems, source: `scenario:${s.category}@${s.locality}` });
      if (req) {
        out.push(req);
        made++;
      }
    }
  }

  // 2) completed projects: steady complaints before completion, ~55% fewer after.
  for (const p of world.projects.filter((x) => x.status === "completed")) {
    const completed = new Date(p.completedDate + "T00:00:00Z");
    const daysSince = Math.floor((now.getTime() - completed.getTime()) / DAY);
    const cellsIn = p.cells.map((h) => cellSet.get(h)!).filter(Boolean);
    if (!cellsIn.length) continue;
    const perDayPre = Math.max(0.12, (total / 5000) * 0.28);
    const nPre = Math.round(perDayPre * 136);
    const nPost = Math.round(perDayPre * 0.45 * Math.max(0, Math.min(150, daysSince) - 14));
    const mk = (fromDaysAgo: number, toDaysAgo: number) => {
      const c = r.pick(cellsIn);
      const date = new Date(now.getTime() - r.int(toDaysAgo, fromDaysAgo) * DAY - r.int(0, 86399) * 1000);
      const req = make({ cat: p.category, date, point: randomPointIn(c), source: `project:${p.ref}`, forcePrecision: "exact_pin" });
      if (req) out.push(req);
    };
    for (let i = 0; i < nPre; i++) mk(daysSince + 150, daysSince + 14);
    for (let i = 0; i < nPost; i++) mk(Math.max(0, daysSince - 14), 0);
  }

  // 3) background noise across all categories, biased by population, need and connectivity
  const cats = CATEGORIES.filter((c) => (story.categoryBase[c] ?? 0) > 0);
  const catW = cats.map((c) => story.categoryBase[c] ?? 1);
  const remaining = Math.max(0, total - out.length);
  const nSpam = Math.round(remaining * 0.03);
  const nNonAction = Math.round(remaining * 0.02);
  const nBg = remaining - nSpam - nNonAction;
  for (let i = 0; i < nBg; i++) {
    const cat = r.weighted(cats, catW);
    const peaks = story.seasonal[cat] || [];
    const date = sampleDay(r, (d) => (peaks.includes(month(d)) ? 4 : 1.6), now);
    const c = r.weighted(world.cells, popWeights);
    const req = make({ cat, date, point: randomPointIn(c), source: "background" });
    if (req) out.push(req);
  }

  // 4) spam and non-actionable messages
  for (let i = 0; i < nSpam + nNonAction; i++) {
    const langKey = r.weighted(langKeys, langWeights);
    const lang: TLang = langKey;
    const isSpam = i < nSpam;
    const text = isSpam ? r.pick(SPAM[lang] || SPAM.en!) : NON_ACTIONABLE[lang as keyof P] ?? NON_ACTIONABLE.en;
    out.push({
      trackingCode: uniqueCode(),
      submittedAt: sampleDay(r, () => 4, now),
      channel: r.pick(["web", "telegram", "sms"] as const),
      contentType: "text",
      language: lang === "hl" ? "hi" : lang,
      textOriginal: text as string,
      textEnglish: isSpam ? "(spam / off-topic message)" : NON_ACTIONABLE.en,
      category: "other",
      subcategory: isSpam ? "spam" : "general complaint",
      urgency: "low",
      urgencyReason: isSpam ? "spam" : "not a specific, actionable request",
      summary: isSpam ? "Off-topic or promotional message." : "General dissatisfaction with no specific issue or location.",
      affectedGroup: "unspecified",
      locationText: null,
      precision: "unknown",
      admin: null,
      lat: null,
      lng: null,
      h3: null,
      reporterKey: `r${r.int(1, reporters)}`,
      isSpam,
      isActionable: false,
      confidence: 0.9,
      source: isSpam ? "spam" : "non_actionable",
    });
  }

  // 5) ~10% near-duplicates: the same person re-sending a slightly different message days later.
  const nDup = Math.round(out.length * 0.1);
  const actionable = out.filter((x) => x.isActionable && x.h3);
  for (let i = 0; i < nDup && actionable.length; i++) {
    const src = r.pick(actionable);
    const later = new Date(src.submittedAt.getTime() + r.int(1, 12) * DAY);
    if (later > now) continue;
    out.push({
      ...src,
      trackingCode: uniqueCode(),
      submittedAt: later,
      textOriginal: src.textOriginal + (r.chance(0.5) ? " !!" : ""),
      confidence: clip(src.confidence - 0.03),
      source: src.source + ":dup",
    });
  }

  return out.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}
