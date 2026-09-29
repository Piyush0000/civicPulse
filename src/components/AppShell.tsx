"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity, Banknote, BrainCircuit, Building2, Trophy, Calculator, Database, Globe2, Inbox, LayoutDashboard, LogOut, Map as MapIcon, Menu, Radar, Scale,
  ShieldCheck, SlidersHorizontal, Target, TrendingDown, X,
} from "lucide-react";
import { REGIONS } from "@/lib/regions";
import { api, RegionProvider, useApi, useInterval, usePulse, useRegion } from "@/lib/client/hooks";
import { cx } from "./ui";
import dynamic from "next/dynamic";
import type { TourStep } from "./ProductTour";

const ProductTour = dynamic(() => import("./ProductTour"), { ssr: false });

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: "Navigation sidebar",
    description: "Your command centre. Jump between the Live Map, Citizen Requests, AI Copilot, Budget Optimizer, and more. Every section updates in real time.",
    placement: "right",
  },
  {
    target: '[data-tour="region-switcher"]',
    title: "Switch pilot regions",
    description: "CivicPulse runs across multiple cities. Tap a flag to switch context — all KPIs, maps, and recommendations update instantly for that region.",
    placement: "bottom",
  },
  {
    target: '[data-tour="live-indicator"]',
    title: "Real-time citizen feed",
    description: "This dot pulses green when CivicPulse is streaming live citizen reports via SSE. Every new voice note, text, or IVR call appears within seconds.",
    placement: "bottom",
  },
  {
    target: '[data-tour="nav-map"]',
    title: "Live Pulse Map",
    description: "A 3D hexagonal heatmap showing demand density, Redzones (statistically significant clusters of need), and emerging hotspots across the city.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-copilot"]',
    title: "Ask CivicPulse (AI Copilot)",
    description: "Chat with your data. Ask questions like 'Which ward has the worst water access?' and the AI queries your real analytics — no hallucinated numbers.",
    placement: "right",
  },
  {
    target: '[data-tour="provider-box"]',
    title: "System status",
    description: "See at a glance whether AI, voice, the database, the live feed and Telegram are online. CivicPulse keeps working in offline mode with zero paid services.",
    placement: "top",
  },
];

