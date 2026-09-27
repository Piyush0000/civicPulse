import { CATEGORIES, catLabel, isCategory } from "@/lib/categories";
import { chat, hasLLM, type ChatMessage, type ToolDef } from "@/lib/ai/llm";
import { q } from "@/lib/db";
import { getRegion, REGIONS } from "@/lib/regions";
import { overview } from "./dashboard";
import { bricsCompare, budgetAlignment, forecast, impactProjects, listRecommendations } from "./planning";

// "Ask CivicPulse": a policy copilot that answers ONLY from analytics tools (no free-form numbers).

type ToolFn = (args: Record<string, unknown>, region: string) => Promise<unknown>;

const TOOLS: Record<string, { def: ToolDef; run: ToolFn }> = {
  overview_kpis: {
    def: fn("overview_kpis", "Headline numbers for the region: request volumes, channels, languages, categories, hotspots, pipeline health.", {}),
    run: async (_a, region) => {
      const o = await overview(region);
      return { region: o.region, totals: o.totals, pctGeocoded: o.pctGeocoded, byCategoryLast30Days: o.byCategory, byLanguage: o.byLanguage, byChannel: o.byChannel, hotspots: o.hotspots };
    },
  },
  top_recommendations: {
    def: fn("top_recommendations", "Ranked project recommendations with score, people affected, requests, funded overlap and decision status.", {
      category: { type: "string", enum: [...CATEGORIES], description: "optional category filter" },
      limit: { type: "integer", description: "max rows (default 5)" },
    }),
    run: async (a, region) => {
      const rows = (await listRecommendations(region, { category: isCategory(a.category) ? a.category : null })) as Record<string, unknown>[];
      return rows.slice(0, Number(a.limit) || 5).map((r) => ({
        rank: r.rank, title: r.title, category: r.category, priority_score: round(r.priority_score), people_affected: r.people_affected_est,
        requests_90d: r.request_count, hotspot_cells: r.hotspot_cells, funded_overlap_pct: Math.round(Number(r.funded_overlap) * 100), status: r.status,
        est_cost_usd: r.est_cost_usd,
      }));
    },
  },
  hotspot_areas: {
    def: fn("hotspot_areas", "Statistically significant demand hotspots (Getis-Ord Gi*) grouped by category and neighbourhood.", {
      category: { type: "string", enum: [...CATEGORIES] },
    }),
    run: async (a, region) =>
      q(
        `SELECT s.category, c.admin_name area, count(*)::int hotspot_cells, sum(s.request_count_90d)::int requests_90d,
                round(max(s.gi_z)::numeric, 1)::float8 max_z, round(avg(s.priority_score)::numeric, 1)::float8 avg_priority,
                round(avg(s.f_coverage)::numeric * 100)::int funded_pct
           FROM cell_scores s JOIN h3_cells c USING (region_code, h3_cell)
          WHERE s.region_code=$1 AND s.is_hotspot ${isCategory(a.category) ? "AND s.category=$2" : ""}
          GROUP BY 1,2 ORDER BY requests_90d DESC LIMIT 15`,
        isCategory(a.category) ? [region, a.category] : [region],
      ),
  },
  budget_alignment: {
    def: fn("budget_alignment", "Planned investment share vs citizen demand share by category (positive gap = under-funded relative to demand).", {}),
    run: async (_a, region) => {
      const b = await budgetAlignment(region);
      return { currency: b.currency, totalBudget: b.totalBudget, byCategory: b.byCategory.map((c) => ({ ...c, demandPct: pct(c.demandShare), investmentPct: pct(c.investmentShare), gapPts: pct(c.gap) })) };
    },
  },
  emerging_trends: {
    def: fn("emerging_trends", "Emerging hotspots (sharp rise in the last 30 days) and 3-month category forecasts.", {}),
    run: async (_a, region) => {
      const f = await forecast(region);
      return { emerging: f.emerging.slice(0, 8), forecastNext3Months: f.series.filter((s) => Math.abs(s.changePct) >= 15).map((s) => ({ category: s.category, changePct: s.changePct, forecast: s.forecast })) };
    },
  },
  impact_of_completed_projects: {
    def: fn("impact_of_completed_projects", "Before/after request rates for completed projects with a control group (difference-in-differences).", {}),
    run: async (_a, region) =>
      (await impactProjects(region)).map((p) => ({ title: p.title, category: p.category, pctChange: p.impact.pctChange, controlPctChange: p.impact.controlPctChange, didPts: p.impact.did })),
  },
  compare_brics_cities: {
    def: fn("compare_brics_cities", "Aggregate-only comparison across the BRICS pilot cities (k-anonymous federation data).", {}),
    run: async () =>
      (await bricsCompare()).map((b) => ({
        city: b.region.name, country: b.region.country, population: b.population, budgetUsd: b.budgetUsd, misalignment: b.misalignment,
        topCategories: [...b.categories].sort((x, y) => y.requests - x.requests).slice(0, 3).map((c) => ({ category: c.category, per100k: c.per100k })),
      })),
  },
  search_requests: {
    def: fn("search_requests", "Search citizen requests (redacted English summaries) by keyword.", {
      query: { type: "string" },
      limit: { type: "integer" },
    }),
    run: async (a, region) =>
      q(
        `SELECT tracking_code, category, urgency, language_detected, admin_name area, summary, submitted_at::date date
           FROM requests WHERE region_code=$1 AND is_actionable AND (summary ILIKE $2 OR text_english_redacted ILIKE $2)
          ORDER BY submitted_at DESC LIMIT $3`,
        [region, `%${String(a.query || "")}%`, Math.min(20, Number(a.limit) || 8)],
      ),
  },
};

