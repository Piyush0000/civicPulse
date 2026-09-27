"use client";

import { useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { catLabel } from "@/lib/categories";
import { fmtCompact, fmtUsd, useApi, useRegion } from "@/lib/client/hooks";
import { DIVERGE, DivergingBars, SERIES } from "@/components/charts";
import { CatBadge, ErrorBox, Section, Spinner, cx } from "@/components/ui";

type Budget = {
  currency: string;
  usdRate: number;
  totalBudget: number;
  byCategory: { category: string; demandShare: number; investmentShare: number; gap: number; budget: number; budgetUsd: number; projects: number }[];
  byArea: { area: string; demandShare: number; investmentShare: number; population: number; budget: number }[];
};

export default function BudgetPage() {
  const { code, region } = useRegion();
  const b = useApi<Budget>(`/budget/alignment?region=${code}`, [code]);
  const [view, setView] = useState<"chart" | "table">("chart");
  if (b.error) return <ErrorBox msg={b.error} />;
  if (!b.data) return <Spinner />;
  const rows = [...b.data.byCategory].sort((x, y) => y.gap - x.gap);
  const under = rows[0];
  const over = rows[rows.length - 1];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget alignment</h1>
        <p className="text-sm text-mute">
          {region.name}: where planned public investment ({b.data.currency} {fmtCompact(b.data.totalBudget)} ≈ {fmtUsd(b.data.totalBudget * b.data.usdRate)}) does and does not follow citizen demand.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card border-l-4 p-4" style={{ borderLeftColor: DIVERGE.pos }}>
          <div className="text-xs uppercase tracking-wider text-mute">Most under-funded vs demand</div>
          <div className="mt-1 text-xl font-semibold">{catLabel(under.category)}</div>
          <div className="text-sm text-mute">{(under.demandShare * 100).toFixed(1)}% of citizen demand · only {(under.investmentShare * 100).toFixed(1)}% of planned spend</div>
        </div>
        <div className="card border-l-4 p-4" style={{ borderLeftColor: DIVERGE.neg }}>
          <div className="text-xs uppercase tracking-wider text-mute">Most over-funded vs demand</div>
          <div className="mt-1 text-xl font-semibold">{catLabel(over.category)}</div>
          <div className="text-sm text-mute">{(over.investmentShare * 100).toFixed(1)}% of planned spend · {(over.demandShare * 100).toFixed(1)}% of citizen demand</div>
        </div>
      </div>

      <Section
        title="Demand share − investment share (percentage points)"
        right={
          <div className="flex rounded-lg border border-line-2 p-0.5 text-xs">
            {(["chart", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cx("rounded-md px-2.5 py-1 capitalize", view === v ? "bg-panel-3 text-ink" : "text-mute")}>{v}</button>
            ))}
          </div>
        }
      >
        <div className="mb-3 flex gap-4 text-[11px] text-mute">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: DIVERGE.pos }} /> under-funded (demand &gt; spend)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: DIVERGE.neg }} /> over-funded (spend &gt; demand)</span>
        </div>
        {view === "chart" ? (
          <DivergingBars
            rows={rows.map((r) => ({
              key: r.category,
              label: catLabel(r.category),
              value: r.gap,
              hint: `${catLabel(r.category)}: demand ${(r.demandShare * 100).toFixed(1)}%, investment ${(r.investmentShare * 100).toFixed(1)}%, ${r.projects} projects`,
            }))}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
                <tr><th className="py-2">Category</th><th>Demand share</th><th>Investment share</th><th>Gap (pts)</th><th>Planned budget</th><th>Projects</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.category}>
                    <td className="py-2"><CatBadge c={r.category} /></td>
                    <td className="font-mono">{(r.demandShare * 100).toFixed(1)}%</td>
                    <td className="font-mono">{(r.investmentShare * 100).toFixed(1)}%</td>
                    <td className="font-mono">{r.gap > 0 ? "+" : ""}{(r.gap * 100).toFixed(1)}</td>
                    <td className="font-mono">{b.data!.currency} {fmtCompact(r.budget)}</td>
                    <td className="font-mono">{r.projects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Neighbourhoods: demand share vs investment share (bubble = population)">
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="#1d2a42" />
            <XAxis type="number" dataKey="demandShare" name="Demand share" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke="#5d6e8e" fontSize={11} label={{ value: "share of citizen demand →", position: "insideBottom", offset: -10, fill: "#93a3c0", fontSize: 11 }} />
            <YAxis type="number" dataKey="investmentShare" name="Investment share" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke="#5d6e8e" fontSize={11} />
            <ZAxis type="number" dataKey="population" range={[40, 600]} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 0.3, y: 0.3 }]} stroke="#5d6e8e" strokeDasharray="4 4" label={{ value: "fair share", fill: "#93a3c0", fontSize: 10, position: "insideTopLeft" }} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Budget["byArea"][number] | undefined;
                return active && p ? (
                  <div className="rounded-lg border border-line-2 bg-panel/95 px-3 py-2 text-xs">
                    <div className="font-medium text-ink">{p.area}</div>
                    <div className="text-mute">demand {(p.demandShare * 100).toFixed(1)}% · investment {(p.investmentShare * 100).toFixed(1)}%</div>
                    <div className="text-mute">{fmtCompact(p.population)} residents</div>
                  </div>
                ) : null;
              }}
            />
            <Scatter data={b.data.byArea} fill={SERIES[0]} fillOpacity={0.7} stroke="#0c1320" strokeWidth={2} />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="text-xs text-mute">Areas below the dashed line receive less investment than their share of citizen demand.</p>
      </Section>
    </div>
  );
}
