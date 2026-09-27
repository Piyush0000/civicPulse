"use client";

import { TrendingDown } from "lucide-react";
import { fmt, fmtCompact, useApi, useRegion } from "@/lib/client/hooks";
import { BarList, TwoLines } from "@/components/charts";
import { CatBadge, ErrorBox, Kpi, LANG_LABEL, Section, Spinner, cx } from "@/components/ui";

type P = {
  id: string; title: string; category: string; completed_date: string; budget_amount: number; currency: string; admin_name: string; cells: number;
  impact: {
    before: number; after: number; pctChange: number | null; controlBefore: number; controlAfter: number; controlPctChange: number | null; did: number | null;
    footprintPopulation: number; controlCells: number; afterDays: number; series: { month: number; project: number; control: number }[];
  };
};
type M = { channels: { k: string; n: number }[]; languages: { k: string; n: number }[]; voice: number; total: number; geocoded: number; actionable: number; accepted: number; decided: number; median_s: number | null; reporters: number };

export default function ImpactPage() {
  const { code, region } = useRegion();
  const p = useApi<P[]>(`/impact/projects?region=${code}`, [code]);
  const m = useApi<M>(`/impact/platform-metrics?region=${code}`, [code]);
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><TrendingDown className="h-6 w-6 text-ok" /> Impact</h1>
        <p className="text-sm text-mute">
          {region.name}: did completed projects reduce complaints? Requests per 1,000 residents, 90 days before vs after completion (14-day buffer), compared with the 20 most similar non-project cells. Indicative, not causal proof.
        </p>
      </div>
      {p.error && <ErrorBox msg={p.error} />}
      {!p.data && <Spinner />}
      <div className="grid gap-4 lg:grid-cols-2">
        {p.data?.map((x) => {
          const i = x.impact;
          return (
            <div key={x.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-ink">{x.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute">
                    <CatBadge c={x.category} /> completed {new Date(x.completed_date).toLocaleDateString()} · {fmtCompact(i.footprintPopulation)} residents
                  </div>
                </div>
                <div className="text-right">
                  <div className={cx("font-mono text-2xl font-semibold", (i.pctChange ?? 0) < 0 ? "text-ok" : "text-warn")}>
                    {i.pctChange === null ? "–" : `${i.pctChange > 0 ? "+" : ""}${i.pctChange}%`}
                  </div>
                  <div className="text-[11px] text-faint">control {i.controlPctChange === null ? "–" : `${i.controlPctChange > 0 ? "+" : ""}${i.controlPctChange}%`}</div>
                </div>
              </div>
              <div className="mt-3">
                <TwoLines
                  data={i.series}
                  x="month"
                  a={{ key: "project", label: "Project footprint" }}
                  b={{ key: "control", label: "Similar control cells" }}
                  xLabel={(v) => (Number(v) === 0 ? "done" : `${Number(v) > 0 ? "+" : ""}${v}m`)}
                  refX={0}
                  height={160}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="card-2 p-2"><div className="font-mono text-ink">{i.before}</div><div className="text-faint">before /1k/30d</div></div>
                <div className="card-2 p-2"><div className="font-mono text-ink">{i.after}</div><div className="text-faint">after /1k/30d</div></div>
                <div className="card-2 p-2"><div className={cx("font-mono", (i.did ?? 0) < 0 ? "text-ok" : "text-ink")}>{i.did === null ? "–" : `${i.did} pts`}</div><div className="text-faint">diff-in-diff</div></div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-4 text-lg font-semibold">Platform health as Digital Public Infrastructure</h2>
      {m.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Unique citizens" value={fmt(m.data.reporters)} />
            <Kpi label="Voice share" value={`${m.data.total ? Math.round((m.data.voice / m.data.total) * 100) : 0}%`} />
            <Kpi label="Geocoded" value={`${m.data.actionable ? Math.round((m.data.geocoded / m.data.actionable) * 100) : 0}%`} />
            <Kpi label="Recs decided" value={fmt(m.data.decided)} sub={`${fmt(m.data.accepted)} accepted`} />
            <Kpi label="Median time to structure" value={m.data.median_s ? `${m.data.median_s.toFixed(1)}s` : "–"} sub="live intakes" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Requests by channel"><BarList rows={m.data.channels.map((c) => ({ key: c.k, label: c.k.toUpperCase(), value: c.n }))} color="#a78bfa" /></Section>
            <Section title="Requests by language"><BarList rows={m.data.languages.map((c) => ({ key: c.k, label: LANG_LABEL[c.k] ?? c.k, value: c.n }))} color="#34d399" /></Section>
          </div>
        </>
      )}
    </div>
  );
}
