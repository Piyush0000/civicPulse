import PublicNav from "@/components/PublicNav";

export const metadata = { title: "About & privacy" };

const DPG = [
  ["1. Relevance to the SDGs", "SDG 6 (water & sanitation), SDG 9 (infrastructure), SDG 11 (sustainable cities), SDG 16 (accountable institutions)."],
  ["2. Open licence", "Apache-2.0 for all code; open-data exports under CC BY 4.0."],
  ["3. Clear ownership", "Maintained as a public-interest project; each country instance is owned by its operator."],
  ["4. Platform independence", "No mandatory proprietary dependency. Every external service has an open or offline alternative: PGlite/Postgres, rule-based AI, hashed embeddings, SSE, OpenStreetMap."],
  ["5. Documentation", "Architecture, API (OpenAPI), data sources, privacy and demo script are in the repository docs."],
  ["6. Non-PII data extraction", "CSV / GeoJSON exports and signed federation aggregates, k-anonymised (k = 5)."],
  ["7. Privacy & applicable law", "Designed with India's DPDP Act 2023, Brazil's LGPD, South Africa's POPIA, Russia's 152-FZ and China's PIPL in mind (design considerations, not legal advice)."],
  ["8. Standards & best practice", "H3 grid, GeoJSON, OpenAPI 3.1, ISO 639 / 3166 codes, WCAG AA contrast, OWASP-style security headers."],
  ["9. Do no harm", "No individual tracking views, no search by reporter, audit ledger for every official action, rate limits, bias transparency on every score."],
];

export default function About() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">About CivicPulse</h1>
        <p className="mt-3 text-mute">
          Governments struggle to hear citizens at scale and to connect what they hear with where money goes. CivicPulse is a multilingual AI platform,
          designed as a Digital Public Good, that aggregates citizen development requests from voice, text and messaging channels, fuses them with
          demographic, infrastructure and investment data, detects demand hotspots and recommends high-priority projects to policymakers across Indian states and cities.
        </p>

        <h2 className="mt-10 text-xl font-semibold">Privacy notice (plain language)</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-mute">
          <li>We collect what you tell us (text or voice) and, only if you share it, a location.</li>
          <li>Phone numbers, emails, ID numbers and names are removed automatically before anyone sees your message.</li>
          <li>Your chat or phone ID is replaced by a one-way pseudonym. The mapping needed to reply to you is encrypted and deleted when you send STOP.</li>
          <li>Voice recordings are deleted after 30 days; texts after 2 years.</li>
          <li>Public maps and exports only show areas where at least 5 different people reported, so no one can be singled out.</li>
          <li>Officials cannot search for a person. Every action they take is written to a public, tamper-evident ledger.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold">Digital Public Good standard</h2>
        <div className="mt-3 flex flex-col gap-2">
          {DPG.map(([k, v]) => (
            <div key={k} className="card p-4">
              <div className="font-medium text-ink">{k}</div>
              <div className="mt-1 text-sm text-mute">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold">Zero paid services</h2>
        <p className="mt-3 text-mute">
          The full platform runs with no API keys at all. Optional free tiers make it smarter: Groq (Whisper speech-to-text and Llama 3.3), Google Gemini,
          Supabase (Postgres + Realtime), Telegram Bot API, OpenFreeMap tiles, Nominatim geocoding and MyMemory translation.
        </p>
      </main>
    </div>
  );
}
