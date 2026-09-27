"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/lib/client/hooks";
import { cx } from "./ui";

// Validated dark categorical slots (dataviz reference palette, checked against our #0c1320 surface).
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
export const DIVERGE = { pos: "#3987e5", neg: "#e66767", mid: "#383835" };
export const SEQ = "#22d3ee";

const axis = { stroke: "#5d6e8e", fontSize: 11, tickLine: false, axisLine: false } as const;

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line-2 bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-medium text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-mute">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-4 font-mono text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Single-series area over time with crosshair tooltip. */
export function TrendArea({ data, x, y, label, height = 220, color = SEQ, xFormat }: {
  data: Record<string, unknown>[];
  x: string;
  y: string;
  label: string;
  height?: number;
  color?: string;
  xFormat?: (v: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${y}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.35} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1d2a42" vertical={false} />
        <XAxis dataKey={x} {...axis} tickFormatter={xFormat} minTickGap={24} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: "#93a3c0", strokeDasharray: "3 3" }}
          content={({ active, payload, label: l }) =>
            active && payload?.length ? <TipBox title={xFormat ? xFormat(String(l)) : String(l)} rows={[{ label, value: fmt(Number(payload[0].value)), color }]} /> : null
          }
        />
        <Area type="monotone" dataKey={y} stroke={color} strokeWidth={2} fill={`url(#g-${y})`} activeDot={{ r: 4, stroke: "#0c1320", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Two series on one axis (e.g. project footprint vs control). */
export function TwoLines({ data, x, a, b, height = 180, xLabel, refX }: {
  data: Record<string, unknown>[];
  x: string;
  a: { key: string; label: string };
  b: { key: string; label: string };
  height?: number;
  xLabel?: (v: string) => string;
  refX?: number | string;
}) {
  return (
    <div>
      <div className="mb-1 flex gap-4 text-[11px] text-mute">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: SERIES[0] }} />{a.label}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: SERIES[1] }} />{b.label}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#1d2a42" vertical={false} />
          <XAxis dataKey={x} {...axis} tickFormatter={xLabel} />
          <YAxis {...axis} />
          {refX !== undefined && <ReferenceLine x={refX} stroke="#93a3c0" strokeDasharray="4 4" label={{ value: "completed", fill: "#93a3c0", fontSize: 10, position: "top" }} />}
          <Tooltip
            cursor={{ stroke: "#93a3c0", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox
                  title={xLabel ? xLabel(String(label)) : String(label)}
                  rows={payload.map((p, i) => ({ label: i === 0 ? a.label : b.label, value: fmt(Number(p.value), 3), color: SERIES[i] }))}
                />
              ) : null
            }
          />
          <Line type="monotone" dataKey={a.key} stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3, fill: SERIES[0], stroke: "#0c1320", strokeWidth: 2 }} />
          <Line type="monotone" dataKey={b.key} stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: SERIES[1], stroke: "#0c1320", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal magnitude bars in plain HTML: one hue, value labels in ink, hover titles. */
export function BarList({ rows, color = SEQ, format = (v: number) => fmt(v), max, onClick }: {
  rows: { key: string; label: React.ReactNode; value: number; hint?: string }[];
  color?: string;
  format?: (v: number) => string;
  max?: number;
  onClick?: (key: string) => void;
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          title={r.hint ?? `${format(r.value)}`}
          onClick={() => onClick?.(r.key)}
          className={cx("group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-left text-xs", !onClick && "cursor-default")}
        >
          <span className="truncate text-mute group-hover:text-ink">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-panel-3">
            <span className="block h-full rounded-r-[4px] transition-all group-hover:brightness-125" style={{ width: `${(r.value / m) * 100}%`, background: color }} />
          </span>
          <span className="font-mono tabular-nums text-ink">{format(r.value)}</span>
        </button>
      ))}
    </div>
  );
}

/** Diverging bars around zero: blue = demand exceeds investment (under-funded), red = over-funded. */
export function DivergingBars({ rows }: { rows: { key: string; label: React.ReactNode; value: number; hint: string }[] }) {
  const m = Math.max(0.01, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} title={r.hint} className="grid grid-cols-[minmax(0,10rem)_1fr_4rem] items-center gap-3 text-xs">
          <span className="truncate text-mute">{r.label}</span>
          <div className="relative flex h-5 items-center">
            <div className="absolute left-1/2 h-full w-px bg-line-2" />
            {r.value >= 0 ? (
              <div className="absolute left-1/2 h-3 rounded-r-[4px]" style={{ width: `${(r.value / m) * 50}%`, background: DIVERGE.pos }} />
            ) : (
              <div className="absolute right-1/2 h-3 rounded-l-[4px]" style={{ width: `${(-r.value / m) * 50}%`, background: DIVERGE.neg }} />
            )}
          </div>
          <span className="text-right font-mono tabular-nums text-ink">
            {r.value > 0 ? "+" : ""}
            {(r.value * 100).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
