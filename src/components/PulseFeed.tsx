"use client";

import { useCallback, useState } from "react";
import { Mic, MessageSquare, Phone, Radio, Send, Smartphone, Zap } from "lucide-react";
import { api, timeAgo, usePulse, type PulseEvt } from "@/lib/client/hooks";
import { CatBadge, UrgencyBadge, LANG_LABEL, cx } from "./ui";

const CH_ICON: Record<string, typeof Mic> = { telegram: Send, web: MessageSquare, ivr: Phone, ussd: Smartphone, sms: Smartphone };

export function useLiveFeed(region: string, max = 30) {
  const [items, setItems] = useState<PulseEvt[]>([]);
  const [steps, setSteps] = useState<Record<string, string>>({});
  const onEvent = useCallback(
    (e: PulseEvt) => {
      if (e.type === "request") setItems((x) => [e, ...x.filter((y) => y.id !== e.id)].slice(0, max));
      if (e.type === "pipeline" && e.tracking) setSteps((s) => ({ ...s, [e.tracking!]: e.step! }));
    },
    [max],
  );
  const connected = usePulse(region, onEvent);
  return { items, steps, connected };
}

export function SimulateButton({ region, onStarted, compact }: { region: string; onStarted?: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ scheduled: number; seconds: number }>(`/simulate/wave?region=${region}`, { method: "POST", json: { count: 14, seconds: 25 } });
      setMsg(`${r.scheduled} citizens incoming over ${r.seconds}s`);
      onStarted?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setTimeout(() => setBusy(false), 3000);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={go} disabled={busy} className={cx("btn-primary", compact && "px-3 py-1.5 text-xs")}>
        <Zap className="h-4 w-4" /> Simulate citizen wave
      </button>
      {msg && <span className="text-xs text-mute">{msg}</span>}
    </div>
  );
}

export function PulseFeed({ items, steps, connected, className }: { items: PulseEvt[]; steps?: Record<string, string>; connected: boolean; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 p-6 text-center text-xs text-mute">
          <Radio className={cx("h-5 w-5", connected ? "text-ok" : "text-faint")} />
          {connected ? "Listening for citizens… send a Telegram message, submit on /submit, dial the USSD simulator, or simulate a wave." : "Connecting to live stream…"}
        </div>
      )}
      {items.map((e) => {
        const Icon = CH_ICON[e.channel || "web"] ?? MessageSquare;
        return (
          <div key={e.id} className="cp-in card-2 p-3">
            <div className="flex items-center gap-2 text-[11px] text-mute">
              <Icon className="h-3.5 w-3.5" />
              <span className="font-mono">{e.tracking}</span>
              <span>· {LANG_LABEL[e.language || "und"] ?? e.language}</span>
              <span className="ml-auto">{timeAgo(e.at)}</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-sm text-ink">{e.summary ?? "New request received"}</div>
            <div className="mt-2 flex items-center gap-2">
              <CatBadge c={e.category} />
              <UrgencyBadge u={e.urgency} />
              {e.tracking && steps?.[e.tracking] && steps[e.tracking] !== "clustered" && <span className="chip">{steps[e.tracking]}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