function fn(name: string, description: string, properties: object): ToolDef {
  return { type: "function", function: { name, description, parameters: { type: "object", properties } } };
}
const round = (x: unknown) => Math.round(Number(x) * 10) / 10;
const pct = (x: number) => Math.round(x * 1000) / 10;

const SYSTEM = (region: string) => `You are "Ask CivicPulse", an analyst assistant for government planners in ${getRegion(region).name} (${getRegion(region).countryName}).
Answer questions using ONLY data returned by the tools. Call tools first; never guess numbers.
Be concise: short paragraphs or bullet points in Markdown, cite concrete numbers from tool output, and end with one actionable suggestion.
If data is synthetic/illustrative, you may mention it once. Category ids: ${CATEGORIES.join(", ")}.`;

export type CopilotStep = { tool: string; args: Record<string, unknown>; resultPreview: string };

export async function askCopilot(region: string, question: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  const steps: CopilotStep[] = [];
  const runTool = async (name: string, args: Record<string, unknown>) => {
    const t = TOOLS[name];
    if (!t) return { error: `unknown tool ${name}` };
    const res = await t.run(args, region);
    steps.push({ tool: name, args, resultPreview: JSON.stringify(res).slice(0, 400) });
    return res;
  };

  if (hasLLM()) {
    try {
      const messages: ChatMessage[] = [{ role: "system", content: SYSTEM(region) }, ...history.slice(-6), { role: "user", content: question }];
      for (let i = 0; i < 5; i++) {
        const r = await chat({ messages, tools: Object.values(TOOLS).map((t) => t.def), temperature: 0.1, maxTokens: 900 });
        if (!r.toolCalls.length) return { answer: r.text, steps, provider: `${r.provider}:${r.model}` };
        messages.push({ role: "assistant", content: r.text || null, tool_calls: r.toolCalls });
        for (const tc of r.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            /* empty args */
          }
          const res = await runTool(tc.function.name, args);
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(res).slice(0, 6000) });
        }
      }
      return { answer: "I ran out of reasoning steps; try a narrower question.", steps, provider: "llm" };
    } catch {
      /* fall back to rules */
    }
  }
  return ruleCopilot(region, question, runTool, steps);
}