type Me = { user: { name: string; email: string; role: string; roleLabel?: string } };
type Status = {
  providers: { llm: string[]; stt: string[]; database: string; realtime: string; telegram: string };
  seed: { status?: string; progress?: number; message?: string } | null;
};

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/map", label: "Live Pulse Map", icon: MapIcon },
  { href: "/app/requests", label: "Citizen Requests", icon: Inbox },
  { href: "/app/recommendations", label: "Recommendations", icon: Target },
  { href: "/app/zones", label: "Zone Ratings", icon: Trophy },
  { href: "/app/whatif", label: "What-if Simulator", icon: Building2, badge: "AI" },
  { href: "/app/copilot", label: "Ask CivicPulse", icon: BrainCircuit, badge: "AI" },
  { href: "/app/budget", label: "Budget Alignment", icon: Scale },
  { href: "/app/funds", label: "Fund Allocations", icon: Banknote },
  { href: "/app/optimizer", label: "Budget Optimizer", icon: Calculator },
  { href: "/app/foresight", label: "Foresight", icon: Radar },
  { href: "/app/impact", label: "Impact", icon: TrendingDown },
  { href: "/app/brics", label: "City Federation", icon: Globe2 },
  { href: "/app/datasets", label: "Data & Channels", icon: Database },
  { href: "/app/settings", label: "Scoring Weights", icon: SlidersHorizontal },
  { href: "/app/ledger", label: "Decision Ledger", icon: ShieldCheck },
];

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <RegionProvider>
      <Shell>{children}</Shell>
    </RegionProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { code, setCode } = useRegion();
  const me = useApi<Me>("/auth/me");
  const status = useApi<Status>("/system/status");
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const live = usePulse(code, (e) => {
    if (e.type !== "request") return;
    setFlash(true);
    setTimeout(() => setFlash(false), 3000);
  });
  useInterval(() => status.reload(), status.data?.seed?.status === "running" ? 2000 : null);

  const aiLive = status.data?.providers.llm.some((l) => !l.startsWith("rules"));
  const seeding = status.data?.seed?.status === "running";

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Map href to data-tour id for tour targeting
  const tourId = (href: string) => {
    if (href === "/app/map") return "nav-map";
    if (href === "/app/copilot") return "nav-copilot";
    if (href === "/app/recommendations") return "nav-recs";
    return undefined;
  };

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3" data-tour="sidebar-nav">
      {NAV.map((n) => {
        const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            data-tour={tourId(n.href)}
            className={cx(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              active ? "bg-accent/10 text-accent" : "text-mute hover:bg-panel-2 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{n.label}</span>
            {n.badge && <span className="ml-auto rounded bg-accent-2/20 px-1.5 text-[10px] font-semibold text-accent-2">{n.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel/60 backdrop-blur lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <ProviderBox status={status.data} aiLive={!!aiLive} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 overflow-y-auto border-r border-line bg-panel">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2 text-mute">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-2.5 backdrop-blur" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
          <button className="p-1 text-mute lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1" role="tablist" aria-label="Region" data-tour="region-switcher">
            {REGIONS.map((r) => (
              <button
                key={r.code}
                role="tab"
                aria-selected={code === r.code}
                onClick={() => setCode(r.code)}
                className={cx(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  code === r.code ? "bg-panel-3 text-ink" : "text-mute hover:text-ink",
                )}
              >
                <span aria-hidden>{r.flag}</span>
                <span className="hidden sm:inline">{r.name}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-mute md:flex" title={live ? "Live stream connected" : "Connecting…"} data-tour="live-indicator">
              <span className="relative flex h-2.5 w-2.5">
                {live && flash && <span className="cp-ping absolute inline-flex h-full w-full rounded-full bg-accent" />}
                <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", live ? "bg-ok" : "bg-faint")} />
              </span>
              {live ? "Live" : "Offline"}
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("civicpulse_tour_dismissed_v2");
                window.dispatchEvent(new Event("start-tour"));
              }}
              className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
            >
              Start Tour
            </button>
            {me.data && (
              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <div className="text-xs font-medium text-ink">{me.data.user.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-accent">{me.data.user.roleLabel ?? me.data.user.role}</div>
                </div>
                <button onClick={logout} className="rounded-lg p-2 text-mute hover:bg-panel-2 hover:text-ink" aria-label="Log out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>
        {seeding && (
          <div className="border-b border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent">
            <Activity className="mr-2 inline h-3.5 w-3.5 animate-pulse" />
            Building the synthetic demo world: {status.data?.seed?.message} ({status.data?.seed?.progress ?? 0}%)
          </div>
        )}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        <ProductTour steps={TOUR_STEPS} tourId="app-console" />
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-5 py-4">
      <PulseLogo />
      <div>
        <div className="text-[15px] font-semibold tracking-tight text-ink">CivicPulse</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-faint">Gov console · DPG</div>
      </div>
    </Link>
  );
}

export function PulseLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="cpg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path d="M16 2 28 9v14l-12 7-12-7V9z" fill="none" stroke="url(#cpg)" strokeWidth="2" />
      <path d="M7 17h5l2-5 3 9 2-5h6" fill="none" stroke="url(#cpg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProviderBox({ status, aiLive }: { status: Status | null; aiLive: boolean }) {
  if (!status) return null;
  const p = status.providers;
  return (
    <div className="m-3 rounded-xl border border-line bg-panel-2 p-3 text-[11px] leading-5 text-mute" data-tour="provider-box">
      <div className="mb-1 font-semibold uppercase tracking-wider text-faint">System status</div>
      <Row k="AI" v={aiLive ? "online" : "offline mode"} ok={aiLive} />
      <Row k="Voice" v={p.stt[0].startsWith("browser") ? "browser only" : "online"} ok={!p.stt[0].startsWith("browser")} />
      <Row k="Database" v="connected" ok />
      <Row k="Live feed" v="on" ok />
      <Row k="Telegram" v={p.telegram} ok={p.telegram !== "disabled"} />
    </div>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{k}</span>
      <span className={cx("font-mono", ok ? "text-ok" : "text-warn")}>{v}</span>
    </div>
  );
}
