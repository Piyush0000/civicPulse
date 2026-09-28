"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Box, Building2, Flame, Layers, Radar, X } from "lucide-react";
import { CATEGORIES, catLabel } from "@/lib/categories";
import { fmt, fmtCompact, timeAgo, useApi, useRegion, type PulseEvt } from "@/lib/client/hooks";
import type { HexDatum, Ping } from "@/components/HexMap";
import { RAMP_CSS } from "@/components/HexMap";
import { PulseFeed, SimulateButton, useLiveFeed } from "@/components/PulseFeed";
import { CatBadge, LANG_LABEL, Meter, Spinner, StatusBadge, UrgencyBadge, catColor, cx } from "@/components/ui";

const HexMap = dynamic(() => import("@/components/HexMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

const METRICS = [
  { k: "priority", label: "Priority score" },
  { k: "demand", label: "Citizen demand" },
  { k: "gap", label: "Infrastructure gap" },
  { k: "gi", label: "Hotspot z-score" },
  { k: "population", label: "Population" },
  { k: "vulnerability", label: "Vulnerability" },
];

type Layers = {
  facilities: { category: string; type: string; name: string; lat: number; lng: number }[];
  projects: { id: string; title: string; category: string; status: string; h3_cells: string[] }[];
  recommendations: { id: string; title: string; category: string; rank: number; h3_cells: string[] }[];
};

type CellDetail = {
  cell: { h3_cell: string; population: number; admin_name: string; vulnerability_index: number; connectivity_index: number };
  scores: { category: string; priority_score: number; d_norm: number; g_norm: number; p_norm: number; v_norm: number; f_coverage: number; gi_z: number | null; gi_p: number | null; is_hotspot: boolean; request_count_90d: number; unique_reporters_90d: number; is_emerging: boolean; no_signal: boolean }[];
  indicators: { category: string; key: string; value: number; source: string; is_proxy: boolean }[];
  recent: { id: string; tracking_code: string; language_detected: string; category: string; urgency: string; summary: string; text_original_redacted: string; text_english_redacted: string; submitted_at: string }[];
  recommendations: { id: string; title: string; rank: number; status: string }[];
  projects: { id: string; title: string; status: string; category: string }[];
  weights: { wD: number; wG: number; wP: number; wV: number; alpha: number };
};

export default function MapPage() {
  const { code, region } = useRegion();
  const [category, setCategory] = useState("all");
  const [metric, setMetric] = useState("priority");
  const [extruded, setExtruded] = useState(true);
  const [hotOnly, setHotOnly] = useState(false);
  const [showFac, setShowFac] = useState(false);
  const [showProj, setShowProj] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<HexDatum | null>(null);
  const [pings, setPings] = useState<Ping[]>([]);

  const cells = useApi<HexDatum[]>(`/map/cells?region=${code}&category=${category}&metric=${metric}`, [code, category, metric]);
  const layers = useApi<Layers>(`/map/layers?region=${code}`, [code]);
  const detail = useApi<CellDetail>(selected ? `/map/cells/${selected}?region=${code}` : null, [selected, code]);

  const feed = useLiveFeed(code, 20);
  // Pings: listen to the same stream the feed uses (feed.items changes on each request event)
  const lastItem = feed.items[0];
  const [seen, setSeen] = useState<string | null>(null);
  if (lastItem && lastItem.id !== seen && lastItem.lat != null && lastItem.lng != null) {
    setSeen(lastItem.id!);
    setPings((p) => [...p.filter((x) => Date.now() - x.born < 6000), { id: lastItem.id!, lat: lastItem.lat!, lng: lastItem.lng!, color: catColor(lastItem.category), born: Date.now() }]);
  }
  const reloadCells = cells.reload;
  const onScores = useCallback(() => reloadCells(), [reloadCells]);
  void onScores;

  const shown = useMemo(() => (cells.data ?? []).filter((c) => !hotOnly || c.hs || c.em), [cells.data, hotOnly]);
  const outlines = useMemo(() => {
    const out: { cells: string[]; color: string }[] = [];
    if (showProj && layers.data)
      for (const p of layers.data.projects.filter((p) => ["planned", "approved", "in_progress"].includes(p.status) && (category === "all" || p.category === category)))
        out.push({ cells: p.h3_cells, color: "#a78bfa" });
    return out;
  }, [layers.data, showProj, category]);
  const points = useMemo(
    () => (showFac && layers.data ? layers.data.facilities.filter((f) => category === "all" || f.category === category).map((f) => ({ lat: f.lat, lng: f.lng, color: catColor(f.category), label: f.name })) : []),
    [showFac, layers.data, category],
  );

  const center = useMemo(() => region.center, [region]);
  const metricLabel = METRICS.find((m) => m.k === metric)?.label;

  return (
    <div className="relative -m-4 h-[calc(100vh-57px)] overflow-hidden md:-m-6">
      <HexMap
        center={center}
        zoom={code === "BR-PE-REC" || code === "RU-TA-KZN" ? 11.2 : 10.4}
        cells={shown}
        normalize={metric === "priority" ? "fixed100" : "quantile"}
        extruded={extruded}
        selected={selected}
        outlines={outlines}
        points={points}
        pings={pings}
        onSelect={setSelected}
        onHover={setHover}
      />

      {/* controls */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2">
        <div className="pointer-events-auto card flex flex-wrap items-center gap-2 bg-panel/90 p-2 backdrop-blur">
          <select className="input w-auto py-1.5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{catLabel(c)}</option>
            ))}
          </select>
          <select className="input w-auto py-1.5 text-xs" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">
            {METRICS.map((m) => (
              <option key={m.k} value={m.k}>{m.label}</option>
            ))}
          </select>
          <Toggle on={extruded} set={setExtruded} icon={<Box className="h-3.5 w-3.5" />} label="3D" />
          <Toggle on={hotOnly} set={setHotOnly} icon={<Flame className="h-3.5 w-3.5" />} label="Hotspots" />
          <Toggle on={showProj} set={setShowProj} icon={<Layers className="h-3.5 w-3.5" />} label="Planned projects" />
          <Toggle on={showFac} set={setShowFac} icon={<Building2 className="h-3.5 w-3.5" />} label="Facilities" />
        </div>
        <div className="pointer-events-auto ml-auto">
          <SimulateButton region={code} compact />
        </div>
      </div>

      {/* legend + hover */}
      <div className="pointer-events-none absolute bottom-4 left-3 flex flex-col gap-2">
        {hover && (
          <div className="card bg-panel/90 px-3 py-2 text-xs backdrop-blur">
            <div className="font-mono text-faint">{hover.h}</div>
            <div className="text-ink">
              {metricLabel}: <span className="font-mono">{fmt(hover.v, metric === "population" ? 0 : 2)}</span>
              {hover.n ? ` · ${hover.n} requests/90d` : ""}
            </div>
            {hover.hs && <div className="text-bad">Significant hotspot (Gi* p&lt;0.05)</div>}
            {hover.em && <div className="text-warn">Emerging: sharp 30-day rise</div>}
          </div>
        )}
        <div className="card w-64 bg-panel/90 p-3 text-[11px] text-mute backdrop-blur">
          <div className="mb-1.5 font-medium text-ink">{metricLabel}{category !== "all" ? ` · ${catLabel(category)}` : ""}</div>
          <div className="h-2 rounded-full" style={{ background: RAMP_CSS }} />
          <div className="mt-1 flex justify-between"><span>low</span><span>high</span></div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#ff5a78]" />hotspot</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#fde047]" />emerging</span>
            {showProj && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-accent-2" />funded project</span>}
          </div>
        </div>
      </div>

      {/* right panel: cell detail or live feed */}
      <div className="absolute bottom-3 right-3 top-16 flex w-[min(400px,calc(100%-1.5rem))] flex-col">
        <div className="card flex min-h-0 flex-1 flex-col bg-panel shadow-2xl">
          {selected ? (
            <CellPanel id={selected} d={detail.data} loading={detail.loading} onClose={() => setSelected(null)} category={category} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">Live Pulse</h2>
                <span className={cx("chip", feed.connected && "border-ok/40 text-ok")}>{feed.connected ? "● live" : "…"}</span>
              </div>
              <p className="mb-3 text-xs text-mute">Click any hexagon to see why it scored the way it did. New citizen reports ripple on the map as they arrive.</p>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <PulseFeed items={feed.items} steps={feed.steps} connected={feed.connected} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, set, icon, label }: { on: boolean; set: (v: boolean) => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={() => set(!on)}
      aria-pressed={on}
      className={cx("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors", on ? "border-accent/50 bg-accent/10 text-accent" : "border-line-2 text-mute hover:text-ink")}
    >
      {icon}
      {label}
    </button>
  );
}

function CellPanel({ id, d, loading, onClose, category }: { id: string; d: CellDetail | null; loading: boolean; onClose: () => void; category: string }) {
  const [tab, setTab] = useState<"why" | "voices" | "data">("why");
  const s = d?.scores.find((x) => x.category === category) ?? d?.scores[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between border-b border-line p-4">
        <div>
          <div className="text-lg font-semibold text-ink">{d?.cell.admin_name ?? "…"}</div>
          <div className="font-mono text-[11px] text-faint">{id}</div>
          {d && (
            <div className="mt-1 text-xs text-mute">
              {fmtCompact(d.cell.population)} people · vulnerability {d.cell.vulnerability_index.toFixed(2)} · connectivity {d.cell.connectivity_index.toFixed(2)}
            </div>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-mute hover:bg-panel-2" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-line px-3 pt-2 text-xs">
        {(["why", "voices", "data"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("rounded-t-lg px-3 py-1.5", tab === t ? "bg-panel-2 text-ink" : "text-mute hover:text-ink")}>
            {t === "why" ? "Why this score" : t === "voices" ? `Citizen voices${d ? ` (${d.recent.length})` : ""}` : "Indicators"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && !d && <Spinner />}
        {d && tab === "why" && s && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CatBadge c={s.category} />
              <div className="text-right">
                <div className="font-mono text-3xl font-semibold text-ink">{s.priority_score.toFixed(1)}</div>
                <div className="text-[10px] uppercase tracking-wider text-faint">priority / 100</div>
              </div>
            </div>
            <ScoreBreakdown s={s} w={d.weights} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat k="Requests (90d)" v={fmt(s.request_count_90d)} />
              <Stat k="Unique reporters" v={fmt(s.unique_reporters_90d)} />
              <Stat k="Gi* z-score" v={s.gi_z === null ? "n/a" : s.gi_z.toFixed(2)} tone={s.is_hotspot ? "bad" : undefined} />
              <Stat k="p-value" v={s.gi_p === null ? "n/a" : s.gi_p.toFixed(3)} />
            </div>
            {s.is_emerging && <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs text-warn"><Radar className="h-4 w-4" /> Emerging: requests in the last 30 days far exceed the prior trend.</div>}
            {s.no_signal && <div className="rounded-lg border border-line-2 p-2 text-xs text-mute">No requests in 90 days. The score reflects latent need only (gap, population, vulnerability).</div>}
            <div>
              <div className="label">Other categories here</div>
              <div className="flex flex-col gap-1.5">
                {d.scores.filter((x) => x.category !== s.category).slice(0, 5).map((x) => (
                  <div key={x.category} className="flex items-center gap-2 text-xs">
                    <span className="w-40 truncate text-mute">{catLabel(x.category)}</span>
                    <Meter v={x.priority_score / 100} color={catColor(x.category)} />
                    <span className="w-8 text-right font-mono text-ink">{x.priority_score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
            {(d.recommendations.length > 0 || d.projects.length > 0) && (
              <div>
                <div className="label">Linked</div>
                {d.recommendations.map((r) => (
                  <Link key={r.id} href={`/app/recommendations/${r.id}`} className="mb-1 flex items-center justify-between rounded-lg border border-line p-2 text-xs hover:border-accent/50">
                    <span className="truncate text-ink">#{r.rank} {r.title}</span>
                    <StatusBadge s={r.status} />
                  </Link>
                ))}
                {d.projects.map((p) => (
                  <div key={p.id} className="mb-1 flex items-center justify-between rounded-lg border border-line p-2 text-xs">
                    <span className="truncate text-mute">🏗 {p.title}</span>
                    <StatusBadge s={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {d && tab === "voices" && (
          <div className="flex flex-col gap-2">
            {d.recent.length === 0 && <div className="text-sm text-mute">No requests located in this cell.</div>}
            {d.recent.map((r) => (
              <div key={r.id} className="card-2 p-3">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-mute">
                  <span className="font-mono">{r.tracking_code}</span>
                  <span>{LANG_LABEL[r.language_detected] ?? r.language_detected}</span>
                  <span className="ml-auto">{timeAgo(r.submitted_at)}</span>
                </div>
                <p className="text-sm text-ink">{r.text_original_redacted}</p>
                {r.language_detected !== "en" && <p className="mt-1 text-xs italic text-mute">{r.text_english_redacted}</p>}
                <div className="mt-2 flex gap-2">
                  <CatBadge c={r.category} />
                  <UrgencyBadge u={r.urgency} />
                </div>
              </div>
            ))}
          </div>
        )}
        {d && tab === "data" && (
          <div className="flex flex-col gap-2 text-xs">
            {d.indicators.map((i) => (
              <div key={`${i.category}-${i.key}`} className="flex items-center justify-between border-b border-line pb-1.5">
                <div>
                  <div className="text-ink">{catLabel(i.category)}: {i.key.replace(/_/g, " ")}</div>
                  <div className="text-faint">{i.source}{i.is_proxy ? " · proxy" : ""}</div>
                </div>
                <span className="font-mono text-ink">{fmt(i.value, 2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBreakdown({ s, w }: { s: CellDetail["scores"][number]; w: CellDetail["weights"] }) {
  const parts = [
    { k: "Citizen demand", v: s.d_norm, w: w.wD, color: "#22d3ee", hint: "percentile of reporting-bias-adjusted demand (90 days)" },
    { k: "Infrastructure gap", v: s.g_norm, w: w.wG, color: "#a78bfa", hint: "0 = well served, 1 = worst" },
    { k: "Population", v: s.p_norm, w: w.wP, color: "#34d399", hint: "percentile of residents" },
    { k: "Vulnerability", v: s.v_norm, w: w.wV, color: "#fbbf24", hint: "deprivation index" },
  ];
  const base = parts.reduce((a, p) => a + p.v * p.w, 0) * 100;
  return (
    <div className="rounded-xl border border-line bg-panel-2 p-3">
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-panel-3">
        {parts.map((p) => (
          <div key={p.k} style={{ width: `${p.v * p.w * 100}%`, background: p.color }} title={`${p.k}: ${(p.v * p.w * 100).toFixed(1)} pts`} className="border-r-2 border-panel-2 last:border-0" />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {parts.map((p) => (
          <div key={p.k} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs" title={p.hint}>
            <span className="flex items-center gap-2 text-mute">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.k}
            </span>
            <span className="font-mono text-faint">{p.v.toFixed(2)} × {p.w}</span>
            <span className="w-12 text-right font-mono text-ink">+{(p.v * p.w * 100).toFixed(1)}</span>
          </div>
        ))}
        <div className="mt-1 grid grid-cols-[1fr_auto] border-t border-line pt-1.5 text-xs">
          <span className="text-mute">Funded coverage penalty (×(1 − {w.alpha}·{s.f_coverage}))</span>
          <span className="w-12 text-right font-mono text-ink">{s.f_coverage > 0 ? `−${(base * w.alpha * s.f_coverage).toFixed(1)}` : "0"}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-2">
      <div className="text-[10px] uppercase tracking-wider text-faint">{k}</div>
      <div className={cx("font-mono text-sm", tone === "bad" ? "text-bad" : "text-ink")}>{v}</div>
    </div>
  );
}

export type { PulseEvt };
