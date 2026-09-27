"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Flame, Languages, Mic, Radar, Users } from "lucide-react";
import { fmt, fmtCompact, useApi, useInterval, useRegion } from "@/lib/client/hooks";
import { CATEGORIES, catLabel } from "@/lib/categories";
import { BarList, TrendArea } from "@/components/charts";
import { PulseFeed, SimulateButton, useLiveFeed } from "@/components/PulseFeed";
import { CatBadge, ErrorBox, Kpi, LANG_LABEL, ScoreRing, Section, Spinner, StatusBadge, cx } from "@/components/ui";

type Overview = {
  region: string;
  totals: { total: number; d7: number; d30: number; actionable: number; geocoded: number; voice: number; spam: number };
  pctGeocoded: number;
  byChannel: { k: string; n: number }[];
  byLanguage: { k: string; n: number }[];
  byCategory: { k: string; n: number }[];
  byUrgency: { k: string; n: number }[];
  weekly: { week: string; category: string; n: number }[];
  hotspots: { hotspots: number; emerging: number; hot_cats: number };
  topRecommendations: { id: string; title: string; category: string; priority_score: number; rank: number; people_affected_est: number; request_count: number; status: string; funded_overlap: number }[];
  pipeline: { failed: number; processing: number; live: number; median_s: number | null };
  decisions: { status: string; n: number }[];
  population: { pop: number; cells: number };
};

export default function OverviewPage() {
  const { code, region } = useRegion();
  const { data, error, reload } = useApi<Overview>(`/overview?region=${code}`, [code]);
  const feed = useLiveFeed(code);
  const [cat, setCat] = useState<string>("all");
  useInterval(() => reload(), 20000);

  const trend = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    for (const w of data.weekly) if (cat === "all" || w.category === cat) m.set(w.week, (m.get(w.week) || 0) + w.n);
    return [...m.entries()].sort().map(([week, n]) => ({ week, n }));
  }, [data, cat]);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Spinner />;
  const t = data.totals;
  const accepted = data.decisions.find((d) => d.status === "accepted")?.n ?? 0;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{region.flag} {region.countryName} · pilot region</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{data.region} at a glance</h1>
          <p className="mt-1 text-sm text-mute">
            {fmtCompact(data.population.pop)} residents · {fmt(data.population.cells)} H3 cells · data is synthetic and illustrative
          </p>
        </div>
        <SimulateButton region={code} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Citizen requests" value={fmt(t.total)} sub={`${fmt(t.d7)} this week · ${fmt(t.d30)} in 30d`} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Voice share" value={`${t.total ? Math.round((t.voice / t.total) * 100) : 0}%`} sub="voice notes & IVR calls" icon={<Mic className="h-4 w-4" />} accent="#a78bfa" />
        <Kpi label="Languages" value={data.byLanguage.length} sub={data.byLanguage.map((l) => LANG_LABEL[l.k] ?? l.k).join(", ")} icon={<Languages className="h-4 w-4" />} accent="#34d399" />
        <Kpi label="Active hotspots" value={fmt(data.hotspots.hotspots)} sub={`cells across ${data.hotspots.hot_cats} categories (Gi*, p<0.05)`} icon={<Flame className="h-4 w-4" />} accent="#fb7185" />
        <Kpi label="Emerging" value={fmt(data.hotspots.emerging)} sub="cells with a sharp 30-day rise" icon={<Radar className="h-4 w-4" />} accent="#fbbf24" />
        <Kpi label="Geocoded" value={`${data.pctGeocoded}%`} sub={`${fmt(accepted)} recommendations accepted`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section
            title="Requests per week"
            right={
              <select className="input w-auto py-1 text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </select>
            }
          >
            <TrendArea data={trend} x="week" y="n" label={cat === "all" ? "Requests" : catLabel(cat)} xFormat={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title="What citizens need (last 30 days)">
              <BarList rows={data.byCategory.filter((c) => c.k !== "other").slice(0, 8).map((c) => ({ key: c.k, label: catLabel(c.k), value: c.n }))} />
            </Section>
            <Section title="How they reach us">
              <BarList rows={data.byChannel.map((c) => ({ key: c.k, label: c.k.toUpperCase(), value: c.n }))} color="#a78bfa" />
              <div className="mt-4 border-t border-line pt-3">
                <BarList rows={data.byLanguage.map((c) => ({ key: c.k, label: LANG_LABEL[c.k] ?? c.k, value: c.n }))} color="#34d399" />
              </div>
            </Section>
          </div>

          <Section title="Top priorities" right={<Link href="/app/recommendations" className="text-xs text-accent hover:underline">All recommendations →</Link>}>
            <div className="flex flex-col divide-y divide-line">
              {data.topRecommendations.map((r) => (
                <Link key={r.id} href={`/app/recommendations/${r.id}`} className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="w-5 font-mono text-sm text-faint">#{r.rank}</span>
                  <ScoreRing score={r.priority_score} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink group-hover:text-accent">{r.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute">
                      <CatBadge c={r.category} />
                      <span>{fmtCompact(r.people_affected_est)} people</span>
                      <span>· {fmt(r.request_count)} requests / 90d</span>
                      <span>· {Math.round(r.funded_overlap * 100)}% funded</span>
                    </div>
                  </div>
                  <StatusBadge s={r.status} />
                  <ArrowRight className="h-4 w-4 text-faint group-hover:text-accent" />
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Live citizen feed" right={<span className={cx("chip", feed.connected && "border-ok/40 text-ok")}>{feed.connected ? "● streaming" : "connecting"}</span>}>
            <div className="max-h-[520px] overflow-y-auto pr-1">
              <PulseFeed items={feed.items} steps={feed.steps} connected={feed.connected} />
            </div>
          </Section>
          <Section title="Pipeline health">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="card-2 p-3">
                <div className="kpi text-lg">{fmt(data.pipeline.live)}</div>
                <div className="text-[11px] text-mute">live intakes</div>
              </div>
              <div className="card-2 p-3">
                <div className="kpi text-lg">{data.pipeline.median_s ? `${data.pipeline.median_s.toFixed(1)}s` : "–"}</div>
                <div className="text-[11px] text-mute">median voice→structured</div>
              </div>
              <div className={cx("card-2 p-3", data.pipeline.failed > 0 && "border-bad/40")}>
                <div className={cx("kpi text-lg", data.pipeline.failed > 0 && "text-bad")}>{fmt(data.pipeline.failed)}</div>
                <div className="text-[11px] text-mute">failed</div>
              </div>
            </div>
            {data.pipeline.failed > 0 && (
              <Link href="/app/requests?pipeline=failed" className="mt-3 flex items-center gap-2 text-xs text-bad hover:underline">
                <AlertTriangle className="h-3.5 w-3.5" /> Review failed requests
              </Link>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
