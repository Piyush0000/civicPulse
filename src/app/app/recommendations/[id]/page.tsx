"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, ArrowLeft, Check, Clock, FileDown, Hash, RefreshCw, Sparkles, X } from "lucide-react";
import { api, fmt, fmtCompact, fmtUsd, useApi, useRegion } from "@/lib/client/hooks";
import { TrendArea } from "@/components/charts";
import { CatBadge, ErrorBox, LANG_LABEL, ScoreRing, Section, Spinner, StatusBadge, UrgencyBadge, cx } from "@/components/ui";
import type { HexDatum } from "@/components/HexMap";

const HexMap = dynamic(() => import("@/components/HexMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

type Citation = { label: string; title: string; excerpt: string; score: number };
type Detail = {
  id: string; title: string; category: string; admin_names: string[]; priority_score: number; rank: number; people_affected_est: number;
  request_count: number; unique_reporters: number; hotspot_cells: number; funded_overlap: number; est_cost_usd: number; status: string;
  decision_note: string | null; decided_by: string | null; decided_at: string | null; h3_cells: string[]; center_lat: number; center_lng: number;
  gap_summary: Record<string, { area: number; regionMedian: number; isProxy: boolean }>;
  quotes: { id: string; language: string; original: string; english: string; urgency: string }[];
  overlapping_projects: { id: string; title: string; status: string; budget: number; currency: string }[];
  cellsDetail: { h3_cell: string; priority_score: number; d_norm: number; g_norm: number; p_norm: number; v_norm: number; is_hotspot: boolean; request_count_90d: number; population: number; admin_name: string }[];
  brief: { version: number; content_md: string; citations: Citation[]; model_name: string; validation_warning: boolean; unverified_numbers: string[]; generated_at: string } | null;
  monthly: { m: string; n: number }[];
  languages: { k: string; n: number }[];
  history: { seq: number; user_email: string; action: string; diff: { note?: string }; at: string; hash: string }[];
};

export default function RecommendationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { code } = useRegion();
  const d = useApi<Detail>(`/recommendations/${id}?region=${code}`, [id, code]);
  const me = useApi<{ user: { role: string } }>("/auth/me");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const cells: HexDatum[] = useMemo(() => (d.data?.cellsDetail ?? []).map((c) => ({ h: c.h3_cell, v: c.priority_score, hs: c.is_hotspot })), [d.data]);
  const center = useMemo<[number, number]>(() => [d.data?.center_lat ?? 0, d.data?.center_lng ?? 0], [d.data?.center_lat, d.data?.center_lng]);

  if (d.error) return <ErrorBox msg={d.error} />;
  if (!d.data) return <Spinner />;
  const r = d.data;
  const canDecide = me.data && ["admin", "policymaker"].includes(me.data.user.role);

  const decide = async (status: string) => {
    setBusy(status);
    setMsg(null);
    try {
      const res = await api<{ ledger: { seq: number; hash: string } }>(`/recommendations/${id}?region=${code}`, { method: "PATCH", json: { status, note } });
      setMsg(`Decision recorded in ledger entry #${res.ledger.seq} (${res.ledger.hash.slice(0, 12)}…)`);
      setNote("");
      await d.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const regen = async () => {
    setBusy("brief");
    try {
      await api(`/recommendations/${id}/brief?region=${code}`, { method: "POST" });
      await d.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <Link href="/app/recommendations" className="no-print flex w-fit items-center gap-1 text-xs text-mute hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" /> All recommendations
      </Link>
      <div className="flex flex-wrap items-start gap-5">
        <ScoreRing score={r.priority_score} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
            <span className="font-mono">Rank #{r.rank}</span>
            <CatBadge c={r.category} />
            <StatusBadge s={r.status} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{r.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mute">
            <span><b className="font-mono text-ink">{fmtCompact(r.people_affected_est)}</b> people affected</span>
            <span><b className="font-mono text-ink">{fmt(r.request_count)}</b> requests (90d)</span>
            <span><b className="font-mono text-ink">{fmt(r.unique_reporters)}</b> unique reporters</span>
            <span><b className="font-mono text-ink">{r.hotspot_cells}</b> hotspot cells</span>
            <span><b className="font-mono text-ink">{Math.round(r.funded_overlap * 100)}%</b> already funded</span>
            <span>indicative cost <b className="font-mono text-ink">{fmtUsd(r.est_cost_usd)}</b></span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section
            title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent-2" /> Policy brief</span>}
            right={
              <div className="no-print flex items-center gap-2">
                <button onClick={regen} disabled={busy === "brief"} className="btn-ghost px-3 py-1.5 text-xs">
                  <RefreshCw className={cx("h-3.5 w-3.5", busy === "brief" && "animate-spin")} /> Regenerate with AI
                </button>
                <button onClick={() => window.print()} className="btn-ghost px-3 py-1.5 text-xs">
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            }
          >
            {!r.brief && <p className="text-sm text-mute">No brief yet. Generate one.</p>}
            {r.brief && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                  <span className="chip">v{r.brief.version}</span>
                  <span className="chip">{r.brief.model_name}</span>
                  <span>{new Date(r.brief.generated_at).toLocaleString()}</span>
                  {r.brief.validation_warning ? (
                    <span className="chip border-warn/50 text-warn"><AlertTriangle className="h-3 w-3" /> numbers not in evidence: {r.brief.unverified_numbers.join(", ")}</span>
                  ) : (
                    <span className="chip border-ok/40 text-ok"><Check className="h-3 w-3" /> every number verified against evidence</span>
                  )}
                </div>
                <article className="prose-brief">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p>{cite(children, r.brief!.citations)}</p>,
                      li: ({ children }) => <li>{cite(children, r.brief!.citations)}</li>,
                    }}
                  >
                    {r.brief.content_md}
                  </ReactMarkdown>
                </article>
                {r.brief.citations.length > 0 && (
                  <div className="mt-5 border-t border-line pt-3">
                    <div className="label">Sources retrieved (RAG)</div>
                    <ol className="flex flex-col gap-1.5 text-xs">
                      {r.brief.citations.map((c) => (
                        <li key={c.label} className="text-mute">
                          <span className="font-mono text-accent">{c.label}</span> {c.title} <span className="text-faint">(relevance {c.score})</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </Section>

          <Section title="What citizens are saying">
            <div className="grid gap-3 md:grid-cols-3">
              {r.quotes.map((q) => (
                <figure key={q.id} className="card-2 flex flex-col gap-2 p-3">
                  <blockquote className="text-sm leading-relaxed text-ink">“{q.original}”</blockquote>
                  {q.language !== "en" && <figcaption className="text-xs italic text-mute">{q.english}</figcaption>}
                  <div className="mt-auto flex items-center gap-2 text-[11px] text-faint">
                    <span>{LANG_LABEL[q.language] ?? q.language}</span>
                    <UrgencyBadge u={q.urgency} />
                  </div>
                </figure>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-mute">
              Languages in this area:
              {r.languages.map((l) => <span key={l.k} className="chip">{LANG_LABEL[l.k] ?? l.k}: {l.n}</span>)}
            </div>
          </Section>

          <Section title="Requests per month in this area">
            <TrendArea data={r.monthly} x="m" y="n" label="Requests" height={180} xFormat={(v) => new Date(v).toLocaleDateString("en", { month: "short", year: "2-digit" })} />
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card no-print h-72 overflow-hidden">
            <HexMap center={center} zoom={11.6} cells={cells} normalize="fixed100" interactive />
          </div>

          {canDecide && (
            <Section title="Decision" className="no-print">
              <textarea className="input mb-3 h-20 resize-none" placeholder="Decision note (visible in the public ledger)…" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="grid grid-cols-3 gap-2">
                <button className="btn-ok" onClick={() => decide("accepted")} disabled={!!busy}><Check className="h-4 w-4" /> Accept</button>
                <button className="btn-ghost" onClick={() => decide("deferred")} disabled={!!busy}><Clock className="h-4 w-4" /> Defer</button>
                <button className="btn-danger" onClick={() => decide("rejected")} disabled={!!busy}><X className="h-4 w-4" /> Reject</button>
              </div>
              {msg && <p className="mt-3 flex items-start gap-1.5 text-xs text-accent"><Hash className="mt-0.5 h-3.5 w-3.5 shrink-0" />{msg}</p>}
              <p className="mt-3 text-[11px] text-faint">Accepting links the area&apos;s open requests to this project and notifies citizens who left a reply channel.</p>
            </Section>
          )}

          <Section title="Infrastructure gap">
            {Object.entries(r.gap_summary).map(([k, g]) => (
              <div key={k} className="text-sm">
                <div className="text-mute">{k.replace(/_/g, " ")}{g.isProxy && <span className="chip ml-2">proxy</span>}</div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-mono text-2xl text-ink">{g.area}</span>
                  <span className="text-xs text-mute">here vs <span className="font-mono text-ink">{g.regionMedian}</span> regional median</span>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Overlapping government plans">
            {r.overlapping_projects.length === 0 ? (
              <p className="text-sm text-mute">No planned or ongoing project in this sector covers the area. This is an unfunded gap.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {r.overlapping_projects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2 text-xs">
                    <span className="text-ink">{p.title}</span>
                    <span className="flex items-center gap-2 whitespace-nowrap text-mute">{p.currency} {fmtCompact(p.budget)} <StatusBadge s={p.status} /></span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {r.history.length > 0 && (
            <Section title="Decision history">
              <ol className="flex flex-col gap-2 text-xs">
                {r.history.map((h) => (
                  <li key={h.seq} className="rounded-lg border border-line p-2">
                    <div className="flex justify-between text-mute"><span>{h.action.replace("recommendation.", "")} by {h.user_email}</span><span>{new Date(h.at).toLocaleString()}</span></div>
                    {h.diff.note && <div className="mt-1 text-ink">“{h.diff.note}”</div>}
                    <div className="mt-1 font-mono text-[10px] text-faint">#{h.seq} · {h.hash.slice(0, 24)}…</div>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Replace [D1] markers inside rendered text with hoverable citation chips. */
function cite(children: ReactNode, cites: Citation[]): ReactNode {
  const walk = (n: ReactNode): ReactNode => {
    if (typeof n === "string") {
      const parts = n.split(/(\[D\d+\])/g);
      return parts.map((p, i) => {
        const c = cites.find((x) => x.label === p);
        return c ? (
          <span key={i} title={`${c.title}\n\n${c.excerpt}`} className="mx-0.5 cursor-help rounded bg-accent/15 px-1 font-mono text-[11px] text-accent">
            {p.slice(1, -1)}
          </span>
        ) : (
          p
        );
      });
    }
    if (Array.isArray(n)) return n.map((x, i) => <span key={i}>{walk(x)}</span>);
    return n;
  };
  return walk(children);
}
