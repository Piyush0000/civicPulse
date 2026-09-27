"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cellToLatLng } from "h3-js";
import {
  ArrowRight, BrainCircuit, Calculator, Globe2, Languages, Lock, Mic, Radar, ShieldCheck, Smartphone, Sparkles, Target, WifiOff,
} from "lucide-react";
import PublicNav from "@/components/PublicNav";
import { REGIONS } from "@/lib/regions";
import { catLabel } from "@/lib/categories";
import { fmt, fmtCompact, useApi, usePulse, type PulseEvt } from "@/lib/client/hooks";
import type { HexDatum, Ping } from "@/components/HexMap";
import { catColor, cx } from "@/components/ui";

const HexMap = dynamic(() => import("@/components/HexMap"), { ssr: false });

type Stats = { region: string; cells: { h: string; requests: number; hotspot: boolean; top: string }[]; totals: { total: number; languages: number; accepted: number }; categories: { category: string; n: number }[] };
type Regions = { code: string; requests: number; languages: string[] }[];

export default function Landing() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const region = REGIONS[idx];
  const stats = useApi<Stats>(`/public/stats/${region.code}`, [region.code]);
  const all = useApi<Regions>("/public/regions");
  const [pings, setPings] = useState<Ping[]>([]);
  const [ticker, setTicker] = useState<PulseEvt[]>([]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % REGIONS.length), 14000);
    return () => clearInterval(t);
  }, [paused]);

  const onPulse = useCallback((e: PulseEvt) => {
    if (e.type !== "request") return;
    setTicker((t) => [e, ...t].slice(0, 4));
    if (e.h3) {
      const [lat, lng] = cellToLatLng(e.h3);
      setPings((p) => [...p.filter((x) => Date.now() - x.born < 6000), { id: `${e.at}${Math.random()}`, lat, lng, color: catColor(e.category), born: Date.now() }]);
    }
  }, []);
  usePulse(region.code, onPulse);

  const cells: HexDatum[] = useMemo(() => (stats.data?.cells ?? []).map((c) => ({ h: c.h, v: c.requests, hs: c.hotspot })), [stats.data]);
  const totalRequests = all.data?.reduce((a, r) => a + r.requests, 0) ?? 0;
  const langs = new Set(all.data?.flatMap((r) => r.languages) ?? []);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PublicNav />
      <section className="relative">
        <div className="absolute inset-0 opacity-90">
          <HexMap center={region.center} zoom={10.4} cells={cells} extruded interactive={false} pings={pings} autoRotate normalize="quantile" padLeftRatio={0.45} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[640px] max-w-6xl flex-col justify-center px-4 py-16">
          <div className="max-w-xl">
            <span className="chip border-accent/40 text-accent"><Sparkles className="h-3 w-3" /> Digital Public Good · BRICS Innovation</span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Every citizen&apos;s voice,
              <br />
              <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">turned into investment.</span>
            </h1>
            <p className="mt-5 text-lg text-mute">
              CivicPulse listens to voice notes, texts, calls and USSD messages in any language, fuses them with population, infrastructure and budget data,
              and tells governments exactly where the next rupee, real, rand, ruble or yuan will do the most good.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/submit" className="btn-primary px-5 py-3 text-base"><Mic className="h-5 w-5" /> Report a problem</Link>
              <Link href="/app" className="btn-ghost px-5 py-3 text-base">Open planner console <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              {REGIONS.map((r, i) => (
                <button key={r.code} onClick={() => { setIdx(i); setPaused(true); }} className={cx("rounded-full border px-3 py-1 text-xs transition-colors", i === idx ? "border-accent bg-accent/15 text-accent" : "border-line-2 bg-panel/60 text-mute hover:text-ink")}>
                  {r.flag} {r.name}
                </button>
              ))}
            </div>
            <div className="mt-4 h-16">
              {ticker.map((e, i) => (
                <div key={e.at + i} className={cx("cp-in flex items-center gap-2 text-xs", i > 0 && "opacity-50")}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor(e.category) }} />
                  <span className="text-ink">{catLabel(e.category ?? "other")}</span>
                  <span className="text-faint">· {e.language} · via {e.channel} · just now</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 right-6 hidden text-right text-xs text-mute md:block">
          <div className="text-sm font-medium text-ink">{region.flag} {stats.data?.region}</div>
          <div>{fmt(stats.data?.totals.total)} citizen requests · k-anonymous public view</div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {[
          { k: "citizen requests", v: fmtCompact(totalRequests) },
          { k: "BRICS pilot cities", v: REGIONS.length },
          { k: "languages understood", v: langs.size || 6 },
          { k: "paid services required", v: 0 },
        ].map((x) => (
          <div key={x.k} className="card p-5">
            <div className="font-mono text-3xl font-semibold text-ink">{x.v}</div>
            <div className="text-sm text-mute">{x.k}</div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">From a voice note to a funded project</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            { i: <Mic className="h-5 w-5" />, t: "Listen", d: "Voice, text, Telegram, IVR calls and USSD on feature phones. Hindi, Portuguese, Russian, Chinese, isiZulu, English, even Hinglish." },
            { i: <BrainCircuit className="h-5 w-5" />, t: "Understand", d: "Speech-to-text, translation, PII redaction and structured extraction with free LLMs (offline rules as fallback). Near-duplicates become one demand signal." },
            { i: <Radar className="h-5 w-5" />, t: "Fuse & detect", d: "H3 hexagon grid × population × infrastructure gaps × vulnerability × planned budgets. Getis-Ord Gi* hotspots, emerging-outbreak alerts, bias correction." },
            { i: <Target className="h-5 w-5" />, t: "Decide", d: "Ranked projects with AI policy briefs that cite plan documents and verify every number. Decisions go to a public hash-chained ledger." },
          ].map((s, n) => (
            <div key={s.t} className="card relative p-5">
              <span className="absolute right-4 top-4 font-mono text-xs text-faint">0{n + 1}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">{s.i}</div>
              <h3 className="mt-4 text-lg font-medium">{s.t}</h3>
              <p className="mt-1 text-sm text-mute">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-3xl font-semibold tracking-tight">Built for the whole population, not just the connected</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { i: <Smartphone />, t: "USSD for feature phones", d: "Dial *123#: no smartphone, no data plan needed." },
            { i: <WifiOff />, t: "Offline-first reporting", d: "Reports queue on the device and sync when connectivity returns." },
            { i: <Languages />, t: "Under-reporting correction", d: "Demand is divided by connectivity so quiet, poor areas are not ignored." },
            { i: <BrainCircuit />, t: "Ask CivicPulse", d: "A policy copilot that answers only through analytics tools. No invented numbers." },
            { i: <Calculator />, t: "Budget optimizer", d: "Portfolio that maximises people reached per dollar, with an equity floor." },
            { i: <Globe2 />, t: "BRICS federation", d: "Countries keep their data; they share only k-anonymous, signed aggregates." },
            { i: <ShieldCheck />, t: "Tamper-evident ledger", d: "Every decision is hash-chained and publicly verifiable." },
            { i: <Lock />, t: "Privacy by design", d: "HMAC pseudonyms, encrypted contact mapping, PII redaction, retention limits, STOP opt-out." },
            { i: <Radar />, t: "Foresight", d: "Seasonal forecasts and emerging-hotspot alerts, so cities act before the monsoon, the winter or the outbreak." },
          ].map((f) => (
            <div key={f.t} className="card flex gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-2/10 text-accent-2 [&>svg]:h-5 [&>svg]:w-5">{f.i}</div>
              <div>
                <h3 className="font-medium">{f.t}</h3>
                <p className="mt-1 text-sm text-mute">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-mute">
          <div>
            <div className="font-medium text-ink">CivicPulse: open source (Apache-2.0), self-hostable per country</div>
            <div>Aligned with the DPG Standard · SDG 6, 9, 11, 16 · demo data is synthetic and illustrative.</div>
          </div>
          <div className="flex gap-3">
            <Link href="/transparency" className="hover:text-ink">Transparency</Link>
            <Link href="/about" className="hover:text-ink">About & privacy</Link>
            <a href="/api/v1/openapi.json" className="hover:text-ink">API</a>
          </div>
        </div>
      </section>
    </div>
  );
}
