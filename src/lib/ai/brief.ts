import { CATEGORY_META, type Category } from "../categories";
import { chat, hasLLM } from "./llm";
import { BRIEF_PROMPT_VERSION, BRIEF_SYSTEM } from "./prompts";

export type BriefPayload = {
  region: string;
  recommendation: {
    title: string;
    category: string;
    category_label: string;
    areas: string[];
    priority_score: number;
    rank: number;
    people_affected_est: number;
    requests_last_90_days: number;
    unique_reporters_last_90_days: number;
    hotspot_cells: number;
    grid_cells: number;
    funded_overlap_percent: number;
    mean_vulnerability: number;
    estimated_cost_usd: number;
  };
  infrastructure_gap: { indicator: string; area_value: number; region_median: number; is_proxy: boolean }[];
  citizen_quotes: { language: string; english: string }[];
  overlapping_projects: { title: string; status: string; budget: string }[];
  documents: { label: string; title: string; excerpt: string }[];
};

/** Numbers in the brief must come from the payload. Small integers (<= 10) and [D#] labels are allowed. */
export function unverifiedNumbers(markdown: string, payload: unknown): string[] {
  const allowed = new Set<string>();
  const addNums = (s: string) => {
    for (const m of s.match(/\d[\d,]*(?:\.\d+)?/g) || []) {
      const n = m.replace(/,/g, "");
      allowed.add(n);
      allowed.add(String(Number(n)));
    }
  };
  addNums(JSON.stringify(payload));
  allowed.add("100"); // the 0-100 score scale
  const text = markdown.replace(/\[D\d+\]/g, "");
  const bad = new Set<string>();
  for (const m of text.match(/\d[\d,]*(?:\.\d+)?/g) || []) {
    const n = m.replace(/,/g, "");
    if (Number(n) <= 10 && !n.includes(".")) continue;
    if (!allowed.has(n) && !allowed.has(String(Number(n)))) bad.add(m);
  }
  return [...bad];
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function templateBrief(p: BriefPayload): string {
  const r = p.recommendation;
  const gap = p.infrastructure_gap[0];
  const docs = p.documents;
  const lines: string[] = [];
  lines.push(`## Summary`);
  lines.push(
    `${r.title} is ranked #${r.rank} in ${p.region} with a priority score of ${r.priority_score} out of 100. ` +
      `Citizens filed ${fmt(r.requests_last_90_days)} ${r.category_label.toLowerCase()} requests from ${fmt(r.unique_reporters_last_90_days)} unique reporters in the last 90 days across ${r.grid_cells} grid cells, ${r.hotspot_cells} of which are statistically significant hotspots. ` +
      `An estimated ${fmt(r.people_affected_est)} people live in the affected area, and ${r.funded_overlap_percent}% of it is covered by planned or ongoing projects in this sector.`,
  );
  lines.push(``, `## Evidence`);
  lines.push(`- **Citizen demand:** ${fmt(r.requests_last_90_days)} requests, ${fmt(r.unique_reporters_last_90_days)} unique reporters (last 90 days).`);
  if (gap)
    lines.push(
      `- **Infrastructure gap:** ${gap.indicator.replace(/_/g, " ")} is ${gap.area_value} in this area vs a regional median of ${gap.region_median}${gap.is_proxy ? " (proxy indicator)" : ""}.`,
    );
  lines.push(`- **Population:** about ${fmt(r.people_affected_est)} people affected.`);
  lines.push(`- **Vulnerability:** mean deprivation index ${r.mean_vulnerability} (0 = least, 1 = most deprived).`);
  lines.push(`- **Funding overlap:** ${r.funded_overlap_percent}% of the area is covered by active projects in this category.`);
  lines.push(``, `## What citizens are saying`);
  if (p.citizen_quotes.length) for (const q of p.citizen_quotes) lines.push(`> "${q.english}" *(originally in ${q.language})*`, ``);
  else lines.push(`No quotes available.`);
  lines.push(``, `## Alignment with current plans`);
  if (p.overlapping_projects.length)
    lines.push(...p.overlapping_projects.map((o) => `- ${o.title}: ${o.status.replace("_", " ")}, budget ${o.budget}.`));
  else lines.push(`- No planned, approved or ongoing project in this sector covers this area.`);
  if (docs.length) {
    lines.push(`- The retrieved plan documents discuss this sector as follows:`);
    for (const d of docs.slice(0, 3)) lines.push(`  - ${d.title} ${d.label}: "${d.excerpt.slice(0, 160).trim()}..."`);
  } else lines.push(`- No relevant plan documents were found.`);
  lines.push(``, `## Suggested intervention options`);
  for (const s of SUGGESTIONS[r.category as Category] ?? SUGGESTIONS.other!) lines.push(`- *Suggestion:* ${s}`);
  lines.push(``, `## Risks & data limitations`);
  lines.push(`- Demand is adjusted for lower reporting in less-connected areas, but under-reporting may remain.`);
  if (gap?.is_proxy) lines.push(`- The infrastructure gap for this sector uses the vulnerability index as a proxy.`);
  lines.push(`- Some requests are geocoded only to the neighbourhood level.`);
  lines.push(`- Pilot data (indicators, projects, documents) is synthetic and illustrative.`);
  return lines.join("\n");
}

const SUGGESTIONS: Partial<Record<Category, string[]>> = {
  water_supply: ["Repair or add community water points and handpumps in unserved lanes.", "Rationalise tanker schedules to daily service until piped supply reaches the area.", "Test water quality where contamination is reported."],
  sanitation_drainage: ["Desilt drains before the rainy season and complete missing drain links.", "Add community toilets with maintenance contracts.", "Map low-lying lanes for storm-water pumping."],
  roads_transport: ["Resurface the most-reported road segments.", "Inspect and repair unsafe bridges and culverts first.", "Add feeder bus stops where there is no service."],
  electricity: ["Replace overloaded transformers and secure dangerous wiring.", "Publish outage schedules and add feeder capacity.", "Prioritise clinics and schools for backup supply."],
  health: ["Deploy mobile clinics and extend hours at existing facilities.", "Restock essential medicines with stock-out alerts.", "Run vector-control drives where fever outbreaks are reported."],
  education: ["Add classrooms or double shifts in overcrowded schools.", "Fill teacher vacancies for core subjects.", "Repair unsafe school buildings before the monsoon."],
  housing: ["Carry out structural safety audits of old buildings.", "Provide repair grants for leaking roofs.", "Restore heating supply and insulate the worst-affected blocks."],
  waste_management: ["Start daily door-to-door collection in the affected lanes.", "Clear illegal dumps and install enclosed bins.", "Enforce the ban on open burning."],
  public_safety_lighting: ["Repair street lights and add LED lighting on dark stretches.", "Run women's safety audits and add lighting near transit stops.", "Add community patrols or CCTV at theft hotspots."],
  digital_connectivity: ["Add public Wi-Fi at community centres.", "Reopen citizen service centres with regular hours.", "Coordinate with operators to fix signal dead zones."],
  agriculture_irrigation: ["Restore canal flow and repair distributaries.", "Connect community gardens to non-potable water."],
  other: ["Review the requests with the relevant department.", "Engage residents to clarify the issue."],
};

export async function generateBrief(p: BriefPayload): Promise<{ markdown: string; model: string; promptVersion: string; unverified: string[] }> {
  if (hasLLM()) {
    try {
      const user = `INPUT JSON:\n${JSON.stringify(p, null, 2)}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await chat({
          prefer: "gemini", // long-form policy writing
          messages: [
            { role: "system", content: BRIEF_SYSTEM },
            { role: "user", content: attempt === 0 ? user : `${user}\n\nYour previous draft contained numbers not in the input. Use ONLY numbers from the input JSON.` },
          ],
          temperature: 0.2,
          maxTokens: 1200,
        });
        const md = r.text.trim();
        const bad = unverifiedNumbers(md, p);
        if (!bad.length || attempt === 1) return { markdown: md, model: `${r.provider}:${r.model}`, promptVersion: BRIEF_PROMPT_VERSION, unverified: bad };
      }
    } catch {
      /* fall back to the template */
    }
  }
  const md = templateBrief(p);
  return { markdown: md, model: "template (offline)", promptVersion: "template_v1", unverified: unverifiedNumbers(md, p) };
}

export function categoryLabel(c: string) {
  return CATEGORY_META[c as Category]?.label.en ?? c;
}
