"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { cellToLatLng } from "h3-js";
import { AlertTriangle, Building2, Check, Crosshair, Loader2, MapPin, Sparkles } from "lucide-react";
import { api, fmt, fmtCompact, useApi, useRegion } from "@/lib/client/hooks";
import type { HexDatum } from "@/components/HexMap";
import { ErrorBox, Kpi, Section, Spinner, cx } from "@/components/ui";

const HexMap = dynamic(() => import("@/components/HexMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

type FType = { type: string; label: string; category: string; radiusKm: number; costInr: number };
type Result = {
  label: string; categoryLabel: string; site: { lat: number; lng: number; area: string | null }; catchmentCells: string[];
  catchmentPopulation: number; peopleBenefiting: number; newlyWithinStandard: number; standardKm: number;
  meanGapBefore: number; meanGapAfter: number; meanDistanceBeforeKm: number | null; meanDistanceAfterKm: number | null;
  priorityBefore: number; priorityAfter: number; complaints12m: number; expectedComplaintsAvoidedPerYear: number; observedEffectPct: number;
  costDisplay: string; costPerBeneficiaryInr: number; meanVulnerability: number; regionMeanVulnerability: number;
  siteRankPct: number; betterSite: { site: { lat: number; lng: number; area: string | null }; peopleBenefiting: number; newlyWithinStandard: number; catchmentCells: string[] } | null;
  narrative: string; model: string; unverifiedNumbers: string[];
};

const CAT_FOR: Record<string, string> = { hospital: "health", clinic: "health", school: "education", water_point: "water_supply", drain: "sanitation_drainage", streetlights: "public_safety_lighting", road: "roads_transport" };

export default function WhatIfPage() {
  const { code, region } = useRegion();
  const types = useApi<FType[]>("/whatif/types");
  const [type, setType] = useState("hospital");
  const [site, setSite] = useState<{ h: string; lat: number; lng: number } | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cells = useApi<HexDatum[]>(`/map/cells?region=${code}&category=${CAT_FOR[type]}&metric=priority`, [code, type]);
  const center = useMemo(() => region.center, [region]);

  const run = async (s = site) => {
    if (!s) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(await api<Result>(`/whatif?region=${code}`, { method: "POST", json: { type, lat: s.lat, lng: s.lng } }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pick = (h: string | null) => {
    if (!h) return;
    const [lat, lng] = cellToLatLng(h);
    setSite({ h, lat, lng });
    setRes(null);
  };
  const outlines = useMemo(() => {
    const o: { cells: string[]; color: string }[] = [];
    if (res) o.push({ cells: res.catchmentCells, color: "#22d3ee" });
    if (res?.betterSite) o.push({ cells: res.betterSite.catchmentCells, color: "#34d399" });
    return o;
  }, [res]);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Building2 className="h-6 w-6 text-accent" /> What-if simulator</h1>
        <p className="text-sm text-mute">
          &quot;If I build a hospital here, how much difference will it make?&quot; Click a spot in {region.name}. CivicPulse computes coverage, access, complaints and cost from the city&apos;s data, checks every alternative site, and an AI (Gemini) briefs you in plain language using only those numbers.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="card flex flex-wrap items-center gap-2 p-3">
            {types.data?.map((t) => (
              <button key={t.type} onClick={() => { setType(t.type); setRes(null); }} className={cx("rounded-lg border px-3 py-1.5 text-xs", type === t.type ? "border-accent bg-accent/10 text-accent" : "border-line-2 text-mute hover:text-ink")}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="card relative h-[520px] overflow-hidden">
            <HexMap center={center} zoom={code === "IN-DL" ? 10.4 : 10.9} cells={cells.data ?? []} normalize="fixed100" selected={site?.h ?? null} outlines={outlines} onSelect={pick} />
            <div className="pointer-events-none absolute left-3 top-3 card bg-panel/90 px-3 py-2 text-xs text-mute">
              <Crosshair className="mr-1 inline h-3.5 w-3.5 text-accent" /> Click a hexagon to place the facility · colour = current priority for this sector
            </div>
          </div>
          <div className="card flex flex-wrap items-center gap-3 p-3">
            <MapPin className="h-4 w-4 text-accent" />
            <span className="text-sm text-mute">{site ? `Site: ${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}` : "No site selected yet"}</span>
            <button className="btn-primary ml-auto" disabled={!site || busy} onClick={() => run()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Simulate impact
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {err && <ErrorBox msg={err} />}
          {!res && !busy && (
            <div className="card flex h-full min-h-60 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-mute">
              <Building2 className="h-8 w-8 text-faint" />
              Pick a facility type, click a location on the map, then press <b className="text-ink">Simulate impact</b>.
            </div>
          )}
          {busy && <Spinner label="Computing catchment, alternatives and AI briefing…" />}
          {res && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="People benefiting" value={fmtCompact(res.peopleBenefiting)} sub={`within catchment of ${res.site.area}`} />
                <Kpi label="Newly within standard" value={fmtCompact(res.newlyWithinStandard)} sub={`≤ ${res.standardKm} km access`} accent="#34d399" />
                <Kpi label="Cost (indicative)" value={res.costDisplay} sub={`₹${fmt(res.costPerBeneficiaryInr)} per beneficiary`} accent="#fbbf24" />
                <Kpi label="Complaints avoided / yr" value={fmt(res.expectedComplaintsAvoidedPerYear)} sub={`of ${fmt(res.complaints12m)} in 12 months · ${res.observedEffectPct}% effect from past projects`} accent="#a78bfa" />
              </div>
              <Section title="Before → after">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Delta k="Infrastructure gap" a={res.meanGapBefore} b={res.meanGapAfter} />
                  <Delta k="Priority score" a={res.priorityBefore} b={res.priorityAfter} />
                  {res.meanDistanceBeforeKm !== null ? <Delta k="Avg distance (km)" a={res.meanDistanceBeforeKm} b={res.meanDistanceAfterKm ?? 0} /> : <Delta k="Vulnerability (area vs city)" a={res.regionMeanVulnerability} b={res.meanVulnerability} neutral />}
                </div>
                <div className="mt-3 text-xs text-mute">This site ranks in the <b className="text-ink">{res.siteRankPct}th percentile</b> of candidate sites for a {res.label.toLowerCase()}.</div>
                {res.betterSite && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-ok" />
                    <span className="flex-1 text-ink">Better site: <b>{res.betterSite.site.area}</b> would benefit {fmtCompact(res.betterSite.peopleBenefiting)} people ({fmtCompact(res.betterSite.newlyWithinStandard)} newly within standard).</span>
                    <button
                      className="btn-ok px-3 py-1.5 text-xs"
                      onClick={() => {
                        const s = { h: "", lat: res.betterSite!.site.lat, lng: res.betterSite!.site.lng };
                        setSite(s);
                        void run(s);
                      }}
                    >
                      Try that site
                    </button>
                  </div>
                )}
              </Section>
              <Section title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent-2" /> Briefing for the MP</span>}>
                <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-faint">
                  {res.unverifiedNumbers.length === 0 ? (
                    <span className="chip border-ok/40 text-ok"><Check className="h-3 w-3" /> numbers verified</span>
                  ) : (
                    <span className="chip border-warn/40 text-warn">check: {res.unverifiedNumbers.join(", ")}</span>
                  )}
                </div>
                <div className="prose-brief"><ReactMarkdown>{res.narrative}</ReactMarkdown></div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Delta({ k, a, b, neutral }: { k: string; a: number; b: number; neutral?: boolean }) {
  const better = b < a;
  return (
    <div className="card-2 p-3">
      <div className="text-faint">{k}</div>
      <div className="mt-1 font-mono text-ink">
        {a} → <span className={cx(!neutral && (better ? "text-ok" : "text-mute"))}>{b}</span>
      </div>
    </div>
  );
}
