"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardCheck, HardHat, LogOut, MapPin, Mic, Star, Trophy } from "lucide-react";
import { api, timeAgo, useApi } from "@/lib/client/hooks";
import { getRegion } from "@/lib/regions";
import { PulseLogo } from "@/components/AppShell";
import FeedbackForm from "@/components/FeedbackForm";
import { CatBadge, Empty, Spinner, StatusBadge, UrgencyBadge, cx } from "@/components/ui";

type Complaint = {
  tracking_code: string; region_code: string; category: string; urgency: string; summary: string | null; status: string; pipeline_status: string;
  admin_name: string | null; submitted_at: string; photo_url: string | null; rec_title: string | null; work_stage: string | null; my_solved: string | null; my_rating: number | null;
};
type Me = { user: { name: string; region: string }; complaints: Complaint[] };
type Zone = { rank: number; zone: string; needScore: number; complaints90d: number; per10k: number; serviceStars: number; priorityZone: boolean; satisfaction: number | null };

const STAGE: Record<string, { label: string; tone: string }> = {
  approved: { label: "Approved by CM's office", tone: "text-accent" },
  work_started: { label: "Work in progress", tone: "text-warn" },
  work_done: { label: "Work reported done: please verify", tone: "text-accent" },
  verified: { label: "Verified fixed by residents", tone: "text-ok" },
  disputed: { label: "Residents say NOT fixed: reopened", tone: "text-bad" },
};

export default function CitizenHome() {
  const router = useRouter();
  const me = useApi<Me>("/citizen/me");
  const region = me.data ? getRegion(me.data.user.region) : null;
  const zones = useApi<Zone[]>(region ? `/public/zones/${region.code}` : null, [region?.code]);
  const [open, setOpen] = useState<string | null>(null);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    router.push("/");
  };
  if (!me.data) return <Spinner />;
  const c = me.data.complaints;
  const myZones = new Set(c.map((x) => x.admin_name).filter(Boolean));

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #0e2236 0%, var(--bg) 55%)" }}>
      <header className="border-b border-line/60 bg-bg/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2"><PulseLogo size={26} /><span className="font-semibold">CivicPulse</span></Link>
          <span className="chip ml-2">Citizen</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-mute sm:inline">{me.data.user.name}</span>
            <button onClick={logout} className="rounded-lg p-2 text-mute hover:bg-panel-2" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Namaste, {me.data.user.name.split(" ")[0]} 👋</h1>
            <p className="mt-1 text-mute">{region?.name}: follow your complaints from report to verified fix.</p>
          </div>
          <Link href="/submit" className="btn-primary"><Mic className="h-4 w-4" /> Report a new problem</Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={<ClipboardCheck className="h-4 w-4" />} k="My complaints" v={c.length} />
          <Stat icon={<HardHat className="h-4 w-4" />} k="In government work" v={c.filter((x) => x.work_stage && x.work_stage !== "none").length} />
          <Stat icon={<Star className="h-4 w-4" />} k="Awaiting my verification" v={c.filter((x) => x.status === "resolved" && x.rec_title && !x.my_solved).length} />
        </div>

        <h2 className="mt-8 text-lg font-semibold">My complaints</h2>
        <div className="mt-3 flex flex-col gap-3">
          {c.length === 0 && <Empty>No complaints yet. Reports you send while logged in appear here.</Empty>}
          {c.map((x) => {
            const st = x.work_stage ? STAGE[x.work_stage] : null;
            const canVerify = x.status === "resolved" && !!x.rec_title && !x.my_solved;
            return (
              <div key={x.tracking_code} className={cx("card p-4", canVerify && "border-accent/50")}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                  <Link href={`/track/${x.tracking_code}`} className="font-mono text-accent hover:underline">{x.tracking_code}</Link>
                  <span>{timeAgo(x.submitted_at)}</span>
                  {x.admin_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{x.admin_name}</span>}
                  <span className="ml-auto"><StatusBadge s={x.status} /></span>
                </div>
                <p className="mt-2 text-ink">{x.summary ?? "Being processed…"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CatBadge c={x.category} />
                  <UrgencyBadge u={x.urgency} />
                </div>
                {x.rec_title && (
                  <div className="mt-3 rounded-lg border border-line bg-panel-2 p-3 text-sm">
                    <div className="text-xs text-faint">Linked government project</div>
                    <div className="text-ink">{x.rec_title}</div>
                    {st && <div className={cx("mt-1 text-xs font-medium", st.tone)}>{st.label}</div>}
                    {x.my_solved && <div className="mt-1 text-xs text-mute">You said: {x.my_solved} · {"★".repeat(x.my_rating ?? 0)}</div>}
                  </div>
                )}
                {canVerify && (open === x.tracking_code ? (
                  <div className="mt-3"><FeedbackForm code={x.tracking_code} onDone={() => setTimeout(() => me.reload(), 2500)} /></div>
                ) : (
                  <button className="btn-primary mt-3 w-full" onClick={() => setOpen(x.tracking_code)}>Verify: is it really fixed?</button>
                ))}
              </div>
            );
          })}
        </div>

        <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5 text-warn" /> How areas in {region?.name} are doing</h2>
        <p className="text-sm text-mute">Ranked by need: complaints per resident, urgency, hotspots and unresolved backlog. Stars show how well each area is being served.</p>
        <div className="card mt-3 overflow-hidden">
          {!zones.data && <Spinner />}
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {zones.data?.slice(0, 12).map((z) => (
                <tr key={z.zone} className={cx(myZones.has(z.zone) && "bg-accent/5")}>
                  <td className="w-10 py-2 pl-4 font-mono text-faint">#{z.rank}</td>
                  <td className="py-2 text-ink">{z.zone}{myZones.has(z.zone) && <span className="chip ml-2 text-accent">your area</span>}{z.priorityZone && <span className="chip ml-2 border-bad/40 text-bad">priority</span>}</td>
                  <td className="py-2 text-right font-mono text-xs text-mute">{z.per10k}/10k</td>
                  <td className="py-2 pr-4 text-right text-warn">{"★".repeat(Math.floor(z.serviceStars))}{z.serviceStars % 1 ? "½" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon, k, v }: { icon: React.ReactNode; k: string; v: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-mute">{icon}{k}</div>
      <div className="kpi mt-1">{v}</div>
    </div>
  );
}
