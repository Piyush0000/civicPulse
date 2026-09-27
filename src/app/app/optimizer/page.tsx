"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calculator, Scale, Sparkles } from "lucide-react";
import { api, fmt, fmtCompact, fmtUsd, useRegion } from "@/lib/client/hooks";
import { SERIES } from "@/components/charts";
import { CatBadge, ErrorBox, Kpi, Section, Spinner } from "@/components/ui";

type Opt = {
  budgetUsd: number;
  equityShare: number;
  vulnerabilityThreshold: number;
  selected: { id: string; title: string; category: string; costUsd: number; people: number; score: number; meanVuln: number; fundedOverlap: number }[];
  spentUsd: number;
  people: number;
  vulnerableShare: number;
  candidates: number;
  comparison: {
    optimizer: { spendUsd: number; needWeightedPeople: number; perMillion: number };
    currentPlan: { spendUsd: number; needWeightedPeople: number; perMillion: number };
  };
};

export default function OptimizerPage() {
  const { code, region } = useRegion();
  const [budget, setBudget] = useState(15);
  const [equity, setEquity] = useState(40);
  const [data, setData] = useState<Opt | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setData(await api<Opt>(`/optimizer?region=${code}`, { method: "POST", json: { budgetUsd: budget * 1e6, equityShare: equity / 100 } }));
        setErr(null);
      } catch (e) {
        setErr((e as Error).message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [budget, equity, code]);

  const c = data?.comparison;
  const mult = c && c.currentPlan.perMillion > 0 ? c.optimizer.perMillion / c.currentPlan.perMillion : null;
  const max = c ? Math.max(c.optimizer.perMillion, c.currentPlan.perMillion, 1) : 1;

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Calculator className="h-6 w-6 text-accent" /> Budget optimizer</h1>
        <p className="text-sm text-mute">
          Given a budget for {region.name}, choose the portfolio of recommended projects that reaches the most people in need, with an equity floor reserved for the most deprived areas.
        </p>
      </div>
      <div className="card grid gap-6 p-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="budget">Budget: <span className="font-mono text-ink">${budget}M</span></label>
          <input id="budget" type="range" min={1} max={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </div>
        <div>
          <label className="label" htmlFor="equity">Equity floor: <span className="font-mono text-ink">{equity}%</span> of spend to the most vulnerable quartile</label>
          <input id="equity" type="range" min={0} max={100} step={5} value={equity} onChange={(e) => setEquity(Number(e.target.value))} className="w-full accent-[var(--accent-2)]" />
        </div>
      </div>
      {err && <ErrorBox msg={err} />}
      {!data && !err && <Spinner />}
      {data && c && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Projects funded" value={`${data.selected.length} / ${data.candidates}`} />
            <Kpi label="Spend" value={fmtUsd(data.spentUsd)} sub={`of ${fmtUsd(data.budgetUsd)}`} />
            <Kpi label="People reached" value={fmtCompact(data.people)} accent="#34d399" />
            <Kpi label="To vulnerable areas" value={`${Math.round(data.vulnerableShare * 100)}%`} sub={`vulnerability ≥ ${data.vulnerabilityThreshold}`} accent="#a78bfa" />
          </div>
          <Section title={<span className="flex items-center gap-2"><Scale className="h-4 w-4" /> Need-weighted people reached per US$1M</span>}>
            <div className="flex flex-col gap-3">
              {[
                { k: "CivicPulse portfolio", v: c.optimizer.perMillion, sub: `${fmtUsd(c.optimizer.spendUsd)} spent`, color: SERIES[0] },
                { k: "Current government plan", v: c.currentPlan.perMillion, sub: `${fmtUsd(c.currentPlan.spendUsd)} planned`, color: SERIES[1] },
              ].map((r) => (
                <div key={r.k} className="grid grid-cols-[12rem_1fr_6rem] items-center gap-3 text-sm">
                  <div>
                    <div className="text-ink">{r.k}</div>
                    <div className="text-[11px] text-faint">{r.sub}</div>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-panel-3">
                    <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1, (r.v / max) * 100)}%`, background: r.color }} />
                  </div>
                  <span className="text-right font-mono text-ink">{fmt(r.v)}</span>
                </div>
              ))}
            </div>
            {mult && mult > 1 && (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
                <Sparkles className="h-4 w-4 shrink-0" /> Each dollar in the demand-driven portfolio reaches about {mult.toFixed(1)}× more people in need than the current plan.
              </p>
            )}
            <p className="mt-2 text-[11px] text-faint">Need-weighted people = residents of each project&apos;s cells × citizen-demand percentile for that category. Costs are indicative unit costs; illustrative data.</p>
          </Section>
          <Section title="Selected portfolio">
            <div className="flex flex-col divide-y divide-line">
              {data.selected.map((s) => (
                <Link key={s.id} href={`/app/recommendations/${s.id}`} className="flex flex-wrap items-center gap-3 py-2.5 text-sm hover:text-accent">
                  <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
                  <CatBadge c={s.category} />
                  <span className="w-24 text-right font-mono text-xs text-mute">{fmtCompact(s.people)} ppl</span>
                  <span className="w-20 text-right font-mono text-xs text-mute">{fmtUsd(s.costUsd)}</span>
                  <span className="w-16 text-right font-mono text-xs text-mute">vuln {s.meanVuln.toFixed(2)}</span>
                </Link>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
