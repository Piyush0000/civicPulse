"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { api, useApi, useRegion } from "@/lib/client/hooks";
import { CatBadge, Section, Spinner, cx } from "@/components/ui";

type W = { wD: number; wG: number; wP: number; wV: number; alpha: number };
type Preview = { rank: number; title: string; category: string; score: number; people: number }[];

const KEYS: { k: keyof W; label: string; hint: string; color: string }[] = [
  { k: "wD", label: "Citizen demand", hint: "Requests, adjusted for urgency, recency and under-reporting", color: "#22d3ee" },
  { k: "wG", label: "Infrastructure gap", hint: "Distance to clinics, schools per capita, road density…", color: "#a78bfa" },
  { k: "wP", label: "Population", hint: "How many people live there", color: "#34d399" },
  { k: "wV", label: "Vulnerability", hint: "Deprivation index", color: "#fbbf24" },
];

export default function SettingsPage() {
  const { code, region } = useRegion();
  const s = useApi<{ weights: W; defaults: W }>(`/settings/scoring?region=${code}`, [code]);
  const me = useApi<{ user: { role: string } }>("/auth/me");
  const [w, setW] = useState<W | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [base, setBase] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = me.data && ["admin", "analyst"].includes(me.data.user.role);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (s.data) setW(s.data.weights); }, [s.data]);
  useEffect(() => {
    if (!s.data) return;
    api<Preview>(`/settings/scoring/preview?region=${code}`, { method: "POST", json: s.data.weights }).then(setBase).catch(() => undefined);
  }, [s.data, code]);
  useEffect(() => {
    if (!w) return;
    const t = setTimeout(() => {
      api<Preview>(`/settings/scoring/preview?region=${code}`, { method: "POST", json: w }).then(setPreview).catch((e) => setMsg(e.message));
    }, 350);
    return () => clearTimeout(t);
  }, [w, code]);

  if (!w || !s.data) return <Spinner />;

  // Moving one slider rescales the other three so the four weights always sum to 1.
  const setWeight = (k: keyof W, v: number) => {
    if (k === "alpha") return setW({ ...w, alpha: v });
    const others = KEYS.map((x) => x.k).filter((x) => x !== k);
    const rest = others.reduce((a, x) => a + w[x], 0) || 1;
    const next = { ...w, [k]: v };
    for (const o of others) next[o] = Math.round(((w[o] / rest) * (1 - v)) * 1000) / 1000;
    const drift = 1 - KEYS.reduce((a, x) => a + next[x.k], 0);
    next[others[0]] = Math.round((next[others[0]] + drift) * 1000) / 1000;
    setW(next);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/settings/scoring?region=${code}`, { method: "PUT", json: w });
      setMsg("Saved. Scores, hotspots and recommendations recomputed; change written to the ledger.");
      s.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const baseRank = new Map(base?.map((b) => [b.title, b.rank]));

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><SlidersHorizontal className="h-6 w-6 text-accent" /> Scoring weights</h1>
        <p className="text-sm text-mute">
          {region.name}: priority = 100 × (wD·D + wG·G + wP·P + wV·V) × (1 − α·F). The formula is transparent and set by people, not by the model.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Section title="Weights (always sum to 1)">
          <div className="mb-4 flex h-3 overflow-hidden rounded-full">
            {KEYS.map((x) => <div key={x.k} style={{ width: `${w[x.k] * 100}%`, background: x.color }} className="border-r-2 border-panel last:border-0" />)}
          </div>
          <div className="flex flex-col gap-4">
            {KEYS.map((x) => (
              <div key={x.k}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.label}</span>
                  <span className="font-mono text-ink">{w[x.k].toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={0.85} step={0.01} value={w[x.k]} onChange={(e) => setWeight(x.k, Number(e.target.value))} disabled={!canEdit} className="w-full" aria-label={x.label} />
                <div className="text-[11px] text-faint">{x.hint}</div>
              </div>
            ))}
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink">α: discount for already-funded areas</span>
                <span className="font-mono text-ink">{w.alpha.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={w.alpha} onChange={(e) => setWeight("alpha", Number(e.target.value))} disabled={!canEdit} className="w-full" aria-label="alpha" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={save} disabled={!canEdit || busy}><Save className="h-4 w-4" /> {busy ? "Recomputing…" : "Save & recompute"}</button>
            <button className="btn-ghost" onClick={() => setW(s.data!.defaults)} disabled={!canEdit}><RotateCcw className="h-4 w-4" /> Defaults</button>
            {!canEdit && <span className="text-xs text-faint">Analysts and admins can change weights.</span>}
          </div>
          {msg && <p className="mt-3 text-xs text-accent">{msg}</p>}
        </Section>
        <Section title="Live preview: top 10 under these weights">
          {!preview && <Spinner />}
          <ol className="flex flex-col gap-1.5">
            {preview?.map((p) => {
              const was = baseRank.get(p.title);
              const delta = was ? was - p.rank : null;
              return (
                <li key={p.title} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="w-6 font-mono text-faint">{p.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{p.title}</span>
                  <CatBadge c={p.category} />
                  <span className="w-10 text-right font-mono text-xs text-ink">{p.score.toFixed(0)}</span>
                  <span className={cx("w-10 text-right font-mono text-xs", delta === null ? "text-accent" : delta > 0 ? "text-ok" : delta < 0 ? "text-bad" : "text-faint")}>
                    {delta === null ? "new" : delta === 0 ? "–" : delta > 0 ? `▲${delta}` : `▼${-delta}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>
    </div>
  );
}
