"use client";

import { Download, ShieldAlert, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import PublicNav from "@/components/PublicNav";
import { useApi } from "@/lib/client/hooks";
import { REGIONS } from "@/lib/regions";
import { CatBadge, Spinner, StatusBadge, cx } from "@/components/ui";
import type { HexDatum } from "@/components/HexMap";

const HexMap = dynamic(() => import("@/components/HexMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

type Tr = {
  decisions: { id: string; region_code: string; title: string; category: string; status: string; decided_at: string; people_affected_est: number; decision_note: string | null }[];
  ledger: { seq: number; user_email: string | null; action: string; entity_type: string; at: string; hash: string; prev_hash: string; region_code: string | null }[];
  verify: { ok: boolean; count: number; brokenAt: number | null; head: string };
};

export default function TransparencyPage() {
  const [regionCode, setRegionCode] = useState(REGIONS[0].code);
  const d = useApi<Tr>("/public/transparency");
  const stats = useApi<any>(`/public/stats/${regionCode}`, [regionCode]);
  const cells = useMemo<HexDatum[]>(() => {
    return (stats.data?.cells ?? []).map((c: any) => ({ h: c.h, v: c.requests, hs: c.hotspot }));
  }, [stats.data]);
  const currentRegion = REGIONS.find(r => r.code === regionCode) || REGIONS[0];
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Public accountability</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Every decision, on the record</h1>
        <p className="mt-2 max-w-3xl text-mute">
          Decisions on citizen-driven recommendations are written to a tamper-evident SHA-256 hash chain. Anyone can re-verify it. Open data exports are k-anonymised (no area with fewer than 5 reporters is shown).
        </p>
        {!d.data && <Spinner />}
        {d.data && (
          <>
            <div className={cx("card mt-6 flex flex-wrap items-center gap-4 p-4", d.data.verify.ok ? "border-ok/40" : "border-bad/50")}>
              {d.data.verify.ok ? <ShieldCheck className="h-9 w-9 text-ok" /> : <ShieldAlert className="h-9 w-9 text-bad" />}
              <div className="flex-1">
                <div className="font-medium">{d.data.verify.ok ? `Ledger verified: ${d.data.verify.count} entries, chain intact` : `Ledger tampering detected at entry #${d.data.verify.brokenAt}`}</div>
                <div className="break-all font-mono text-[11px] text-faint">head hash {d.data.verify.head}</div>
              </div>
              <button className="btn-ghost text-xs" onClick={() => d.reload()}>Verify again</button>
            </div>

            <h2 className="mt-8 text-lg font-semibold">Decisions</h2>
            <div className="mt-3 flex flex-col gap-2">
              {d.data.decisions.length === 0 && <p className="text-sm text-mute">No decisions recorded yet.</p>}
              {d.data.decisions.map((x) => (
                <div key={x.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
                  <StatusBadge s={x.status} />
                  <span className="min-w-0 flex-1 text-ink">{x.title}</span>
                  <CatBadge c={x.category} />
                  <span className="text-xs text-mute">{REGIONS.find((r) => r.code === x.region_code)?.name} · {x.decided_at && new Date(x.decided_at).toLocaleDateString()}</span>
                  {x.decision_note && <span className="w-full text-xs italic text-mute">“{x.decision_note}”</span>}
                </div>
              ))}
            </div>

            <h2 className="mt-12 text-lg font-semibold">Public Hotspot Map (k-anonymous)</h2>
            <p className="mt-1 text-sm text-mute mb-4">View a privacy-preserving map of public demand. Precise locations are coarsened and cells with fewer than 5 unique reporters are hidden to protect citizen privacy.</p>
            
            <div className="flex gap-2 mb-4">
              {REGIONS.map((r) => (
                <button 
                  key={r.code} 
                  onClick={() => setRegionCode(r.code)}
                  className={cx("px-3 py-1.5 text-xs rounded-full border transition-colors", regionCode === r.code ? "bg-accent/15 border-accent text-accent" : "bg-panel border-line-2 text-mute hover:text-ink")}
                >
                  {r.flag} {r.name}
                </button>
              ))}
            </div>
            
            <div className="card relative h-[400px] overflow-hidden mb-12">
               <HexMap center={currentRegion.center} zoom={10.4} cells={cells} extruded={false} />
               <div className="pointer-events-none absolute bottom-4 left-3 flex flex-wrap gap-2 text-xs bg-panel/90 p-2 rounded-lg backdrop-blur">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#ff3250]" />Redzone / Hotspot</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#fd8c1e]" />Watch</span>
               </div>
            </div>

            <h2 className="mt-8 text-lg font-semibold">Open data</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {REGIONS.map((r) => (
                <div key={r.code} className="card flex flex-col gap-2 p-3 text-sm">
                  <span className="text-ink">{r.flag} {r.name}</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a className="btn-ghost px-2 py-1 text-xs" href={`/api/v1/export/cells.geojson?region=${r.code}`}><Download className="h-3.5 w-3.5" /> GeoJSON</a>
                    <a className="btn-ghost px-2 py-1 text-xs" href={`/api/v1/export/cells.csv?region=${r.code}`}>CSV</a>
                    <a className="btn-ghost px-2 py-1 text-xs" href={`/api/v1/federation/aggregate/${r.code}`}>Federation JSON</a>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mt-8 text-lg font-semibold">Ledger (latest)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="text-left text-faint"><tr><th className="py-2">#</th><th>Action</th><th>By</th><th>When</th><th>Hash</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.data.ledger.map((l) => (
                    <tr key={l.seq}>
                      <td className="py-2 font-mono text-faint">{l.seq}</td>
                      <td className="text-ink">{l.action}</td>
                      <td className="text-mute">{l.user_email}</td>
                      <td className="text-mute">{new Date(l.at).toLocaleString()}</td>
                      <td className="font-mono text-faint">{l.hash.slice(0, 20)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
