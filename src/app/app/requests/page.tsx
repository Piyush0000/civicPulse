"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPinOff, Search, X } from "lucide-react";
import { CATEGORIES, catLabel } from "@/lib/categories";
import { api, fmt, timeAgo, useApi, useRegion } from "@/lib/client/hooks";
import { CatBadge, Empty, ErrorBox, LANG_LABEL, Spinner, StatusBadge, UrgencyBadge, cx } from "@/components/ui";

type Row = {
  id: string; tracking_code: string; channel: string; language_detected: string; category: string; subcategory: string; urgency: string; summary: string;
  admin_name: string | null; location_precision: string; status: string; pipeline_status: string; extraction_confidence: number; submitted_at: string;
  is_synthetic: boolean; is_spam: boolean; is_actionable: boolean;
};
type Detail = Row & {
  text_original_redacted: string; text_english_redacted: string; urgency_reason: string; affected_group: string; location_text: string | null;
  lat: number | null; lng: number | null; h3_cell: string | null; pipeline_log: { step: string; ms: number; info?: string }[]; pipeline_error: string | null;
  extraction_provider: string; analyst_overrides: Record<string, unknown> | null;
  cluster: { id: string; label: string; request_count: number; unique_reporter_count: number } | null;
  siblings: { id: string; tracking_code: string; language_detected: string; summary: string; urgency: string; submitted_at: string }[];
};

