import type { Category, Urgency } from "../categories";
import { LANDMARKS } from "../seed/templates";
import type { Extraction } from "./extract";

// Offline, rule-based "AI" used when no free LLM key is configured. Multilingual keyword lexicon
// (en / hi / Hinglish / pt / ru / zh / zu), a rule-based urgency rubric and template summaries.

const KW: Record<Exclude<Category, "other">, [string, number][]> = {
  water_supply: [
    ["water", 1], ["tap", 1.5], ["taps", 1.5], ["handpump", 2], ["tanker", 2], ["pipeline", 1], ["borewell", 2], ["drinking", 1.5], ["water pressure", 2],
    ["पानी", 1], ["नल", 1.5], ["हैंडपंप", 2], ["टैंकर", 2], ["paani", 1], ["pani", 1], ["nal", 1.5],
    ["água", 1], ["agua", 1], ["torneira", 2], ["carro-pipa", 2], ["abastecimento", 1.5], ["bomba d'água", 2],
    ["вод", 1], ["кран", 1.5], ["водовоз", 2], ["колонка", 2], ["напор", 2], ["水", 0.6], ["停水", 2], ["自来水", 2], ["水压", 2], ["送水", 2], ["水泵", 2], ["amanzi", 2],
  ],
  sanitation_drainage: [
    ["drain", 2], ["sewer", 2], ["sewage", 2], ["waterlogged", 2.5], ["flood", 2], ["toilet", 2], ["gutter", 2], ["overflowing", 1],
    ["नाली", 2.5], ["सीवर", 2.5], ["शौचालय", 2], ["जलभराव", 2.5], ["पानी भर", 2.5], ["naali", 2.5], ["nali", 2], ["sewer", 2], ["paani bhar", 2.5],
    ["esgoto", 2.5], ["alaga", 2.5], ["alagamento", 2.5], ["enchente", 2.5], ["banheiro", 2], ["bueiro", 2], ["drenagem", 2],
    ["канализац", 2.5], ["затоп", 2.5], ["туалет", 2], ["дренаж", 2], ["下水道", 2.5], ["污水", 2], ["淹", 2], ["厕所", 2], ["排水", 2], ["积水", 2.5], ["endle", 2],
  ],
  roads_transport: [
    ["road", 1.5], ["pothole", 2.5], ["potholes", 2.5], ["bridge", 2], ["bus", 1.5], ["traffic", 1.5], ["footpath", 1.5], ["unpaved", 2],
    ["सड़क", 2], ["गड्ढे", 2.5], ["पुलिया", 2], ["बस", 1.5], ["sadak", 2], ["gaddhe", 2.5], ["puliya", 2], ["kachchi", 1.5],
    ["buraco", 2.5], ["ponte", 2], ["ônibus", 1.5], ["onibus", 1.5], ["calçamento", 2], ["asfalto", 2], ["estrada", 1.5],
    ["дорог", 2], ["ям", 1], ["мост", 2], ["автобус", 1.5], ["асфальт", 2], ["道路", 2], ["坑", 2], ["桥", 2], ["公交", 1.5], ["堵车", 2], ["umgwaqo", 2], ["izimbobo", 2],
  ],
  electricity: [
    ["electricity", 2.5], ["power cut", 2.5], ["power cuts", 2.5], ["transformer", 2.5], ["voltage", 2.5], ["live wires", 2.5], ["outage", 2], ["load shedding", 3],
    ["बिजली", 2.5], ["ट्रांसफार्मर", 2.5], ["वोल्टेज", 2.5], ["तार", 1.5], ["bijli", 2.5], ["transformer", 2.5],
    ["falta luz", 2.5], ["energia", 1.5], ["transformador", 2.5], ["tensão", 2], ["fios", 2], ["apagão", 2.5],
    ["свет отключ", 2.5], ["электр", 2], ["трансформатор", 2.5], ["напряжен", 2], ["провод", 2], ["停电", 2.5], ["变压器", 2.5], ["电压", 2.5], ["电线", 2], ["ugesi", 2.5],
  ],
  health: [
    ["doctor", 2], ["clinic", 2], ["hospital", 2], ["medicine", 2], ["medicines", 2], ["fever", 2], ["dengue", 2.5], ["malaria", 2.5], ["health centre", 2], ["sick", 0.5],
    ["डॉक्टर", 2], ["अस्पताल", 2], ["दवा", 2], ["दवाइयाँ", 2], ["बुखार", 2], ["डेंगू", 2.5], ["क्लिनिक", 2], ["dawai", 2], ["bukhar", 2], ["dawaiyan", 2],
    ["médico", 2], ["medico", 2], ["posto de saúde", 2], ["remédio", 2], ["remédios", 2], ["febre", 2], ["dengue", 2.5],
    ["врач", 2], ["больниц", 2], ["поликлиник", 1.5], ["лекарств", 2], ["температур", 2], ["医生", 2], ["医院", 2], ["诊所", 2], ["药", 1.5], ["发烧", 2], ["发高烧", 2.5], ["udokotela", 2],
  ],
  education: [
    ["school", 1.5], ["teacher", 2], ["teachers", 2], ["classroom", 2], ["students", 1], ["overcrowded", 1.5],
    ["स्कूल", 1.5], ["शिक्षक", 2], ["विद्यालय", 2], ["school", 1.5], ["teacher", 2], ["padhai", 1.5],
    ["escola", 1.5], ["professor", 2], ["professores", 2], ["superlotada", 2], ["alunos", 1],
    ["школ", 1.5], ["учител", 2], ["класс", 1], ["学校", 1.5], ["老师", 2], ["中学", 2], ["班级", 1.5], ["isikole", 1.5],
  ],
  housing: [
    ["house", 1.5], ["houses", 1.5], ["housing", 2], ["eviction", 2.5], ["heating", 2.5], ["cracks", 2], ["leaking", 1], ["rent", 1.5],
    ["मकान", 2], ["घर", 1], ["घरों", 1], ["बेदखली", 2.5], ["इमारत", 2], ["दरारें", 2], ["ghar", 1], ["gharon", 1], ["bedakhli", 2.5], ["daraarein", 2],
    ["casa", 1], ["casas", 1], ["despejo", 2.5], ["prédio", 1.5], ["rachaduras", 2], ["aquecimento", 2.5], ["moradia", 2],
    ["отоплен", 2.5], ["трещин", 2], ["выселен", 2.5], ["жиль", 2], ["暖气", 2.5], ["裂缝", 2], ["搬迁", 2.5], ["住房", 2], ["imizi", 2],
  ],
  waste_management: [
    ["garbage", 2.5], ["trash", 2.5], ["waste", 2], ["dump", 2], ["rubbish", 2.5], ["litter", 2],
    ["कूड़ा", 2.5], ["कचरा", 2.5], ["कूड़े", 2.5], ["kooda", 2.5], ["kude", 2.5], ["kachra", 2.5],
    ["lixo", 2.5], ["lixão", 2.5], ["entulho", 2], ["мусор", 2.5], ["свалк", 2.5], ["垃圾", 2.5], ["imfucuza", 2.5],
  ],
  public_safety_lighting: [
    ["streetlight", 2.5], ["streetlights", 2.5], ["street light", 2.5], ["street lights", 2.5], ["unsafe", 2], ["theft", 2], ["thefts", 2], ["cctv", 2], ["crime", 2], ["harassment", 2.5],
    ["स्ट्रीट लाइट", 2.5], ["असुरक्षित", 2], ["चोरी", 2], ["सीसीटीवी", 2], ["chori", 2],
    ["postes", 2.5], ["iluminação", 2.5], ["perigosa", 1.5], ["roubo", 2], ["roubos", 2], ["assalto", 2], ["câmera", 1.5],
    ["освещен", 2.5], ["фонар", 2.5], ["небезопасно", 2], ["краж", 2], ["камер", 1.5], ["路灯", 2.5], ["不安全", 2], ["盗窃", 2], ["监控", 1.5], ["izibani", 2.5],
  ],
  digital_connectivity: [
    ["internet", 2], ["network", 1.5], ["signal", 2], ["wifi", 2], ["wi-fi", 2], ["service centre", 2],
    ["नेटवर्क", 2], ["इंटरनेट", 2], ["जन सेवा केंद्र", 2.5], ["jan seva kendra", 2.5],
    ["sinal de celular", 2.5], ["atendimento ao cidadão", 2], ["связ", 2], ["интернет", 2], ["госуслуг", 2.5], ["信号", 2], ["网络", 2], ["政务服务", 2.5],
  ],
  agriculture_irrigation: [
    ["irrigation", 2.5], ["farm", 2], ["crop", 2], ["crops", 2], ["community garden", 2.5],
    ["सिंचाई", 2.5], ["खेत", 2], ["फसल", 2], ["sinchai", 2.5], ["khet", 2], ["fasal", 2],
    ["irrigação", 2.5], ["horta", 2.5], ["lavoura", 2], ["орошен", 2.5], ["огород", 2.5], ["灌溉", 2.5], ["菜园", 2.5], ["农田", 2],
  ],
};

