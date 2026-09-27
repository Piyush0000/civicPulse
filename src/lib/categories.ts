export const CATEGORIES = [
  "water_supply",
  "sanitation_drainage",
  "roads_transport",
  "electricity",
  "health",
  "education",
  "housing",
  "waste_management",
  "public_safety_lighting",
  "digital_connectivity",
  "agriculture_irrigation",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ["low", "medium", "high", "critical"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const LANGS = ["en", "hi", "pt", "ru", "zh", "zu"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  pt: "Português",
  ru: "Русский",
  zh: "中文",
  zu: "isiZulu",
};

type CategoryMeta = {
  label: Record<"en" | "hi" | "pt" | "ru" | "zh", string>;
  color: string; // hex, used on maps and charts
  icon: string; // lucide icon name
  action: string; // verb phrase used for recommendation titles
  peopleShare: number; // share of cell population that benefits
  costPerPersonUsd: number; // illustrative unit cost for the budget optimizer
  gapSource: string;
};

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  water_supply: {
    label: { en: "Water supply", hi: "जल आपूर्ति", pt: "Abastecimento de água", ru: "Водоснабжение", zh: "供水" },
    color: "#38bdf8", icon: "Droplets", action: "Improve drinking-water access", peopleShare: 1, costPerPersonUsd: 18,
    gapSource: "water points per 1,000 people",
  },
  sanitation_drainage: {
    label: { en: "Sanitation & drainage", hi: "स्वच्छता और जल निकासी", pt: "Saneamento e drenagem", ru: "Канализация и дренаж", zh: "卫生与排水" },
    color: "#a78bfa", icon: "Waves", action: "Fix drainage and sanitation", peopleShare: 1, costPerPersonUsd: 25,
    gapSource: "census sanitation proxy",
  },
  roads_transport: {
    label: { en: "Roads & transport", hi: "सड़क और परिवहन", pt: "Vias e transporte", ru: "Дороги и транспорт", zh: "道路与交通" },
    color: "#f59e0b", icon: "Route", action: "Repair roads and improve transport", peopleShare: 1, costPerPersonUsd: 40,
    gapSource: "road km per km²",
  },
  electricity: {
    label: { en: "Electricity", hi: "बिजली", pt: "Energia elétrica", ru: "Электроснабжение", zh: "电力" },
    color: "#facc15", icon: "Zap", action: "Stabilise electricity supply", peopleShare: 1, costPerPersonUsd: 30,
    gapSource: "night-light proxy",
  },
  health: {
    label: { en: "Health", hi: "स्वास्थ्य", pt: "Saúde", ru: "Здравоохранение", zh: "医疗卫生" },
    color: "#f43f5e", icon: "HeartPulse", action: "Expand primary health services", peopleShare: 1, costPerPersonUsd: 35,
    gapSource: "km to nearest clinic",
  },
  education: {
    label: { en: "Education", hi: "शिक्षा", pt: "Educação", ru: "Образование", zh: "教育" },
    color: "#22c55e", icon: "GraduationCap", action: "Add school capacity", peopleShare: 0.25, costPerPersonUsd: 60,
    gapSource: "schools per 1,000 people",
  },
  housing: {
    label: { en: "Housing", hi: "आवास", pt: "Habitação", ru: "Жильё и ЖКХ", zh: "住房" },
    color: "#fb7185", icon: "House", action: "Upgrade housing conditions", peopleShare: 0.6, costPerPersonUsd: 120,
    gapSource: "vulnerability proxy",
  },
  waste_management: {
    label: { en: "Waste management", hi: "कचरा प्रबंधन", pt: "Coleta de lixo", ru: "Вывоз мусора", zh: "垃圾处理" },
    color: "#84cc16", icon: "Trash2", action: "Fix solid-waste collection", peopleShare: 1, costPerPersonUsd: 8,
    gapSource: "vulnerability proxy",
  },
  public_safety_lighting: {
    label: { en: "Safety & street lighting", hi: "सुरक्षा और स्ट्रीट लाइट", pt: "Segurança e iluminação", ru: "Безопасность и освещение", zh: "治安与路灯" },
    color: "#e879f9", icon: "Lightbulb", action: "Install street lighting and safety measures", peopleShare: 1, costPerPersonUsd: 6,
    gapSource: "vulnerability proxy",
  },
  digital_connectivity: {
    label: { en: "Digital connectivity", hi: "डिजिटल कनेक्टिविटी", pt: "Conectividade digital", ru: "Связь и интернет", zh: "网络连接" },
    color: "#2dd4bf", icon: "Wifi", action: "Extend public connectivity", peopleShare: 1, costPerPersonUsd: 10,
    gapSource: "connectivity index",
  },
  agriculture_irrigation: {
    label: { en: "Agriculture & irrigation", hi: "कृषि और सिंचाई", pt: "Agricultura e irrigação", ru: "Сельское хозяйство", zh: "农业与灌溉" },
    color: "#65a30d", icon: "Sprout", action: "Support irrigation and urban farming", peopleShare: 0.1, costPerPersonUsd: 50,
    gapSource: "vulnerability proxy",
  },
  other: {
    label: { en: "Other", hi: "अन्य", pt: "Outros", ru: "Другое", zh: "其他" },
    color: "#94a3b8", icon: "CircleHelp", action: "Review civic issues", peopleShare: 0.5, costPerPersonUsd: 10,
    gapSource: "vulnerability proxy",
  },
};

export const URGENCY_WEIGHT: Record<Urgency, number> = { low: 0.5, medium: 1, high: 1.5, critical: 2.5 };

export const PRECISION = ["exact_pin", "street", "locality", "district", "unknown"] as const;
export type Precision = (typeof PRECISION)[number];

export const PRECISION_WEIGHT: Record<Precision, number> = {
  exact_pin: 1,
  street: 1,
  locality: 0.9,
  district: 1, // divided by number of cells at scoring time
  unknown: 0,
};

export function catLabel(c: string, lang: string = "en"): string {
  const m = CATEGORY_META[c as Category];
  if (!m) return c;
  return (m.label as Record<string, string>)[lang] || m.label.en;
}

export function isCategory(c: unknown): c is Category {
  return typeof c === "string" && (CATEGORIES as readonly string[]).includes(c);
}
