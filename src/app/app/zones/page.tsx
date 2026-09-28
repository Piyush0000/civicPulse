"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { catLabel } from "@/lib/categories";
import { fmt, fmtCompact, useApi, useRegion } from "@/lib/client/hooks";
import type { HexDatum } from "@/components/HexMap";
import { RAMP_CSS } from "@/components/HexMap";
import { ErrorBox, Meter, Section, Spinner, cx } from "@/components/ui";

const HexMap = dynamic(() => import("@/components/HexMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

type Zone = {
  rank: number; zone: string; population: number; complaints90d: number; per10k: number; criticalShare: number; openComplaints: number;
  resolvedShare: number; hotspotCells: number; cells: number; vulnerability: number; topCategories: { category: string; n: number }[];
  satisfaction: number | null; feedbackCount: number; needScore: number; serviceStars: number; priorityZone: boolean;
};

export default function ZonesPage() {
  const { code, region } = useRegion();
  const zones = useApi<Zone[]>(`/zones?region=${code}`, [code]);
  const cells = useApi<HexDatum[]>(`/map/cells?region=${code}&metric=zone`, [code]);
  const [sort, setSort] = useState<"need" | "complaints" | "per10k" | "service">("need");
  const [focus, setFocus] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const z = [...(zones.data ?? [])];
    if (sort === "complaints") z.sort((a, b) => b.complaints90d - a.complaints90d);
    if (sort === "per10k") z.sort((a, b) => b.per10k - a.per10k);
    if (sort === "service") z.sort((a, b) => a.serviceStars - b.serviceStars);
    return z;
  }, [zones.data, sort]);
  const priority = zones.data?.filter((z) => z.priorityZone) ?? [];
  const center = useMemo(() => region.center, [region]);

  if (zones.error) return <ErrorBox msg={zones.error} />;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Trophy className="h-6 w-6 text-warn" /> Zone ratings</h1>
        <p className="text-sm text-mute">
          {region.name}: every ward/neighbourhood rated on citizen complaints. <b className="text-ink">Need score</b> = complaints per resident (35%) + critical share (20%) +
          hotspot coverage (25%) + unresolved backlog (20%). <b className="text-ink">Service stars</b> = resolution rate and verified citizen satisfaction.
        </p>
      </div>

      {priority.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3 border-bad/40 p-4">
          <Flame className="h-5 w-5 text-bad" />
          <span className="font-medium text-ink">High-priority zones for immediate attention:</span>
          {priority.map((z) => (
            <button key={z.zone} onClick={() => setFocus(z.zone)} className="chip border-bad/40 text-bad hover:bg-bad/10">#{z.rank} {z.zone} · {z.needScore}</button>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="card relative h-[560px] overflow-hidden">
          {cells.data && (
            <HexMap
              center={center}
              zoom={code === "IN-DL" ? 10.2 : 10.8}
              cells={cells.data}
              highlight={focus ? new Set(cells.data.filter((c) => c.z === focus).map((c) => c.h)) : null}
              normalize="fixed100"
              extruded
            />
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 card w-60 bg-panel/90 p-3 text-[11px] text-mute">
            <div className="mb-1 font-medium text-ink">Zone need score</div>
            <div className="h-2 rounded-full" style={{ background: RAMP_CSS }} />
            <div className="mt-1 flex justify-between"><span>0</span><span>100</span></div>
            <div className="mt-2 flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#ff5a78]" /> priority zone</div>
          </div>
        </div>

        <Section
          title="Leaderboard"
          right={
            <select className="input w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
              <option value="need">Highest need</option>
              <option value="complaints">Most complaints</option>
              <option value="per10k">Complaints per 10k</option>
              <option value="service">Worst served</option>
            </select>
          }
        >
          {!zones.data && <Spinner />}
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-panel text-left text-[11px] uppercase tracking-wider text-faint">
                <tr><th className="py-2">#</th><th>Zone</th><th>Need</th><th className="text-right">90d</th><th className="text-right">/10k</th><th className="text-right">Open</th><th>Top issues</th><th className="text-right">Service</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted.map((z) => (
                  <tr key={z.zone} onClick={() => setFocus(focus === z.zone ? null : z.zone)} className={cx("cursor-pointer hover:bg-panel-2", focus === z.zone && "bg-panel-2")}>
                    <td className="py-2 font-mono text-xs text-faint">{z.rank}</td>
                    <td className="py-2">
                      <div className="text-ink">{z.zone} {z.priorityZone && <span className="chip ml-1 border-bad/40 text-bad">priority</span>}</div>
                      <div className="text-[11px] text-faint">{fmtCompact(z.population)} residents · vulnerability {z.vulnerability}</div>
                    </td>
                    <td className="w-28 py-2 pr-3">
                      <div className="flex items-center gap-2"><Meter v={z.needScore / 100} color={z.priorityZone ? "var(--bad)" : "var(--accent)"} /><span className="w-7 font-mono text-xs text-ink">{z.needScore}</span></div>
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-ink">{fmt(z.complaints90d)}</td>
                    <td className="py-2 text-right font-mono text-xs text-ink">{z.per10k}</td>
                    <td className="py-2 text-right font-mono text-xs text-mute">{fmt(z.openComplaints)}</td>
                    <td className="py-2 pl-3 text-[11px] text-mute">{z.topCategories.slice(0, 2).map((c) => catLabel(c.category)).join(", ")}</td>
                    <td className="py-2 text-right text-warn" title={`resolved ${Math.round(z.resolvedShare * 100)}%${z.satisfaction !== null ? `, satisfaction ${Math.round(z.satisfaction * 100)}% (${z.feedbackCount})` : ""}`}>
                      {"★".repeat(Math.floor(z.serviceStars))}{z.serviceStars % 1 ? "½" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
