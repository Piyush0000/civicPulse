"use client";

import { useState } from "react";
import { Banknote, RefreshCw } from "lucide-react";
import { catLabel } from "@/lib/categories";
import { api, useApi, useRegion } from "@/lib/client/hooks";
import { ErrorBox, Kpi, Section, Spinner, StatusBadge, cx } from "@/components/ui";

type Scheme = { scheme: string; envelope: number; sanctioned: number; released: number; utilised: number; headroom: number; projects: number; source: string };
type Funds = {
  currency: string;
  source: string;
  totals: { envelope: number; sanctioned: number; released: number; utilised: number; headroom: number };
  schemes: Scheme[];
  projects: { project_ref: string; title: string; scheme: string; category: string | null; fy: string; sanctioned: number; released: number; utilised: number; status: string | null; admin_name: string | null }[];
};

/** ₹ in crore/lakh, the way Indian budget documents write it. */
export const inr = (x: number) => (x >= 1e7 ? `₹${(x / 1e7).toLocaleString("en-IN", { maximumFractionDigits: x >= 1e9 ? 0 : 1 })} cr` : `₹${(x / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh`);

// One hue, three nested steps drawn widest-first: sanctioned (dark) ⊃ released ⊃ utilised (light, on top).
const SHADE = { sanctioned: "#1c5cab", released: "#3987e5", utilised: "#9ec5f4" };

export default function FundsPage() {
  const { code, region } = useRegion();
  const f = useApi<Funds>(`/allocations?region=${code}`, [code]);
  const me = useApi<{ user: { role: string } }>("/auth/me");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canSync = me.data && ["admin", "analyst"].includes(me.data.user.role);

  const sync = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ source: string; rows: number }>(`/allocations/sync?region=${code}`, { method: "POST" });
      setMsg(`Synced ${r.rows} project allocations from ${r.source}.`);
      f.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (f.error) return <ErrorBox msg={f.error} />;
  if (!f.data) return <Spinner />;
  const t = f.data.totals;
  const max = Math.max(1, ...f.data.schemes.map((s) => s.envelope));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Banknote className="h-6 w-6 text-ok" /> Fund allocations</h1>
          <p className="text-sm text-mute">
            {region.name}: follow the money from scheme envelope → sanctioned → released → utilised. Source:{" "}
            <span className={cx("chip", f.data.source.startsWith("synthetic") ? "text-warn" : "text-ok")}>{f.data.source}</span>
          </p>
        </div>
        {canSync && (
          <button className="btn-ghost text-xs" onClick={sync} disabled={busy}>
            <RefreshCw className={cx("h-4 w-4", busy && "animate-spin")} /> Sync from government finance API
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-accent">{msg}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Scheme envelopes" value={inr(t.envelope)} />
        <Kpi label="Sanctioned" value={inr(t.sanctioned)} sub={`${Math.round((t.sanctioned / Math.max(1, t.envelope)) * 100)}% of envelopes`} />
        <Kpi label="Released" value={inr(t.released)} sub={`${Math.round((t.released / Math.max(1, t.sanctioned)) * 100)}% of sanctioned`} />
        <Kpi label="Utilised" value={inr(t.utilised)} sub={`${Math.round((t.utilised / Math.max(1, t.released)) * 100)}% of released`} accent="#34d399" />
        <Kpi label="Unallocated headroom" value={inr(t.headroom)} sub="available for new citizen-driven projects" accent="#fbbf24" />
      </div>

      <Section title="By scheme">
        <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-mute">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-line-2" /> envelope</span>
          {Object.entries(SHADE).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: c }} /> {k}</span>)}
        </div>
        <div className="flex flex-col gap-3">
          {f.data.schemes.map((s) => (
            <div key={s.scheme} className="grid grid-cols-[minmax(0,16rem)_1fr_7rem] items-center gap-3 text-xs" title={`${s.scheme}: envelope ${inr(s.envelope)}, sanctioned ${inr(s.sanctioned)}, released ${inr(s.released)}, utilised ${inr(s.utilised)}`}>
              <div>
                <div className="truncate text-ink">{s.scheme}</div>
                <div className="text-faint">{s.projects} projects</div>
              </div>
              <div className="relative h-5 rounded-md border border-line-2" style={{ width: `${(s.envelope / max) * 100}%`, minWidth: "2rem" }}>
                {(["sanctioned", "released", "utilised"] as const).map((k) => (
                  <div key={k} className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${(s[k] / Math.max(1, s.envelope)) * 100}%`, background: SHADE[k] }} />
                ))}
              </div>
              <div className="text-right">
                <div className={cx("font-mono", s.headroom / Math.max(1, s.envelope) < 0.05 ? "text-bad" : "text-ok")}>{inr(s.headroom)}</div>
                <div className="text-faint">headroom</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Project-level fund flow">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
              <tr><th className="py-2">Project</th><th>Scheme</th><th>Status</th><th className="text-right">Sanctioned</th><th className="text-right">Released</th><th className="text-right">Utilised</th><th className="text-right">Utilisation</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {f.data.projects.map((p) => (
                <tr key={p.project_ref + p.fy}>
                  <td className="py-2 pr-3"><div className="text-ink">{p.title}</div><div className="text-[11px] text-faint">{p.project_ref} · {p.admin_name} · {p.category ? catLabel(p.category) : ""}</div></td>
                  <td className="pr-3 text-xs text-mute">{p.scheme}</td>
                  <td>{p.status && <StatusBadge s={p.status} />}</td>
                  <td className="text-right font-mono text-xs text-ink">{inr(p.sanctioned)}</td>
                  <td className="text-right font-mono text-xs text-ink">{inr(p.released)}</td>
                  <td className="text-right font-mono text-xs text-ink">{inr(p.utilised)}</td>
                  <td className="text-right font-mono text-xs text-mute">{p.released ? `${Math.round((p.utilised / p.released) * 100)}%` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-faint">
          Plug a real feed with ALLOCATION_API_URL (state IFMS / PFMS export) or DATA_GOV_IN_API_KEY + DATA_GOV_IN_RESOURCE (Open Government Data platform). Demo figures are synthetic.
        </p>
      </Section>
    </div>
  );
}
