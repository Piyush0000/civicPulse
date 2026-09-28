"use client";

import { useState } from "react";
import { Check, Clock, Hash, HardHat, Send, ShieldAlert, ShieldCheck, Star, X } from "lucide-react";
import { api, timeAgo } from "@/lib/client/hooks";
import { Section, cx } from "./ui";

export type GovRec = {
  id: string;
  status: string;
  work_stage: string;
  endorsed_by: string | null;
  endorsed_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  work_started_at: string | null;
  work_done_at: string | null;
  work_note: string | null;
  contractor: string | null;
  scheme: string | null;
  sanctioned_inr: number | null;
  feedback: {
    responses: number;
    eligible: number;
    satisfaction: number;
    avgRating: number;
    counts: { yes: number; partly: number; no: number };
    comments: { solved: string; rating: number; comment: string }[];
  };
};

const inr = (x: number) => `₹${(x / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} crore`;

/** MP endorses → CM's office approves → department executes → citizens verify. Each step is ledgered. */
export default function GovernancePanel({ rec, role, region, onChange }: { rec: GovRec; role: string | undefined; region: string; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [contractor, setContractor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (key: string, fn: () => Promise<{ ledger?: { seq: number; hash: string }; seq?: number; hash?: string }>) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      const l = r.ledger ?? (r.seq ? { seq: r.seq, hash: r.hash! } : null);
      setMsg(l ? `Recorded in ledger entry #${l.seq} (${l.hash.slice(0, 12)}…)` : "Saved.");
      setNote("");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const approved = rec.status === "accepted";
  const stageIdx = { none: 0, approved: 1, work_started: 2, work_done: 3, verified: 4, disputed: 4 }[rec.work_stage] ?? 0;
  const steps = [
    { k: "Endorsed by MP/MLA", done: !!rec.endorsed_by, sub: rec.endorsed_by ? `${rec.endorsed_by} · ${timeAgo(rec.endorsed_at!)}` : "optional" },
    { k: "Approved by CM's office", done: approved, sub: approved ? `${rec.decided_by} · ${timeAgo(rec.decided_at!)}` : rec.status !== "proposed" ? rec.status : "pending" },
    { k: "Work started", done: stageIdx >= 2, sub: rec.work_started_at ? `${rec.contractor ?? ""} · ${timeAgo(rec.work_started_at)}` : "" },
    { k: "Work reported done", done: stageIdx >= 3, sub: rec.work_done_at ? timeAgo(rec.work_done_at) : "" },
    {
      k: rec.work_stage === "disputed" ? "Citizens: NOT fixed" : "Citizens verified",
      done: stageIdx >= 4,
      bad: rec.work_stage === "disputed",
      sub: rec.feedback.responses ? `${rec.feedback.responses} residents · ${Math.round(rec.feedback.satisfaction * 100)}% satisfied` : "",
    },
  ];

  return (
    <Section title="Governance loop" className="no-print">
      <ol className="mb-4 flex flex-col">
        {steps.map((s, i) => (
          <li key={s.k} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && <span className={cx("absolute left-[9px] top-5 h-full w-0.5", s.done ? "bg-accent" : "bg-line-2")} />}
            <span className={cx("z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", s.done ? ("bad" in s && s.bad ? "border-bad bg-bad text-[#04121a]" : "border-accent bg-accent text-[#04121a]") : "border-line-2 bg-panel")}>
              {s.done && ("bad" in s && s.bad ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
            </span>
            <div className="text-sm">
              <div className={cx(s.done ? "text-ink" : "text-faint")}>{s.k}</div>
              {s.sub && <div className="text-[11px] text-mute">{s.sub}</div>}
            </div>
          </li>
        ))}
      </ol>

      {rec.scheme && (
        <div className="mb-4 rounded-lg border border-line bg-panel-2 p-3 text-xs">
          <div className="text-faint">Funding route</div>
          <div className="text-ink">{rec.scheme}</div>
          {rec.sanctioned_inr ? <div className="text-mute">Indicative sanction {inr(rec.sanctioned_inr)}</div> : null}
        </div>
      )}

      {/* MP / MLA: endorse to the CM */}
      {role === "policymaker" && !approved && !rec.endorsed_by && (
        <div className="flex flex-col gap-2">
          <textarea className="input h-16 resize-none text-sm" placeholder="Note to the CM's office (why this matters for your constituency)…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary" disabled={!!busy} onClick={() => call("endorse", () => api(`/recommendations/${rec.id}/endorse?region=${region}`, { method: "POST", json: { note } }))}>
            <Send className="h-4 w-4" /> Endorse & forward to CM
          </button>
        </div>
      )}

      {/* CM's office: approve / defer / reject */}
      {(role === "cm" || role === "admin") && !approved && (
        <div className="flex flex-col gap-2">
          <textarea className="input h-16 resize-none text-sm" placeholder="Decision note (public in the ledger)…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-ok" disabled={!!busy} onClick={() => call("a", () => api(`/recommendations/${rec.id}?region=${region}`, { method: "PATCH", json: { status: "accepted", note } }))}><Check className="h-4 w-4" /> Approve</button>
            <button className="btn-ghost" disabled={!!busy} onClick={() => call("d", () => api(`/recommendations/${rec.id}?region=${region}`, { method: "PATCH", json: { status: "deferred", note } }))}><Clock className="h-4 w-4" /> Defer</button>
            <button className="btn-danger" disabled={!!busy} onClick={() => call("r", () => api(`/recommendations/${rec.id}?region=${region}`, { method: "PATCH", json: { status: "rejected", note } }))}><X className="h-4 w-4" /> Reject</button>
          </div>
        </div>
      )}

      {/* Department: report execution */}
      {(role === "analyst" || role === "admin") && approved && ["approved", "work_started", "disputed"].includes(rec.work_stage) && (
        <div className="mt-2 flex flex-col gap-2">
          {rec.work_stage === "approved" && <input className="input text-sm" placeholder="Contractor / agency" value={contractor} onChange={(e) => setContractor(e.target.value)} />}
          <textarea className="input h-16 resize-none text-sm" placeholder={rec.work_stage === "disputed" ? "What was redone after citizens disputed the work?" : "Progress / completion note"} value={note} onChange={(e) => setNote(e.target.value)} />
          {rec.work_stage === "approved" ? (
            <button className="btn-primary" disabled={!!busy} onClick={() => call("start", () => api(`/recommendations/${rec.id}/work?region=${region}`, { method: "PATCH", json: { stage: "work_started", note, contractor } }))}>
              <HardHat className="h-4 w-4" /> Mark work started
            </button>
          ) : (
            <button className="btn-ok" disabled={!!busy} onClick={() => call("done", () => api(`/recommendations/${rec.id}/work?region=${region}`, { method: "PATCH", json: { stage: "work_done", note } }))}>
              <Check className="h-4 w-4" /> Mark work done → ask citizens to verify
            </button>
          )}
        </div>
      )}

      {msg && <p className="mt-3 flex items-start gap-1.5 text-xs text-accent"><Hash className="mt-0.5 h-3.5 w-3.5 shrink-0" />{msg}</p>}

      {/* Citizen verification */}
      {stageIdx >= 3 && (
        <div className={cx("mt-4 rounded-xl border p-3", rec.work_stage === "disputed" ? "border-bad/50 bg-bad/10" : rec.work_stage === "verified" ? "border-ok/40 bg-ok/10" : "border-line")}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {rec.work_stage === "disputed" ? <ShieldAlert className="h-4 w-4 text-bad" /> : <ShieldCheck className="h-4 w-4 text-ok" />}
            {rec.work_stage === "disputed" ? "Residents say the problem is NOT fixed" : rec.work_stage === "verified" ? "Residents confirm the work is done" : "Waiting for residents to verify"}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
            <div><div className="font-mono text-ink">{rec.feedback.responses}/{rec.feedback.eligible}</div><div className="text-faint">responded</div></div>
            <div><div className="font-mono text-ok">{rec.feedback.counts.yes}</div><div className="text-faint">fixed</div></div>
            <div><div className="font-mono text-warn">{rec.feedback.counts.partly}</div><div className="text-faint">partly</div></div>
            <div><div className="font-mono text-bad">{rec.feedback.counts.no}</div><div className="text-faint">not fixed</div></div>
          </div>
          {rec.feedback.responses > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-mute">
              <Star className="h-3.5 w-3.5 fill-warn text-warn" /> {rec.feedback.avgRating} average rating
            </div>
          )}
          {rec.feedback.comments.slice(0, 3).map((c, i) => (
            <p key={i} className="mt-2 border-l-2 border-line-2 pl-2 text-xs italic text-mute">“{c.comment}” <span className="not-italic text-faint">({c.solved})</span></p>
          ))}
        </div>
      )}
    </Section>
  );
}
