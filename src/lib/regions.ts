// Pilot regions. Boundaries are approximated as H3 discs around a centre point.
export type Locality = { name: string; local?: string; aliases?: string[]; lat: number; lng: number; vuln: number; density: number; };

export type RegionDef = {
  code: string; name: string; localName: string; country: string; countryName: string; flag: string; center: [number, number]; radiusKm: number; h3Res: number;
  languages: string[]; langMix: Record<string, number>; currency: string; usdRate: number; peakDensityPerKm2: number; timezone: string; syntheticRequests: number; isLand?: (lat: number, lng: number) => boolean; localities: Locality[];
};

export const REGIONS: RegionDef[] = [
  {
    code: "IN-DL", name: "Delhi NCT", localName: "दिल्ली", country: "IN", countryName: "India", flag: "🇮🇳", center: [28.6139, 77.209], radiusKm: 18, h3Res: 8,
    languages: ["hi", "en"], langMix: { hi: 0.5, hl: 0.25, en: 0.25 }, currency: "INR", usdRate: 0.012, peakDensityPerKm2: 32000, timezone: "Asia/Kolkata", syntheticRequests: 5000,
    localities: [
      { name: "Connaught Place", local: "कनॉट प्लेस", aliases: ["CP", "Rajiv Chowk"], lat: 28.6315, lng: 77.2167, vuln: 0.12, density: 0.5 },
      { name: "Karol Bagh", local: "करोल बाग", lat: 28.6519, lng: 77.1909, vuln: 0.3, density: 0.85 },
      { name: "Chandni Chowk", local: "चांदनी चौक", lat: 28.6506, lng: 77.2303, vuln: 0.45, density: 1 },
      { name: "Rohini", local: "रोहिणी", lat: 28.73, lng: 77.11, vuln: 0.3, density: 0.7 },
      { name: "Shahdara", local: "शाहदरा", lat: 28.673, lng: 77.289, vuln: 0.62, density: 0.95 },
      { name: "Seelampur", local: "सीलमपुर", lat: 28.666, lng: 77.269, vuln: 0.8, density: 1 },
      { name: "Okhla", local: "ओखला", lat: 28.5355, lng: 77.272, vuln: 0.6, density: 0.75 },
      { name: "Saket", local: "साकेत", lat: 28.5245, lng: 77.2066, vuln: 0.15, density: 0.5 },
      { name: "Dwarka", local: "द्वारका", lat: 28.5921, lng: 77.046, vuln: 0.2, density: 0.6 },
    ],
  },
  {
    code: "IN-MH", name: "Mumbai", localName: "मुंबई", country: "IN", countryName: "India", flag: "🇮🇳", center: [19.0760, 72.8777], radiusKm: 15, h3Res: 8,
    languages: ["mr", "en"], langMix: { mr: 0.6, en: 0.2, hi: 0.2 }, currency: "INR", usdRate: 0.012, peakDensityPerKm2: 40000, timezone: "Asia/Kolkata", syntheticRequests: 4000,
    isLand: (lat, lng) => lng > 72.8,
    localities: [
      { name: "Dharavi", local: "धारावी", lat: 19.0380, lng: 72.8538, vuln: 0.85, density: 1 },
      { name: "Andheri", local: "अंधेरी", lat: 19.1136, lng: 72.8697, vuln: 0.3, density: 0.8 },
      { name: "Bandra", local: "वांद्रे", lat: 19.0596, lng: 72.8295, vuln: 0.15, density: 0.6 },
      { name: "Kurla", local: "कुर्ला", lat: 19.0728, lng: 72.8826, vuln: 0.6, density: 0.9 },
      { name: "Dadar", local: "दादर", lat: 19.0178, lng: 72.8478, vuln: 0.25, density: 0.7 },
      { name: "Borivali", local: "बोरीवली", lat: 19.2307, lng: 72.8567, vuln: 0.2, density: 0.7 },
      { name: "Ghatkopar", local: "घाटकोपर", lat: 19.0856, lng: 72.9080, vuln: 0.4, density: 0.8 },
    ]
  },
  {
    code: "IN-TN", name: "Chennai", localName: "சென்னை", country: "IN", countryName: "India", flag: "🇮🇳", center: [13.0827, 80.2707], radiusKm: 12, h3Res: 8,
    languages: ["ta", "en"], langMix: { ta: 0.8, en: 0.2 }, currency: "INR", usdRate: 0.012, peakDensityPerKm2: 25000, timezone: "Asia/Kolkata", syntheticRequests: 3000,
    isLand: (lat, lng) => lng < 80.3,
    localities: [
      { name: "T. Nagar", local: "தி. நகர்", lat: 13.0382, lng: 80.2365, vuln: 0.2, density: 0.9 },
      { name: "Mylapore", local: "மயிலாப்பூர்", lat: 13.0368, lng: 80.2676, vuln: 0.15, density: 0.7 },
      { name: "Velachery", local: "வேளச்சேரி", lat: 12.9774, lng: 80.2229, vuln: 0.3, density: 0.8 },
      { name: "Adyar", local: "அடையார்", lat: 13.0012, lng: 80.2565, vuln: 0.1, density: 0.6 },
      { name: "Tambaram", local: "தாம்பரம்", lat: 12.9249, lng: 80.1000, vuln: 0.4, density: 0.7 },
      { name: "Anna Nagar", local: "அண்ணா நகர்", lat: 13.0850, lng: 80.2101, vuln: 0.1, density: 0.6 },
      { name: "Guindy", local: "கிண்டி", lat: 13.0067, lng: 80.2206, vuln: 0.25, density: 0.7 },
    ]
  },
  {
    code: "IN-WB", name: "Kolkata", localName: "কলকাতা", country: "IN", countryName: "India", flag: "🇮🇳", center: [22.5726, 88.3639], radiusKm: 12, h3Res: 8,
    languages: ["bn", "en"], langMix: { bn: 0.8, en: 0.1, hi: 0.1 }, currency: "INR", usdRate: 0.012, peakDensityPerKm2: 24000, timezone: "Asia/Kolkata", syntheticRequests: 3500,
    localities: [
      { name: "Salt Lake", local: "সল্ট লেক", lat: 22.5868, lng: 88.4093, vuln: 0.1, density: 0.5 },
      { name: "Ballygunge", local: "বালিগঞ্জ", lat: 22.5280, lng: 88.3659, vuln: 0.15, density: 0.7 },
      { name: "Howrah", local: "হাওড়া", lat: 22.5958, lng: 88.3260, vuln: 0.6, density: 0.9 },
      { name: "Dum Dum", local: "দমদম", lat: 22.6226, lng: 88.4176, vuln: 0.4, density: 0.8 },
      { name: "Park Street", local: "পার্ক স্ট্রিট", lat: 22.5516, lng: 88.3524, vuln: 0.1, density: 0.8 },
      { name: "Jadavpur", local: "যাদবপুর", lat: 22.4955, lng: 88.3709, vuln: 0.2, density: 0.7 },
    ]
  },
  {
    code: "IN-TS", name: "Hyderabad", localName: "హైదరాబాద్", country: "IN", countryName: "India", flag: "🇮🇳", center: [17.3850, 78.4867], radiusKm: 14, h3Res: 8,
    languages: ["te", "en"], langMix: { te: 0.7, en: 0.15, hi: 0.15 }, currency: "INR", usdRate: 0.012, peakDensityPerKm2: 18000, timezone: "Asia/Kolkata", syntheticRequests: 3000,
    localities: [
      { name: "Charminar", local: "చార్మినార్", lat: 17.3616, lng: 78.4747, vuln: 0.5, density: 0.9 },
      { name: "Banjara Hills", local: "బంజారా హిల్స్", lat: 17.4123, lng: 78.4384, vuln: 0.05, density: 0.4 },
      { name: "Gachibowli", local: "గచ్చిబౌలి", lat: 17.4401, lng: 78.3489, vuln: 0.1, density: 0.5 },
      { name: "Kukatpally", local: "కూకట్‌పల్లి", lat: 17.4849, lng: 78.3971, vuln: 0.2, density: 0.8 },
      { name: "Secunderabad", local: "సికింద్రాబాద్", lat: 17.4399, lng: 78.4983, vuln: 0.3, density: 0.7 },
      { name: "Madhapur", local: "మాదాపూర్", lat: 17.4483, lng: 78.3915, vuln: 0.1, density: 0.6 },
    ]
  }
];

export const REGION_BY_CODE: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.code, r]));
export const DEFAULT_REGION = "IN-DL";

export function getRegion(code: string | null | undefined): RegionDef {
  return REGION_BY_CODE[code || DEFAULT_REGION] || REGION_BY_CODE[DEFAULT_REGION];
}