function RequestsInner() {
  const { code, region } = useRegion();
  const sp = useSearchParams();
  const [f, setF] = useState({ q: "", category: "", urgency: "", status: "", channel: "", language: "", pipeline: sp.get("pipeline") || "", unlocated: false, live: false });
  const [open, setOpen] = useState<string | null>(null);
  // Page resets whenever filters or region change (derived, no effect needed).
  const filterKey = JSON.stringify(f) + code;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (n: number) => setPageState({ key: filterKey, page: n });
  const qs = new URLSearchParams({ region: code, page: String(page), page_size: "40" });
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, String(v));
  const list = useApi<{ total: number; rows: Row[] }>(`/requests?${qs}`, [qs.toString()]);
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 40));

  const sel = (k: keyof typeof f, opts: { v: string; l: string }[], label: string) => (
    <select className="input w-auto py-1.5 text-xs" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={label}>
      <option value="">{label}</option>
      {opts.map((o) => (
        <option key={o.v} value={o.v}>{o.l}</option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Citizen requests</h1>
          <p className="text-sm text-mute">{region.name} · every message is PII-redacted; reporters are pseudonymous and cannot be searched.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setF({ ...f, unlocated: !f.unlocated })} className={cx("btn-ghost text-xs", f.unlocated && "border-warn/50 text-warn")}>
            <MapPinOff className="h-4 w-4" /> Unlocated queue
          </button>
          <button onClick={() => setF({ ...f, live: !f.live })} className={cx("btn-ghost text-xs", f.live && "border-accent/50 text-accent")}>
            Live intakes only
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint" />
          <input className="input pl-9" placeholder="Search text, summary or tracking ID…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        {sel("category", CATEGORIES.map((c) => ({ v: c, l: catLabel(c) })), "Category")}
        {sel("urgency", ["critical", "high", "medium", "low"].map((v) => ({ v, l: v })), "Urgency")}
        {sel("status", ["new", "under_review", "linked_to_project", "resolved", "rejected"].map((v) => ({ v, l: v.replace(/_/g, " ") })), "Status")}
        {sel("channel", ["web", "telegram", "ivr", "ussd", "sms"].map((v) => ({ v, l: v.toUpperCase() })), "Channel")}
        {sel("language", region.languages.map((v) => ({ v, l: LANG_LABEL[v] ?? v })), "Language")}
        {sel("pipeline", ["received", "completed", "failed"].map((v) => ({ v, l: v })), "Pipeline")}
      </div>

      <div className="card overflow-hidden">
        {list.error && <ErrorBox msg={list.error} />}
        {!list.data && !list.error && <Spinner />}
        {list.data && list.data.rows.length === 0 && <div className="p-4"><Empty>No requests match these filters.</Empty></div>}
        {list.data && list.data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tracking</th>
                  <th className="px-2 py-2.5 font-medium">Summary</th>
                  <th className="px-2 py-2.5 font-medium">Category</th>
                  <th className="px-2 py-2.5 font-medium">Urgency</th>
                  <th className="px-2 py-2.5 font-medium">Area</th>
                  <th className="px-2 py-2.5 font-medium">Lang · channel</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data.rows.map((r) => (
                  <tr key={r.id} onClick={() => setOpen(r.id)} className={cx("cursor-pointer hover:bg-panel-2", open === r.id && "bg-panel-2")}>
                    <td className="px-4 py-2.5 font-mono text-xs text-mute">
                      {r.tracking_code}
                      {!r.is_synthetic && <span className="ml-1.5 rounded bg-accent/15 px-1 text-[10px] text-accent">LIVE</span>}
                    </td>
                    <td className="max-w-[420px] truncate px-2 py-2.5 text-ink">{r.summary ?? <span className="text-faint">processing…</span>}</td>
                    <td className="px-2 py-2.5"><CatBadge c={r.category} /></td>
                    <td className="px-2 py-2.5"><UrgencyBadge u={r.urgency} /></td>
                    <td className="px-2 py-2.5 text-xs text-mute">{r.admin_name ?? <span className="text-warn">unlocated</span>}</td>
                    <td className="px-2 py-2.5 text-xs text-mute">{LANG_LABEL[r.language_detected] ?? r.language_detected} · {r.channel}</td>
                    <td className="px-2 py-2.5">{r.pipeline_status === "failed" ? <StatusBadge s="failed" /> : <StatusBadge s={r.status} />}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-faint">{timeAgo(r.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-mute">
          <span>{fmt(list.data?.total)} requests</span>
          <div className="flex items-center gap-2">
            <button className="rounded p-1 hover:bg-panel-2 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <span>{page} / {pages}</span>
            <button className="rounded p-1 hover:bg-panel-2 disabled:opacity-30" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      {open && <Drawer id={open} region={code} onClose={() => setOpen(null)} onSaved={() => list.reload()} />}
    </div>
  );
}

function Drawer({ id, region, onClose, onSaved }: { id: string; region: string; onClose: () => void; onSaved: () => void }) {
  const d = useApi<Detail>(`/requests/${id}?region=${region}`, [id]);
  const me = useApi<{ user: { role: string } }>("/auth/me");
  const canEdit = me.data && ["admin", "analyst"].includes(me.data.user.role);
  const [msg, setMsg] = useState<string | null>(null);
  const [pin, setPin] = useState({ lat: "", lng: "" });

  const patch = async (body: Record<string, unknown>) => {
    setMsg(null);
    try {
      const r = await api<Detail>(`/requests/${id}?region=${region}`, { method: "PATCH", json: body });
      d.setData(r);
      setMsg("Saved. Scores will refresh in a few seconds. Change recorded in the ledger.");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const r = d.data;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="font-mono text-sm text-accent">{r?.tracking_code}</div>
            <div className="text-xs text-mute">{r && `${new Date(r.submitted_at).toLocaleString()} · ${r.channel.toUpperCase()} · ${LANG_LABEL[r.language_detected] ?? r.language_detected}`}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-mute hover:bg-panel-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {!r && <Spinner />}
        {r && (
          <div className="flex flex-col gap-4">
            <div className="card-2 p-4">
              <div className="label">Original (redacted)</div>
              <p className="text-[15px] leading-relaxed text-ink">{r.text_original_redacted ?? "…"}</p>
              {r.language_detected !== "en" && (
                <>
                  <div className="label mt-3">English pivot</div>
                  <p className="text-sm italic text-mute">{r.text_english_redacted}</p>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field k="Category"><CatBadge c={r.category} /> <span className="ml-1 text-xs text-mute">{r.subcategory}</span></Field>
              <Field k="Urgency"><UrgencyBadge u={r.urgency} /> <span className="ml-1 text-xs text-mute">{r.urgency_reason}</span></Field>
              <Field k="Summary" wide>{r.summary}</Field>
              <Field k="Affected">{r.affected_group}</Field>
              <Field k="Location">{r.admin_name ?? <span className="text-warn">unlocated</span>} <span className="text-xs text-faint">({r.location_precision})</span></Field>
              <Field k="Confidence">{r.extraction_confidence != null ? `${Math.round(r.extraction_confidence * 100)}%` : "–"}</Field>
            </div>
            {r.pipeline_log?.length > 0 && (
              <div>
                <div className="label">AI pipeline trace</div>
                <ol className="flex flex-col gap-1 text-xs">
                  {r.pipeline_log.map((s, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={cx("h-1.5 w-1.5 rounded-full", s.step === "failed" ? "bg-bad" : "bg-ok")} />
                      <span className="w-20 text-mute">{s.step}</span>
                      <span className="flex-1 truncate text-ink">{traceInfo(s.step, s.info)}</span>
                      <span className="font-mono text-faint">{s.ms}ms</span>
                    </li>
                  ))}
                </ol>
                {r.pipeline_error && <ErrorBox msg={r.pipeline_error} />}
              </div>
            )}
            {r.cluster && (
              <div>
                <div className="label">Demand signal (cluster): {r.cluster.request_count} requests, {r.cluster.unique_reporter_count} people</div>
                <div className="flex flex-col gap-1.5">
                  {r.siblings.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg border border-line p-2 text-xs">
                      <span className="font-mono text-faint">{s.tracking_code}</span>
                      <span className="flex-1 truncate text-mute">{s.summary}</span>
                      <UrgencyBadge u={s.urgency} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {canEdit ? (
              <div className="card-2 flex flex-col gap-3 p-4">
                <div className="label">Analyst corrections (audited)</div>
                <div className="grid grid-cols-3 gap-2">
                  <select className="input text-xs" value={r.category} onChange={(e) => patch({ category: e.target.value })} aria-label="Category">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
                  </select>
                  <select className="input text-xs" value={r.urgency} onChange={(e) => patch({ urgency: e.target.value })} aria-label="Urgency">
                    {["low", "medium", "high", "critical"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <select className="input text-xs" value={r.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Status">
                    {["new", "under_review", "linked_to_project", "resolved", "rejected"].map((u) => <option key={u} value={u}>{u.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input className="input text-xs" placeholder="lat" value={pin.lat} onChange={(e) => setPin({ ...pin, lat: e.target.value })} />
                  <input className="input text-xs" placeholder="lng" value={pin.lng} onChange={(e) => setPin({ ...pin, lng: e.target.value })} />
                  <button className="btn-ghost shrink-0 text-xs" onClick={() => patch({ lat: Number(pin.lat), lng: Number(pin.lng) })} disabled={!pin.lat || !pin.lng}>Pin</button>
                </div>
                {msg && <p className="text-xs text-accent">{msg}</p>}
              </div>
            ) : (
              <p className="text-xs text-faint">Policymakers can view requests; corrections are made by analysts.</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/** Pipeline trace for officials: show what happened, not which AI vendor did it. */
function traceInfo(step: string, info?: string): string {
  if (!info) return "";
  if (step === "extracted") return info.split("→").pop()!.trim();
  if (step === "transcribed") return info === "none" ? "no transcript" : "speech converted to text";
  if (step === "translated") return info === "identity" ? "already English" : info === "none" ? "not translated" : "translated to English";
  return info;
}

function Field({ k, children, wide }: { k: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cx(wide && "col-span-2")}>
      <div className="label">{k}</div>
      <div className="text-ink">{children}</div>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsInner />
    </Suspense>
  );
}