async function ruleCopilot(region: string, question: string, run: (n: string, a: Record<string, unknown>) => Promise<unknown>, steps: CopilotStep[]) {
  const ql = question.toLowerCase();
  const cat = CATEGORIES.find((c) => ql.includes(c.replace(/_.*/, "")) || ql.includes(catLabel(c).toLowerCase().split(" ")[0]));
  const lines: string[] = [];
  const name = getRegion(region).name;
  if (/brics|compare|countr|cities|federat/.test(ql)) {
    const rows = (await run("compare_brics_cities", {})) as { city: string; population: number; misalignment: number; topCategories: { category: string; per100k: number }[] }[];
    lines.push(`**BRICS pilot comparison** (aggregate-only, k-anonymous):`);
    for (const r of rows) lines.push(`- **${r.city}**: top need ${catLabel(r.topCategories[0]?.category ?? "other")} (${r.topCategories[0]?.per100k ?? 0} requests per 100k in 90 days), budget misalignment index ${r.misalignment}.`);
    const worst = [...rows].sort((a, b) => b.misalignment - a.misalignment)[0];
    if (worst) lines.push(``, `Suggestion: ${worst.city} shows the largest gap between spending and citizen demand. Start the next budget review there.`);
  } else if (/budget|spend|invest|fund|misalign/.test(ql)) {
    const b = (await run("budget_alignment", {})) as { byCategory: { category: string; demandPct: number; investmentPct: number; gapPts: number }[] };
    const under = [...b.byCategory].sort((x, y) => y.gapPts - x.gapPts).slice(0, 3);
    const over = [...b.byCategory].sort((x, y) => x.gapPts - y.gapPts).slice(0, 2);
    lines.push(`**Budget vs demand in ${name}:**`, `Most under-funded relative to citizen demand:`);
    for (const u of under) lines.push(`- ${catLabel(u.category)}: ${u.demandPct}% of demand but ${u.investmentPct}% of planned spend (gap +${u.gapPts} pts).`);
    lines.push(`Most over-funded relative to demand:`);
    for (const o of over) lines.push(`- ${catLabel(o.category)}: ${o.investmentPct}% of spend vs ${o.demandPct}% of demand.`);
    lines.push(``, `Suggestion: rebalance part of the ${catLabel(over[0].category)} allocation towards ${catLabel(under[0].category)}. Use the Budget Optimizer to test it.`);
  } else if (/emerg|trend|forecast|predict|next month|rising|outbreak/.test(ql)) {
    const e = (await run("emerging_trends", {})) as { emerging: { category: string; area: string; requests: number; maxTrend: number }[]; forecastNext3Months: { category: string; changePct: number }[] };
    lines.push(`**Emerging hotspots in ${name}** (last 30 days vs the prior 60):`);
    for (const x of e.emerging.slice(0, 5)) lines.push(`- ${catLabel(x.category)} in ${x.area}: ${x.requests} requests, up to ${x.maxTrend.toFixed(1)}× the expected rate.`);
    if (e.forecastNext3Months.length) {
      lines.push(``, `**3-month outlook:**`);
      for (const f of e.forecastNext3Months) lines.push(`- ${catLabel(f.category)}: ${f.changePct > 0 ? "+" : ""}${f.changePct}% vs the last 3 months.`);
    }
    lines.push(``, `Suggestion: send rapid-response teams to the top emerging area before it becomes a sustained hotspot.`);
  } else if (/impact|completed|work(ed)?|before|after|result/.test(ql)) {
    const rows = (await run("impact_of_completed_projects", {})) as { title: string; pctChange: number | null; controlPctChange: number | null; didPts: number | null }[];
    lines.push(`**Impact of completed projects in ${name}** (indicative, not causal):`);
    for (const r of rows) lines.push(`- ${r.title}: requests ${r.pctChange ?? "n/a"}% after completion vs ${r.controlPctChange ?? "n/a"}% in similar control areas (difference ${r.didPts ?? "n/a"} pts).`);
  } else if (/hotspot|where|worst|area|neighbou?rhood/.test(ql)) {
    const rows = (await run("hotspot_areas", cat ? { category: cat } : {})) as { category: string; area: string; hotspot_cells: number; requests_90d: number; max_z: number; funded_pct: number }[];
    lines.push(`**Significant hotspots${cat ? ` for ${catLabel(cat)}` : ""} in ${name}:**`);
    for (const r of rows.slice(0, 6)) lines.push(`- ${catLabel(r.category)} in **${r.area}**: ${r.requests_90d} requests in 90 days across ${r.hotspot_cells} cells (Gi* z up to ${r.max_z}); ${r.funded_pct}% covered by planned projects.`);
    const unfunded = rows.find((r) => r.funded_pct === 0);
    if (unfunded) lines.push(``, `Suggestion: ${unfunded.area} (${catLabel(unfunded.category)}) has no funded project yet. It is a strong candidate for the next budget cycle.`);
  } else if (/find|search|say|complain|quote/.test(ql)) {
    const term = ql.replace(/.*(about|for|mention(ing)?)\s+/, "").replace(/[?.]/g, "").trim().split(" ").slice(-2).join(" ");
    const rows = (await run("search_requests", { query: term, limit: 6 })) as { tracking_code: string; area: string; summary: string; urgency: string }[];
    lines.push(`**Citizen requests mentioning "${term}":**`);
    for (const r of rows) lines.push(`- ${r.tracking_code} (${r.area ?? "unlocated"}, ${r.urgency}): ${r.summary}`);
  } else {
    const rows = (await run("top_recommendations", cat ? { category: cat, limit: 5 } : { limit: 5 })) as { rank: number; title: string; priority_score: number; people_affected: number; requests_90d: number; funded_overlap_pct: number; status: string }[];
    lines.push(`**Top priorities${cat ? ` for ${catLabel(cat)}` : ""} in ${name}:**`);
    for (const r of rows) lines.push(`${r.rank}. **${r.title}**: score ${r.priority_score}/100, about ${r.people_affected.toLocaleString("en-US")} people, ${r.requests_90d} requests in 90 days, ${r.funded_overlap_pct}% already funded (${r.status}).`);
    lines.push(``, `Suggestion: open the #1 recommendation to read its evidence brief and record a decision.`);
  }
  lines.push(``, `<sub>Offline mode: answered by rule-based routing over the same analytics tools. Add a free GROQ_API_KEY or GEMINI_API_KEY for conversational answers.</sub>`);
  return { answer: lines.join("\n"), steps, provider: "rules (offline)" };
}

export const COPILOT_SUGGESTIONS = [
  "Where is water need worst and still unfunded?",
  "Which categories are under-funded compared to citizen demand?",
  "What is emerging right now? Any outbreaks?",
  "Did completed projects actually reduce complaints?",
  "Compare the BRICS pilot cities",
  "What are citizens saying about streetlights?",
];

export const REGION_NAMES = REGIONS.map((r) => r.name);
