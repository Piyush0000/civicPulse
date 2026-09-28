// Pilot regions (India). Boundaries are approximated as H3 discs around a centre point.
// Localities are real neighbourhood names at approximate coordinates; the vulnerability
// values are ILLUSTRATIVE, not official statistics.

export type Locality = { name: string; local?: string; aliases?: string[]; lat: number; lng: number; vuln: number; density: number };

export type RegionDef = {
  code: string;
  name: string;
  localName: string;
  country: string;
  countryName: string;
  flag: string;
  state: string;
  center: [number, number];
  radiusKm: number;
  h3Res: number;
  languages: string[];
  langMix: Record<string, number>; // share of synthetic requests per language key (hl = Hinglish)
  currency: string;
  usdRate: number;
  peakDensityPerKm2: number;
  timezone: string;
  syntheticRequests: number;
  isLand?: (lat: number, lng: number) => boolean;
  localities: Locality[];
};

export const REGIONS: RegionDef[] = [
  {
    code: "IN-DL", name: "Delhi NCT", localName: "दिल्ली", country: "IN", countryName: "India", flag: "🇮🇳", state: "Delhi",
    center: [28.6139, 77.209], radiusKm: 18, h3Res: 8,
    languages: ["hi", "en"], langMix: { hi: 0.5, hl: 0.25, en: 0.25 },
    currency: "INR", usdRate: 0.012, peakDensityPerKm2: 32000, timezone: "Asia/Kolkata", syntheticRequests: 5000,
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
    code: "IN-MH", name: "Mumbai", localName: "मुंबई", country: "IN", countryName: "India", flag: "🇮🇳", state: "Maharashtra",
    center: [19.076, 72.8777], radiusKm: 15, h3Res: 8,
    languages: ["mr", "hi", "en"], langMix: { mr: 0.6, hi: 0.2, en: 0.2 },
    currency: "INR", usdRate: 0.012, peakDensityPerKm2: 40000, timezone: "Asia/Kolkata", syntheticRequests: 4000,
    // Crude coastline: the Arabian Sea lies west of ~72.81°E; Thane creek east of ~72.97°E.
    isLand: (_lat, lng) => lng > 72.81 && lng < 72.975,
    localities: [
      { name: "Dharavi", local: "धारावी", lat: 19.038, lng: 72.8538, vuln: 0.85, density: 1 },
      { name: "Andheri", local: "अंधेरी", lat: 19.1136, lng: 72.8697, vuln: 0.3, density: 0.8 },
      { name: "Bandra", local: "वांद्रे", lat: 19.0596, lng: 72.8295, vuln: 0.15, density: 0.6 },
      { name: "Kurla", local: "कुर्ला", lat: 19.0728, lng: 72.8826, vuln: 0.6, density: 0.9 },
      { name: "Dadar", local: "दादर", lat: 19.0178, lng: 72.8478, vuln: 0.25, density: 0.7 },
      { name: "Borivali", local: "बोरीवली", lat: 19.2307, lng: 72.8567, vuln: 0.2, density: 0.7 },
      { name: "Ghatkopar", local: "घाटकोपर", lat: 19.0856, lng: 72.908, vuln: 0.4, density: 0.8 },
      { name: "Govandi", local: "गोवंडी", lat: 19.055, lng: 72.915, vuln: 0.88, density: 0.95 },
      { name: "Mankhurd", local: "मानखुर्द", lat: 19.048, lng: 72.932, vuln: 0.86, density: 0.9 },
      { name: "Malvani", local: "मालवणी", lat: 19.19, lng: 72.83, vuln: 0.8, density: 0.9 },
      { name: "Chembur", local: "चेंबूर", lat: 19.062, lng: 72.9, vuln: 0.35, density: 0.7 },
      { name: "Sion", local: "सायन", lat: 19.04, lng: 72.862, vuln: 0.4, density: 0.85 },
      { name: "Powai", local: "पवई", lat: 19.1176, lng: 72.906, vuln: 0.12, density: 0.5 },
    ],
  },
  {
    code: "IN-TN", name: "Chennai", localName: "சென்னை", country: "IN", countryName: "India", flag: "🇮🇳", state: "Tamil Nadu",
    center: [13.0827, 80.2707], radiusKm: 12, h3Res: 8,
    languages: ["ta", "en"], langMix: { ta: 0.8, en: 0.2 },
    currency: "INR", usdRate: 0.012, peakDensityPerKm2: 25000, timezone: "Asia/Kolkata", syntheticRequests: 3000,
    // Bay of Bengal east of ~80.29°E.
    isLand: (_lat, lng) => lng < 80.292,
    localities: [
      { name: "T. Nagar", local: "தி. நகர்", lat: 13.0382, lng: 80.2365, vuln: 0.2, density: 0.9 },
      { name: "Mylapore", local: "மயிலாப்பூர்", lat: 13.0368, lng: 80.2676, vuln: 0.15, density: 0.7 },
      { name: "Velachery", local: "வேளச்சேரி", lat: 12.9774, lng: 80.2229, vuln: 0.3, density: 0.8 },
      { name: "Adyar", local: "அடையார்", lat: 13.0012, lng: 80.2565, vuln: 0.1, density: 0.6 },
      { name: "Anna Nagar", local: "அண்ணா நகர்", lat: 13.085, lng: 80.2101, vuln: 0.1, density: 0.6 },
      { name: "Guindy", local: "கிண்டி", lat: 13.0067, lng: 80.2206, vuln: 0.25, density: 0.7 },
      { name: "Vyasarpadi", local: "வியாசர்பாடி", lat: 13.117, lng: 80.259, vuln: 0.85, density: 0.95 },
      { name: "Kodungaiyur", local: "கொடுங்கையூர்", lat: 13.137, lng: 80.247, vuln: 0.78, density: 0.85 },
      { name: "Royapuram", local: "ராயபுரம்", lat: 13.113, lng: 80.286, vuln: 0.7, density: 0.9 },
      { name: "Saidapet", local: "சைதாப்பேட்டை", lat: 13.021, lng: 80.223, vuln: 0.55, density: 0.85 },
      { name: "Perambur", local: "பெரம்பூர்", lat: 13.118, lng: 80.233, vuln: 0.6, density: 0.85 },
    ],
  },
  {
    code: "IN-WB", name: "Kolkata", localName: "কলকাতা", country: "IN", countryName: "India", flag: "🇮🇳", state: "West Bengal",
    center: [22.5726, 88.3639], radiusKm: 12, h3Res: 8,
    languages: ["bn", "hi", "en"], langMix: { bn: 0.8, hi: 0.1, en: 0.1 },
    currency: "INR", usdRate: 0.012, peakDensityPerKm2: 24000, timezone: "Asia/Kolkata", syntheticRequests: 3500,
    localities: [
      { name: "Salt Lake", local: "সল্ট লেক", lat: 22.5868, lng: 88.4093, vuln: 0.1, density: 0.5 },
      { name: "Ballygunge", local: "বালিগঞ্জ", lat: 22.528, lng: 88.3659, vuln: 0.15, density: 0.7 },
      { name: "Howrah", local: "হাওড়া", lat: 22.5958, lng: 88.326, vuln: 0.6, density: 0.9 },
      { name: "Dum Dum", local: "দমদম", lat: 22.6226, lng: 88.4176, vuln: 0.4, density: 0.8 },
      { name: "Park Street", local: "পার্ক স্ট্রিট", lat: 22.5516, lng: 88.3524, vuln: 0.1, density: 0.8 },
      { name: "Jadavpur", local: "যাদবপুর", lat: 22.4955, lng: 88.3709, vuln: 0.2, density: 0.7 },
      { name: "Tiljala", local: "তিলজলা", lat: 22.53, lng: 88.39, vuln: 0.85, density: 0.95 },
      { name: "Topsia", local: "তপসিয়া", lat: 22.54, lng: 88.385, vuln: 0.82, density: 0.95 },
      { name: "Metiabruz", local: "মেটিয়াবুরুজ", lat: 22.54, lng: 88.28, vuln: 0.8, density: 0.85 },
      { name: "Rajabazar", local: "রাজাবাজার", lat: 22.585, lng: 88.37, vuln: 0.7, density: 0.9 },
      { name: "Behala", local: "বেহালা", lat: 22.49, lng: 88.31, vuln: 0.45, density: 0.8 },
    ],
  },
  {
    code: "IN-TS", name: "Hyderabad", localName: "హైదరాబాద్", country: "IN", countryName: "India", flag: "🇮🇳", state: "Telangana",
    center: [17.385, 78.4867], radiusKm: 14, h3Res: 8,
    languages: ["te", "hi", "en"], langMix: { te: 0.7, hi: 0.15, en: 0.15 },
    currency: "INR", usdRate: 0.012, peakDensityPerKm2: 18000, timezone: "Asia/Kolkata", syntheticRequests: 3000,
    localities: [
      { name: "Charminar", local: "చార్మినార్", lat: 17.3616, lng: 78.4747, vuln: 0.5, density: 0.9 },
      { name: "Banjara Hills", local: "బంజారా హిల్స్", lat: 17.4123, lng: 78.4384, vuln: 0.05, density: 0.4 },
      { name: "Gachibowli", local: "గచ్చిబౌలి", lat: 17.4401, lng: 78.3489, vuln: 0.1, density: 0.5 },
      { name: "Kukatpally", local: "కూకట్‌పల్లి", lat: 17.4849, lng: 78.3971, vuln: 0.2, density: 0.8 },
      { name: "Secunderabad", local: "సికింద్రాబాద్", lat: 17.4399, lng: 78.4983, vuln: 0.3, density: 0.7 },
      { name: "Madhapur", local: "మాదాపూర్", lat: 17.4483, lng: 78.3915, vuln: 0.1, density: 0.6 },
      { name: "Falaknuma", local: "ఫలక్‌నుమా", lat: 17.33, lng: 78.47, vuln: 0.85, density: 0.9 },
      { name: "Yakutpura", local: "యాకుత్‌పురా", lat: 17.355, lng: 78.49, vuln: 0.8, density: 0.95 },
      { name: "Malakpet", local: "మలక్‌పేట", lat: 17.373, lng: 78.505, vuln: 0.6, density: 0.85 },
      { name: "Tolichowki", local: "టోలిచౌకి", lat: 17.398, lng: 78.415, vuln: 0.5, density: 0.8 },
      { name: "Uppal", local: "ఉప్పల్", lat: 17.405, lng: 78.559, vuln: 0.45, density: 0.7 },
      { name: "LB Nagar", local: "ఎల్బీ నగర్", lat: 17.347, lng: 78.552, vuln: 0.5, density: 0.75 },
    ],
  },
];

export const REGION_BY_CODE: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.code, r]));
export const DEFAULT_REGION = "IN-DL";

export function getRegion(code: string | null | undefined): RegionDef {
  return REGION_BY_CODE[code || DEFAULT_REGION] || REGION_BY_CODE[DEFAULT_REGION];
}