const SPAM_RE = /(click|link|earn money|ganhe dinheiro|clique|переходи|ссылк|加微信|红包|lottery|whatsapp group|good morning|bom dia grupo|доброе утро|早上好|शुभकामनाएं|happy (festival|diwali|new year))/i;

const CRITICAL_RE = /(sick|outbreak|dengue|collapsed|dangerous|unsafe bridge|live wire|died|death|fire|contaminat|बीमार|खतरनाक|मौत|bimar|khatarnak|doente|perigos|morreu|опасн|болеют|болеть|умер|危险|生病|发高烧|ziyagula|angcolile)/i;
const LONG_RE = /(\d+\s*(months?|महीन|mahin|mes|meses|месяц|个月|izinyanga))|(महीनों|mahinon|meses|месяц|个月)/i;
const LOW_RE = /(suggest|improve|beautif|noise|stray|thefts|sugest|шум|噪音|суggest)/i;

export function stripLandmarks(text: string): string {
  let t = text;
  for (const l of LANDMARKS) for (const v of Object.values(l)) if (v) t = t.split(v).join(" ");
  return t.replace(/(near|by|behind|next to) (the )?(government |primary |municipal )?school/gi, " ");
}

function scoreCategories(text: string): [Category, number][] {
  const t = ` ${stripLandmarks(text).toLowerCase()} `;
  const out: [Category, number][] = [];
  for (const [cat, list] of Object.entries(KW) as [Exclude<Category, "other">, [string, number][]][]) {
    let s = 0;
    for (const [kw, w] of list) {
      const k = kw.toLowerCase();
      const isLatin = /^[\p{Script=Latin}\s'-]+$/u.test(k);
      if (isLatin) {
        const re = new RegExp(`(^|[^\\p{L}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u");
        if (re.test(t)) s += w;
      } else if (t.includes(k)) s += w;
    }
    if (s > 0) out.push([cat, s]);
  }
  return out.sort((a, b) => b[1] - a[1]);
}

export function ruleUrgency(text: string, cat: Category): { urgency: Urgency; reason: string } {
  if (CRITICAL_RE.test(text)) return { urgency: "critical", reason: "risk to health or life mentioned" };
  const long = LONG_RE.test(text);
  if (LOW_RE.test(text) && !long) return { urgency: "low", reason: "minor issue or suggestion" };
  if (long) return { urgency: "high", reason: "unresolved for months" };
  if (["water_supply", "health", "electricity", "sanitation_drainage"].includes(cat))
    return { urgency: "high", reason: "essential service disrupted" };
  return { urgency: "medium", reason: "service degraded" };
}

export function ruleExtract(original: string, english: string): Extraction {
  const both = `${original}\n${english}`;
  if (SPAM_RE.test(both) && scoreCategories(both).length === 0) {
    return base({ is_spam: true, is_actionable: false, subcategory: "spam", summary: "Off-topic or promotional message.", confidence: 0.8 });
  }
  const ranked = scoreCategories(both);
  if (!ranked.length) {
    return base({ is_actionable: false, subcategory: "general complaint", summary: firstSentence(english) || "Unclassified message.", confidence: 0.3 });
  }
  const [cat, score] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  const { urgency, reason } = ruleUrgency(both, cat);
  return {
    is_actionable: true,
    is_spam: false,
    category: cat,
    subcategory: cat.replace(/_/g, " "),
    urgency,
    urgency_reason: reason,
    summary: firstSentence(english) || firstSentence(original),
    affected_group: "residents",
    estimated_people_affected: null,
    location_text: null,
    location_granularity: "unknown",
    person_names_detected: [],
    confidence: Math.round(Math.min(0.85, 0.45 + (score - second) / 8) * 100) / 100,
  };
}

function firstSentence(t: string): string {
  const s = t.split(/(?<=[.!?।。])\s*/u)[0]?.trim() || "";
  return s.length > 180 ? s.slice(0, 177) + "..." : s;
}

function base(p: Partial<Extraction>): Extraction {
  return {
    is_actionable: false,
    is_spam: false,
    category: "other",
    subcategory: "other",
    urgency: "low",
    urgency_reason: "",
    summary: "",
    affected_group: "unspecified",
    estimated_people_affected: null,
    location_text: null,
    location_granularity: "unknown",
    person_names_detected: [],
    confidence: 0.5,
    ...p,
  };
}
