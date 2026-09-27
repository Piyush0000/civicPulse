// Pilot regions. Boundaries are approximated as H3 discs around a centre point.
// Localities are real neighbourhood names at approximate coordinates; the vulnerability
// values are ILLUSTRATIVE, not official statistics.

export type Locality = {
  name: string; // English / romanised name
  local?: string; // name in the local script
  aliases?: string[];
  lat: number;
  lng: number;
  vuln: number; // 0..1 illustrative deprivation
  density: number; // relative population density 0..1
};

export type RegionDef = {
  code: string;
  name: string;
  localName: string;
  country: string; // ISO alpha-2
  countryName: string;
  flag: string;
  center: [number, number]; // lat, lng
  radiusKm: number;
  h3Res: number;
  languages: string[];
  langMix: Record<string, number>; // share of synthetic requests per language key (hl = Hinglish)
  currency: string;
  usdRate: number; // illustrative conversion for cross-country comparison
  peakDensityPerKm2: number;
  timezone: string;
  syntheticRequests: number;
  isLand?: (lat: number, lng: number) => boolean;
  localities: Locality[];
};

export const REGIONS: RegionDef[] = [
  {
    code: "IN-DL",
    name: "Delhi NCT",
    localName: "दिल्ली",
    country: "IN",
    countryName: "India",
    flag: "🇮🇳",
    center: [28.6139, 77.209],
    radiusKm: 18,
    h3Res: 8,
    languages: ["hi", "en"],
    langMix: { hi: 0.5, hl: 0.25, en: 0.25 },
    currency: "INR",
    usdRate: 0.012,
    peakDensityPerKm2: 32000,
    timezone: "Asia/Kolkata",
    syntheticRequests: 5000,
    localities: [
      { name: "Connaught Place", local: "कनॉट प्लेस", aliases: ["CP", "Rajiv Chowk"], lat: 28.6315, lng: 77.2167, vuln: 0.12, density: 0.5 },
      { name: "Karol Bagh", local: "करोल बाग", lat: 28.6519, lng: 77.1909, vuln: 0.3, density: 0.85 },
      { name: "Chandni Chowk", local: "चांदनी चौक", lat: 28.6506, lng: 77.2303, vuln: 0.45, density: 1 },
      { name: "Rohini", local: "रोहिणी", lat: 28.73, lng: 77.11, vuln: 0.3, density: 0.7 },
      { name: "Pitampura", local: "पीतमपुरा", lat: 28.7033, lng: 77.132, vuln: 0.22, density: 0.65 },
      { name: "Shahdara", local: "शाहदरा", lat: 28.673, lng: 77.289, vuln: 0.62, density: 0.95 },
      { name: "Seelampur", local: "सीलमपुर", lat: 28.666, lng: 77.269, vuln: 0.8, density: 1 },
      { name: "Mustafabad", local: "मुस्तफाबाद", lat: 28.71, lng: 77.27, vuln: 0.85, density: 0.95 },
      { name: "Mayur Vihar", local: "मयूर विहार", lat: 28.609, lng: 77.294, vuln: 0.35, density: 0.7 },
      { name: "Laxmi Nagar", local: "लक्ष्मी नगर", lat: 28.631, lng: 77.277, vuln: 0.4, density: 0.9 },
      { name: "Okhla", local: "ओखला", lat: 28.5355, lng: 77.272, vuln: 0.6, density: 0.75 },
      { name: "Saket", local: "साकेत", lat: 28.5245, lng: 77.2066, vuln: 0.15, density: 0.5 },
      { name: "Mehrauli", local: "महरौली", lat: 28.5244, lng: 77.1855, vuln: 0.55, density: 0.6 },
      { name: "Vasant Kunj", local: "वसंत कुंज", lat: 28.52, lng: 77.158, vuln: 0.12, density: 0.4 },
      { name: "Dwarka", local: "द्वारका", lat: 28.5921, lng: 77.046, vuln: 0.2, density: 0.6 },
      { name: "Janakpuri", local: "जनकपुरी", lat: 28.6219, lng: 77.0878, vuln: 0.22, density: 0.65 },
      { name: "Uttam Nagar", local: "उत्तम नगर", lat: 28.621, lng: 77.055, vuln: 0.6, density: 0.9 },
      { name: "Burari", local: "बुराड़ी", lat: 28.75, lng: 77.2, vuln: 0.72, density: 0.7 },
      { name: "Sangam Vihar", local: "संगम विहार", lat: 28.496, lng: 77.24, vuln: 0.88, density: 1 },
      { name: "Govindpuri", local: "गोविंदपुरी", lat: 28.536, lng: 77.264, vuln: 0.7, density: 0.85 },
      { name: "Jahangirpuri", local: "जहांगीरपुरी", lat: 28.73, lng: 77.17, vuln: 0.82, density: 0.9 },
      { name: "Lajpat Nagar", local: "लाजपत नगर", lat: 28.5677, lng: 77.2433, vuln: 0.25, density: 0.7 },
      { name: "Tilak Nagar", local: "तिलक नगर", lat: 28.64, lng: 77.096, vuln: 0.35, density: 0.8 },
      { name: "Badarpur", local: "बदरपुर", lat: 28.5, lng: 77.3, vuln: 0.75, density: 0.75 },
    ],
  },
  {
    code: "BR-PE-REC",
    name: "Recife",
    localName: "Recife",
    country: "BR",
    countryName: "Brazil",
    flag: "🇧🇷",
    center: [-8.06, -34.925],
    radiusKm: 9,
    h3Res: 8,
    languages: ["pt", "en"],
    langMix: { pt: 0.95, en: 0.05 },
    currency: "BRL",
    usdRate: 0.18,
    peakDensityPerKm2: 18000,
    timezone: "America/Recife",
    syntheticRequests: 1500,
    // Crude coastline: the Atlantic lies east of this line.
    isLand: (lat, lng) => lng < -34.868 + 0.208 * (lat + 8.0),
    localities: [
      { name: "Boa Viagem", lat: -8.118, lng: -34.9, vuln: 0.2, density: 0.8 },
      { name: "Casa Amarela", lat: -8.028, lng: -34.917, vuln: 0.5, density: 0.8 },
      { name: "Ibura", lat: -8.11, lng: -34.935, vuln: 0.85, density: 0.9 },
      { name: "Várzea", aliases: ["Varzea"], lat: -8.047, lng: -34.958, vuln: 0.6, density: 0.6 },
      { name: "Santo Amaro", lat: -8.045, lng: -34.885, vuln: 0.65, density: 0.7 },
      { name: "Afogados", lat: -8.075, lng: -34.908, vuln: 0.6, density: 0.85 },
      { name: "Imbiribeira", lat: -8.1, lng: -34.915, vuln: 0.5, density: 0.7 },
      { name: "Água Fria", aliases: ["Agua Fria"], lat: -8.018, lng: -34.897, vuln: 0.7, density: 0.8 },
      { name: "Nova Descoberta", lat: -8.006, lng: -34.928, vuln: 0.82, density: 0.85 },
      { name: "Brasília Teimosa", aliases: ["Brasilia Teimosa"], lat: -8.087, lng: -34.883, vuln: 0.78, density: 0.9 },
      { name: "Coque", lat: -8.07, lng: -34.896, vuln: 0.9, density: 1 },
      { name: "Madalena", lat: -8.055, lng: -34.908, vuln: 0.25, density: 0.6 },
      { name: "Encruzilhada", lat: -8.037, lng: -34.892, vuln: 0.3, density: 0.65 },
      { name: "Casa Forte", lat: -8.033, lng: -34.921, vuln: 0.15, density: 0.45 },
      { name: "Torre", lat: -8.049, lng: -34.913, vuln: 0.3, density: 0.6 },
      { name: "Areias", lat: -8.099, lng: -34.935, vuln: 0.72, density: 0.8 },
    ],
  },
  {
    code: "ZA-GP-JHB",
    name: "Johannesburg",
    localName: "eGoli",
    country: "ZA",
    countryName: "South Africa",
    flag: "🇿🇦",
    center: [-26.2, 27.98],
    radiusKm: 15,
    h3Res: 8,
    languages: ["en", "zu"],
    langMix: { en: 0.8, zu: 0.2 },
    currency: "ZAR",
    usdRate: 0.055,
    peakDensityPerKm2: 14000,
    timezone: "Africa/Johannesburg",
    syntheticRequests: 1200,
    localities: [
      { name: "Soweto", lat: -26.2485, lng: 27.854, vuln: 0.78, density: 0.95 },
      { name: "Johannesburg CBD", aliases: ["CBD", "Joburg CBD"], lat: -26.2041, lng: 28.0473, vuln: 0.45, density: 0.8 },
      { name: "Hillbrow", lat: -26.188, lng: 28.049, vuln: 0.8, density: 1 },
      { name: "Orlando", lat: -26.233, lng: 27.916, vuln: 0.72, density: 0.85 },
      { name: "Diepkloof", lat: -26.244, lng: 27.954, vuln: 0.68, density: 0.85 },
      { name: "Meadowlands", lat: -26.22, lng: 27.895, vuln: 0.74, density: 0.8 },
      { name: "Randburg", lat: -26.094, lng: 28.001, vuln: 0.2, density: 0.5 },
      { name: "Rosebank", lat: -26.146, lng: 28.044, vuln: 0.12, density: 0.45 },
      { name: "Melville", lat: -26.177, lng: 28.008, vuln: 0.2, density: 0.5 },
      { name: "Brixton", lat: -26.19, lng: 28.0, vuln: 0.4, density: 0.55 },
      { name: "Riverlea", lat: -26.214, lng: 27.97, vuln: 0.7, density: 0.6 },
      { name: "Florida", lat: -26.174, lng: 27.917, vuln: 0.3, density: 0.5 },
      { name: "Roodepoort", lat: -26.162, lng: 27.872, vuln: 0.4, density: 0.55 },
      { name: "Pimville", lat: -26.27, lng: 27.9, vuln: 0.76, density: 0.8 },
      { name: "Booysens", lat: -26.231, lng: 28.02, vuln: 0.55, density: 0.5 },
      { name: "Yeoville", lat: -26.183, lng: 28.065, vuln: 0.7, density: 0.85 },
      { name: "Kliptown", lat: -26.278, lng: 27.89, vuln: 0.9, density: 0.9 },
    ],
  },
  {
    code: "RU-TA-KZN",
    name: "Kazan",
    localName: "Казань",
    country: "RU",
    countryName: "Russia",
    flag: "🇷🇺",
    center: [55.7963, 49.1088],
    radiusKm: 10,
    h3Res: 8,
    languages: ["ru", "en"],
    langMix: { ru: 0.9, en: 0.1 },
    currency: "RUB",
    usdRate: 0.011,
    peakDensityPerKm2: 12000,
    timezone: "Europe/Moscow",
    syntheticRequests: 800,
    localities: [
      { name: "Vakhitovsky", local: "Вахитовский", lat: 55.79, lng: 49.13, vuln: 0.2, density: 0.8 },
      { name: "Kremlin", local: "Кремль", lat: 55.799, lng: 49.106, vuln: 0.1, density: 0.4 },
      { name: "Sovetsky", local: "Советский", lat: 55.787, lng: 49.2, vuln: 0.35, density: 0.7 },
      { name: "Privolzhsky", local: "Приволжский", lat: 55.745, lng: 49.15, vuln: 0.45, density: 0.75 },
      { name: "Moskovsky", local: "Московский", lat: 55.815, lng: 49.07, vuln: 0.5, density: 0.75 },
      { name: "Kirovsky", local: "Кировский", lat: 55.798, lng: 49.02, vuln: 0.6, density: 0.6 },
      { name: "Aviastroitelny", local: "Авиастроительный", lat: 55.85, lng: 49.08, vuln: 0.62, density: 0.7 },
      { name: "Novo-Savinovsky", local: "Ново-Савиновский", lat: 55.825, lng: 49.13, vuln: 0.3, density: 0.85 },
      { name: "Azino", local: "Азино", lat: 55.75, lng: 49.2, vuln: 0.4, density: 0.9 },
      { name: "Gorki", local: "Горки", lat: 55.765, lng: 49.185, vuln: 0.38, density: 0.85 },
      { name: "Derbyshki", local: "Дербышки", lat: 55.855, lng: 49.215, vuln: 0.7, density: 0.55 },
      { name: "Admiralteyskaya Sloboda", local: "Адмиралтейская слобода", lat: 55.82, lng: 49.05, vuln: 0.66, density: 0.5 },
    ],
  },
  {
    code: "CN-SC-CTU",
    name: "Chengdu",
    localName: "成都",
    country: "CN",
    countryName: "China",
    flag: "🇨🇳",
    center: [30.657, 104.066],
    radiusKm: 13,
    h3Res: 8,
    languages: ["zh", "en"],
    langMix: { zh: 0.9, en: 0.1 },
    currency: "CNY",
    usdRate: 0.14,
    peakDensityPerKm2: 28000,
    timezone: "Asia/Shanghai",
    syntheticRequests: 1000,
    localities: [
      { name: "Jinjiang", local: "锦江", lat: 30.656, lng: 104.083, vuln: 0.2, density: 0.9 },
      { name: "Qingyang", local: "青羊", lat: 30.674, lng: 104.061, vuln: 0.2, density: 0.85 },
      { name: "Wuhou", local: "武侯", lat: 30.642, lng: 104.043, vuln: 0.3, density: 0.9 },
      { name: "Chenghua", local: "成华", lat: 30.66, lng: 104.102, vuln: 0.45, density: 0.85 },
      { name: "Jinniu", local: "金牛", lat: 30.691, lng: 104.052, vuln: 0.5, density: 0.9 },
      { name: "Gaoxin", local: "高新", aliases: ["High-tech Zone"], lat: 30.58, lng: 104.06, vuln: 0.15, density: 0.7 },
      { name: "Chunxi Road", local: "春熙路", lat: 30.655, lng: 104.08, vuln: 0.15, density: 0.7 },
      { name: "Kuanzhai Xiangzi", local: "宽窄巷子", lat: 30.67, lng: 104.052, vuln: 0.2, density: 0.6 },
      { name: "Jiuyanqiao", local: "九眼桥", lat: 30.64, lng: 104.09, vuln: 0.3, density: 0.8 },
      { name: "Hehuachi", local: "荷花池", lat: 30.695, lng: 104.08, vuln: 0.55, density: 0.85 },
      { name: "Shuangqiao", local: "双桥", lat: 30.66, lng: 104.13, vuln: 0.6, density: 0.7 },
      { name: "Xipu", local: "犀浦", lat: 30.72, lng: 103.98, vuln: 0.62, density: 0.55 },
      { name: "Longtan", local: "龙潭", lat: 30.73, lng: 104.16, vuln: 0.72, density: 0.6 },
      { name: "Sanwayao", local: "三瓦窑", lat: 30.63, lng: 104.07, vuln: 0.25, density: 0.75 },
      { name: "Hongpailou", local: "红牌楼", lat: 30.62, lng: 104.02, vuln: 0.4, density: 0.8 },
    ],
  },
];

export const REGION_BY_CODE: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.code, r]));
export const DEFAULT_REGION = "IN-DL";

export function getRegion(code: string | null | undefined): RegionDef {
  return REGION_BY_CODE[code || DEFAULT_REGION] || REGION_BY_CODE[DEFAULT_REGION];
}
