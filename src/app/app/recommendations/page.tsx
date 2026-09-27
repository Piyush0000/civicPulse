"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Flame, Users } from "lucide-react";
import { CATEGORIES, catLabel } from "@/lib/categories";
import { fmt, fmtCompact, fmtUsd, useApi, useRegion } from "@/lib/client/hooks";
import { CatBadge, Empty, ErrorBox, Meter, ScoreRing, Spinner, StatusBadge } from "@/components/ui";

type Rec = {
  id: string; title: string; category: string; admin_names: string[]; priority_score: number; rank: number; people_affected_est: number;
  request_count: number; unique_reporters: number; hotspot_cells: number; funded_overlap: number; est_cost_usd: number; status: string;
  cells: number; briefs: number; is_active: boolean;
};

export default function RecommendationsPage() {
  const { code, region } = useRegion();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const list = useApi<Rec[]>(`/recommendations?region=${code}${category ? `&category=${category}` : ""}${status ? `&status=${status}` : ""}`, [code, category, status]);

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recommended projects</h1>
          <p className="text-sm text-mute">
            {region.name} · hotspots and high-priority cells merged into project areas and ranked by population-weighted priority.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto py-1.5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <select className="input w-auto py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            {["proposed", "accepted", "deferred", "rejected"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <a className="btn-ghost text-xs" href={`/api/v1/export/recommendations.csv?region=${code}`}>
            <Download className="h-4 w-4" /> CSV
          </a>
        </div>
      </div>
      {list.error && <ErrorBox msg={list.error} />}
      {!list.data && <Spinner />}
      {list.data?.length === 0 && <Empty>No recommendations for this filter.</Empty>}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.data?.map((r) => (
          <Link key={r.id} href={`/app/recommendations/${r.id}`} className="card group flex gap-4 p-4 transition-colors hover:border-accent/40">
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs text-faint">#{r.rank}</span>
              <ScoreRing score={r.priority_score} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-snug text-ink group-hover:text-accent">{r.title}</h3>
                <StatusBadge s={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute">
                <CatBadge c={r.category} />
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {fmtCompact(r.people_affected_est)}</span>
                <span>{fmt(r.request_count)} requests · {fmt(r.unique_reporters)} people reporting</span>
                {r.hotspot_cells > 0 && <span className="flex items-center gap-1 text-bad"><Flame className="h-3.5 w-3.5" /> {r.hotspot_cells} hotspot cells</span>}
              </div>
              <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[11px] text-mute">
                <span>Already funded</span>
                <Meter v={r.funded_overlap} color="var(--accent-2)" />
                <span className="font-mono text-ink">{Math.round(r.funded_overlap * 100)}%</span>
              </div>
              <div className="mt-2 text-[11px] text-faint">Indicative cost {fmtUsd(r.est_cost_usd)} · {r.cells} grid cells{r.briefs ? " · brief ready" : ""}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
