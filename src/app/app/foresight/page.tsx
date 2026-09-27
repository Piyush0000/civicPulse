"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Radar, TrendingDown, TrendingUp } from "lucide-react";
import { catLabel } from "@/lib/categories";
import { useApi, useRegion } from "@/lib/client/hooks";
import { SERIES } from "@/components/charts";
import { CatBadge, Empty, ErrorBox, Section, Spinner, cx } from "@/components/ui";

type F = {
  months: string[];
  future: string[];
  series: { category: string; history: number[]; forecast: number[]; changePct: number }[];
  emerging: { category: string; area: string; cells: number; requests: number; maxTrend: number }[];
};

export default function ForesightPage() {
  const { code, region } = useRegion();
  const f = useApi<F>(`/forecast?region=${code}`, [code]);
  const [cat, setCat] = useState<string | null>(null);
  const sorted = useMemo(() => [...(f.data?.series ?? [])].sort((a, b) => b.changePct - a.changePct), [f.data]);
  const active = cat ?? sorted[0]?.category;
  const s = f.data?.series.find((x) => x.category === active);
  const chart = useMemo(
    () =>
      f.data && s
        ? [
            ...f.data.months.map((m, i) => ({ m, actual: s.history[i], forecast: null as number | null })),
            ...f.data.future.map((m, i) => ({ m, actual: null as number | null, forecast: s.forecast[i] })),
          ]
        : [],
    [f.data, s],
  );

  if (f.error) return <ErrorBox msg={f.error} />;
  if (!f.data) return <Spinner />;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Radar className="h-6 w-6 text-warn" /> Foresight</h1>
        <p className="text-sm text-mute">
          {region.name}: act before problems peak. Emerging hotspots use a Poisson test on the last 30 days vs the prior 60; forecasts blend seasonal-naive with the recent level.
        </p>
      </div>
      <Section title="Emerging hotspots right now">
        {f.data.emerging.length === 0 ? (
          <Empty>No statistically emerging clusters in the last 30 days.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {f.data.emerging.map((e) => (
              <div key={`${e.category}${e.area}`} className="card-2 border-l-4 border-l-warn p-4">
                <div className="flex items-center justify-between">
                  <CatBadge c={e.category} />
                  <span className="font-mono text-lg text-warn">{e.maxTrend.toFixed(1)}×</span>
                </div>
                <div className="mt-2 text-lg font-medium text-ink">{e.area}</div>
                <div className="text-xs text-mute">{e.requests} requests in 90 days across {e.cells} cells; the rate of the last 30 days is up to {e.maxTrend.toFixed(1)}× the expected level.</div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <Section title="Next 3 months vs last 3">
          <div className="flex flex-col gap-1">
            {sorted.map((x) => (
              <button
                key={x.category}
                onClick={() => setCat(x.category)}
                className={cx("flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm", active === x.category ? "bg-panel-3" : "hover:bg-panel-2")}
              >
                <span className="text-mute">{catLabel(x.category)}</span>
                <span className={cx("flex items-center gap-1 font-mono text-xs", x.changePct >= 15 ? "text-warn" : x.changePct <= -15 ? "text-ok" : "text-mute")}>
                  {x.changePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {x.changePct > 0 ? "+" : ""}
                  {x.changePct}%
                </span>
              </button>
            ))}
          </div>
        </Section>
        <Section title={`${catLabel(active ?? "")}: monthly requests and forecast`}>
          <div className="mb-2 flex gap-4 text-[11px] text-mute">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} />actual</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed" style={{ borderColor: SERIES[3], background: `${SERIES[3]}55` }} />forecast</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={4}>
              <CartesianGrid stroke="#1d2a42" vertical={false} />
              <XAxis dataKey="m" stroke="#5d6e8e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v + "-01").toLocaleDateString("en", { month: "short" })} />
              <YAxis stroke="#5d6e8e" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "#ffffff08" }}
                content={({ active: a, payload, label }) =>
                  a && payload?.length ? (
                    <div className="rounded-lg border border-line-2 bg-panel/95 px-3 py-2 text-xs">
                      <div className="text-ink">{new Date(label + "-01").toLocaleDateString("en", { month: "long", year: "numeric" })}</div>
                      {payload.filter((p) => p.value != null).map((p) => <div key={String(p.dataKey)} className="text-mute">{String(p.dataKey)}: <span className="font-mono text-ink">{String(p.value)}</span></div>)}
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="actual" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="forecast" fill={`${SERIES[3]}66`} stroke={SERIES[3]} strokeDasharray="4 3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </div>
  );
}
