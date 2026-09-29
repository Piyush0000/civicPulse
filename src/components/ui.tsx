"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_META, catLabel, type Category } from "@/lib/categories";

export const cx = clsx;

export function catColor(c: string | null | undefined): string {
  return CATEGORY_META[(c || "other") as Category]?.color ?? "#94a3b8";
}

export function CatBadge({ c, lang = "en", className }: { c: string | null | undefined; lang?: string; className?: string }) {
  const col = catColor(c);
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", className)}
      style={{ background: `${col}1f`, color: col, border: `1px solid ${col}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: col }} />
      {c ? catLabel(c, lang) : "…"}
    </span>
  );
}

const URG: Record<string, string> = { critical: "#fb7185", high: "#fb923c", medium: "#fbbf24", low: "#94a3b8" };
export function UrgencyBadge({ u }: { u: string | null | undefined }) {
  const col = URG[u || "low"] ?? "#94a3b8";
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${col}1a`, color: col }}>
      {u || "–"}
    </span>
  );
}

const ST: Record<string, string> = {
  proposed: "#93a3c0", accepted: "#34d399", rejected: "#fb7185", deferred: "#fbbf24",
  new: "#93a3c0", under_review: "#22d3ee", linked_to_project: "#a78bfa", resolved: "#34d399",
  completed: "#34d399", failed: "#fb7185", planned: "#93a3c0", approved: "#22d3ee", in_progress: "#fbbf24",
};
export function StatusBadge({ s }: { s: string | null | undefined }) {
  const col = ST[s || ""] ?? "#93a3c0";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap" style={{ background: `${col}17`, color: col, border: `1px solid ${col}33` }}>
      {(s || "–").replace(/_/g, " ")}
    </span>
  );
}

export function Kpi({ label, value, sub, accent, icon }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; icon?: ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent ?? "var(--accent)"}, transparent)` }} />
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-mute">
        {label}
        {icon && <span style={{ color: accent ?? "var(--accent)" }}>{icon}</span>}
      </div>
      <div className="kpi mt-2">{value}</div>
      {sub && <div className="mt-1 text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function Section({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("card p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-mute">
      <Loader2 className="h-4 w-4 animate-spin" /> {label ?? "Loading…"}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{msg}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line-2 p-6 text-center text-sm text-mute">{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-shimmer rounded-md", className)} />;
}

/** Horizontal meter for 0..1 values. */
export function Meter({ v, color = "var(--accent)", className }: { v: number; color?: string; className?: string }) {
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-panel-3", className)}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }} />
    </div>
  );
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const col = score >= 80 ? "#fb7185" : score >= 65 ? "#fb923c" : score >= 50 ? "#fbbf24" : "#22d3ee";
  return (
    <svg width={size} height={size} className="shrink-0" role="img" aria-label={`Priority score ${score.toFixed(0)} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={col}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" className="fill-ink font-mono text-[13px] font-semibold">
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

export const LANG_LABEL: Record<string, string> = { en: "English", hi: "Hindi", pt: "Portuguese", ru: "Russian", zh: "Chinese", zu: "isiZulu", und: "Unknown" };
