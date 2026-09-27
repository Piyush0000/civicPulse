"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_REGION, getRegion, type RegionDef } from "../regions";

export class ClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new ClientError(res.status, (data as { error?: { message?: string } })?.error?.message || res.statusText);
  return data as T;
}

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const key = JSON.stringify(deps);
  const load = useCallback(async () => {
    void key; // refetch when caller-provided deps change
    if (!path) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError((e as Error).message);
      if ((e as ClientError).status === 401 && typeof window !== "undefined") window.location.assign(`${location.origin}/login?next=${encodeURIComponent(location.pathname)}`);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [path, key]);
  useEffect(() => {
    // Fetch-on-mount/change: the loading flag flips synchronously by design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

// ---------------------------------------------------------------- region context

type RegionCtx = { code: string; region: RegionDef; setCode: (c: string) => void };
const Ctx = createContext<RegionCtx>({ code: DEFAULT_REGION, region: getRegion(DEFAULT_REGION), setCode: () => {} });

export function RegionProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState(DEFAULT_REGION);
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("region");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("cp_region");
    } catch {
      /* storage blocked */
    }
    const c = fromUrl || stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c && getRegion(c).code === c) setCodeState(c);
  }, []);
  const setCode = (c: string) => {
    setCodeState(c);
    try {
      localStorage.setItem("cp_region", c);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ code, region: getRegion(code), setCode }}>{children}</Ctx.Provider>;
}

export const useRegion = () => useContext(Ctx);

// ---------------------------------------------------------------- live pulse (SSE locally, Supabase Realtime when configured)

export type PulseEvt = {
  type: "request" | "scores" | "decision" | "pipeline";
  region: string;
  id?: string;
  tracking?: string;
  category?: string;
  urgency?: string;
  language?: string;
  channel?: string;
  summary?: string;
  lat?: number | null;
  lng?: number | null;
  h3?: string | null;
  step?: string;
  status?: string;
  title?: string;
  at: string;
};

export function usePulse(region: string | null, onEvent: (e: PulseEvt) => void) {
  const cb = useRef(onEvent);
  useEffect(() => {
    cb.current = onEvent;
  }, [onEvent]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let cleanup = () => {};
    if (url && key) {
      let cancelled = false;
      import("@supabase/supabase-js").then(({ createClient }) => {
        if (cancelled) return;
        const sb = createClient(url, key);
        const ch = sb
          .channel("civicpulse")
          .on("broadcast", { event: "pulse" }, ({ payload }) => {
            const e = payload as PulseEvt;
            if (!region || e.region === region) cb.current(e);
          })
          .subscribe((s) => setConnected(s === "SUBSCRIBED"));
        cleanup = () => void sb.removeChannel(ch);
      });
      return () => {
        cancelled = true;
        cleanup();
      };
    }
    const es = new EventSource(`/api/v1/stream${region ? `?region=${region}` : ""}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try {
        cb.current(JSON.parse(m.data));
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [region]);
  return connected;
}

// ---------------------------------------------------------------- formatting

export const fmt = (n: number | null | undefined, d = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });

export const fmtCompact = (n: number | null | undefined) =>
  n === null || n === undefined ? "–" : Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtUsd = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `$${fmtCompact(n)}`);

export function timeAgo(d: string | Date): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.max(1, Math.round(s))}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  useEffect(() => {
    if (ms === null) return;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
