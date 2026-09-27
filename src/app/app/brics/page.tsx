"use client";

import { Globe2, ShieldCheck } from "lucide-react";
import { catLabel } from "@/lib/categories";
import { fmt, fmtCompact, fmtUsd, useApi } from "@/lib/client/hooks";
import { LANG_LABEL, Meter, Section, Spinner, catColor } from "@/components/ui";

type Agg = {
  region: { code: string; name: string; country: string; flag: string };
  population: number;
  categories: { category: string; requests: number; reporters: number; hotspots: number; per100k: number; demandShare: number; investmentShare: number }[];
  budgetUsd: number;
  misalignment: number;
  decisions: Record<string, number>;
  languages: Record<string, number>;
  impact: { category: string; pctChange: number; did: number | null }[];
  signature: { alg: string; value: string };
  kAnonymity: number;
};

export default function BricsPage() {
  const d = useApi<Agg[]>("/brics/compare");
  if (!d.data) return <Spinner label="Collecting signed aggregates from each national instance…" />;
  const cats = [...new Set(d.data.flatMap((a) => a.categories.map((c) => c.category)))].filter((c) => c !== "other");
  const maxPer = Math.max(1, ...d.data.flatMap((a) => a.categories.map((c) => c.per100k)));

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Globe2 className="h-6 w-6 text-accent" /> BRICS federation</h1>
        <p className="max-w-3xl text-sm text-mute">
          Each country runs its own CivicPulse instance (data sovereignty). Instances share only <b className="text-ink">k-anonymous, HMAC-signed aggregates</b> (k = {d.data[0]?.kAnonymity}). Raw requests never leave the country. This lets BRICS partners compare needs, budget alignment and what works.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {d.data.map((a) => {
          const top = [...a.categories].sort((x, y) => y.requests - x.requests)[0];
          const avgImpact = a.impact.length ? a.impact.reduce((s, x) => s + x.pctChange, 0) / a.impact.length : null;
          return (
            <div key={a.region.code} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{a.region.flag} {a.region.name}</div>
                  <div className="text-xs text-mute">{fmtCompact(a.population)} residents · {Object.keys(a.languages).map((l) => LANG_LABEL[l] ?? l).join(", ")}</div>
                </div>
              </div>
              <div className="text-xs text-mute">Top need</div>
              <div className="-mt-2 text-sm font-medium" style={{ color: catColor(top?.category) }}>{top ? catLabel(top.category) : "–"}</div>
              <div>
                <div className="flex justify-between text-xs text-mute"><span>Budget misalignment</span><span className="font-mono text-ink">{a.misalignment.toFixed(2)}</span></div>
                <Meter v={a.misalignment} color="#e66767" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="card-2 p-2"><div className="font-mono text-ink">{fmtUsd(a.budgetUsd)}</div><div className="text-faint">planned capex</div></div>
                <div className="card-2 p-2"><div className="font-mono text-ink">{avgImpact === null ? "–" : `${avgImpact.toFixed(0)}%`}</div><div className="text-faint">avg impact</div></div>
              </div>
              <div className="mt-auto flex items-center gap-1.5 font-mono text-[10px] text-faint" title={a.signature.value}>
                <ShieldCheck className="h-3 w-3 text-ok" /> {a.signature.alg} {a.signature.value.slice(0, 14)}…
              </div>
            </div>
          );
        })}
      </div>

      <Section title="Citizen demand per 100k residents (last 90 days)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-xs">
            <thead>
              <tr className="text-left text-faint">
                <th className="py-2 font-medium">Category</th>
                {d.data.map((a) => <th key={a.region.code} className="px-2 py-2 font-medium">{a.region.flag} {a.region.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cats.map((c) => (
                <tr key={c}>
                  <td className="py-2 pr-3 text-mute">{catLabel(c)}</td>
                  {d.data!.map((a) => {
                    const v = a.categories.find((x) => x.category === c);
                    return (
                      <td key={a.region.code} className="px-2 py-2">
                        {v ? (
                          <div className="flex items-center gap-2" title={`${v.requests} requests, ${v.reporters} reporters, ${v.hotspots} hotspot cells`}>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-3"><div className="h-full rounded-r-[4px] bg-accent" style={{ width: `${(v.per100k / maxPer) * 100}%` }} /></div>
                            <span className="w-10 text-right font-mono text-ink">{fmt(v.per100k, 1)}</span>
                          </div>
                        ) : (
                          <span className="text-faint" title="suppressed: fewer than k reporters">k-suppressed</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <p className="text-xs text-faint">
        Payload schema <span className="font-mono">civicpulse.federation.v1</span>, public at <span className="font-mono">/api/v1/federation/aggregate/&lt;region&gt;</span>. Production instances would sign with per-country Ed25519 keys.
      </p>
    </div>
  );
}
