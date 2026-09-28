export const CATEGORIES = [
  "water_supply", "sanitation_drainage", "roads_transport", "electricity", "health", "education", "housing", "waste_management", "public_safety_lighting", "digital_connectivity", "agriculture_irrigation", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const URGENCIES = ["low", "medium", "high", "critical"] as const;
export type Urgency = (typeof URGENCIES)[number];
export const LANGS = ["en", "hi", "mr", "ta", "te", "bn"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<string, string> = { en: "English", hi: "हिन्दी", mr: "मराठी", ta: "தமிழ்", te: "తెలుగు", bn: "বাংলা" };
type CategoryMeta = { label: Record<"en" | "hi" | "mr" | "ta" | "te" | "bn", string>; color: string; icon: string; action: string; peopleShare: number; costPerPersonUsd: number; gapSource: string; };

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  water_supply: {
    label: { en: "Water supply", hi: "जल आपूर्ति", mr: "पाणीपुरवठा", ta: "நீர் வழங்கல்", te: "నీటి సరఫరా", bn: "জল সরবরাহ" }, color: "#38bdf8", icon: "Droplets", action: "Improve drinking-water access", peopleShare: 1, costPerPersonUsd: 18, gapSource: "water points per 1,000 people",
  },
  sanitation_drainage: {
    label: { en: "Sanitation & drainage", hi: "स्वच्छता और जल निकासी", mr: "स्वच्छता आणि जलनिस्सारण", ta: "சுகாதாரம் & வடிகால்", te: "పారిశుద్ధ్యం & డ్రైనేజీ", bn: "নিকাশি ব্যবস্থা" }, color: "#a78bfa", icon: "Waves", action: "Fix drainage and sanitation", peopleShare: 1, costPerPersonUsd: 25, gapSource: "census sanitation proxy",
  },
  roads_transport: {
    label: { en: "Roads & transport", hi: "सड़क और परिवहन", mr: "रस्ते आणि वाहतूक", ta: "சாலைகள் மற்றும் போக்குவரத்து", te: "రోడ్లు & రవాణా", bn: "রাস্তা ও পরিবহন" }, color: "#f59e0b", icon: "Route", action: "Repair roads and improve transport", peopleShare: 1, costPerPersonUsd: 40, gapSource: "road km per km²",
  },
  electricity: {
    label: { en: "Electricity", hi: "बिजली", mr: "वीज", ta: "மின்சாரம்", te: "విద్యుత్", bn: "বিদ্যুৎ" }, color: "#facc15", icon: "Zap", action: "Stabilise electricity supply", peopleShare: 1, costPerPersonUsd: 30, gapSource: "night-light proxy",
  },
  health: {
    label: { en: "Health", hi: "स्वास्थ्य", mr: "आरोग्य", ta: "சுகாதாரம்", te: "ఆరోగ్యం", bn: "স্বাস্থ্য" }, color: "#f43f5e", icon: "HeartPulse", action: "Expand primary health services", peopleShare: 1, costPerPersonUsd: 35, gapSource: "km to nearest clinic",
  },
  education: {
    label: { en: "Education", hi: "शिक्षा", mr: "शिक्षण", ta: "கல்வி", te: "విద్య", bn: "শিক্ষা" }, color: "#22c55e", icon: "GraduationCap", action: "Add school capacity", peopleShare: 0.25, costPerPersonUsd: 60, gapSource: "schools per 1,000 people",
  },
  housing: {
    label: { en: "Housing", hi: "आवास", mr: "आवास", ta: "வீட்டுவசதி", te: "గృహనిర్మాణం", bn: "আবাসন" }, color: "#fb7185", icon: "House", action: "Upgrade housing conditions", peopleShare: 0.6, costPerPersonUsd: 120, gapSource: "vulnerability proxy",
  },
  waste_management: {
    label: { en: "Waste management", hi: "कचरा प्रबंधन", mr: "कचरा व्यवस्थापन", ta: "கழிவு மேலாண்மை", te: "చెత్త నిర్వహణ", bn: "বর্জ্য ব্যবস্থাপনা" }, color: "#84cc16", icon: "Trash2", action: "Fix solid-waste collection", peopleShare: 1, costPerPersonUsd: 8, gapSource: "vulnerability proxy",
  },
  public_safety_lighting: {
    label: { en: "Safety & street lighting", hi: "सुरक्षा और स्ट्रीट लाइट", mr: "सुरक्षा आणि पथदिवे", ta: "பாதுகாப்பு & தெரு விளக்குகள்", te: "భద్రత & వీధి దీపాలు", bn: "নিরাপত্তা ও রাস্তার আলো" }, color: "#e879f9", icon: "Lightbulb", action: "Install street lighting and safety measures", peopleShare: 1, costPerPersonUsd: 6, gapSource: "vulnerability proxy",
  },
  digital_connectivity: {
    label: { en: "Digital connectivity", hi: "डिजिटल कनेक्टिविटी", mr: "डिजिटल कनेक्टिव्हिटी", ta: "டிஜிட்டல் இணைப்பு", te: "డిజిటల్ కనెక్టివిటీ", bn: "ডিজিটাল সংযোগ" }, color: "#2dd4bf", icon: "Wifi", action: "Extend public connectivity", peopleShare: 1, costPerPersonUsd: 10, gapSource: "connectivity index",
  },
  agriculture_irrigation: {
    label: { en: "Agriculture & irrigation", hi: "कृषि और सिंचाई", mr: "कृषी आणि सिंचन", ta: "வேளாண்மை & நீர்ப்பாசனம்", te: "వ్యవసాయం & సాగునీరు", bn: "কৃষি ও সেচ" }, color: "#65a30d", icon: "Sprout", action: "Support irrigation and urban farming", peopleShare: 0.1, costPerPersonUsd: 50, gapSource: "vulnerability proxy",
  },
  other: {
    label: { en: "Other", hi: "अन्य", mr: "इतर", ta: "பிற", te: "ఇతర", bn: "অন্যান্য" }, color: "#94a3b8", icon: "CircleHelp", action: "Review civic issues", peopleShare: 0.5, costPerPersonUsd: 10, gapSource: "vulnerability proxy",
  },
};
export const URGENCY_WEIGHT: Record<Urgency, number> = { low: 0.5, medium: 1, high: 1.5, critical: 2.5 };
export const PRECISION = ["exact_pin", "street", "locality", "district", "unknown"] as const;
export type Precision = (typeof PRECISION)[number];
export const PRECISION_WEIGHT: Record<Precision, number> = { exact_pin: 1, street: 1, locality: 0.9, district: 1, unknown: 0 };
export function catLabel(c: string, lang: string = "en"): string { const m = CATEGORY_META[c as Category]; if (!m) return c; return (m.label as Record<string, string>)[lang] || m.label.en; }
export function isCategory(c: unknown): c is Category { return typeof c === "string" && (CATEGORIES as readonly string[]).includes(c); }
