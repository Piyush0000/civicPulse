"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";
import { api } from "@/lib/client/hooks";
import { cx } from "./ui";

/** "Is your problem actually fixed?" Citizen verification after the government marks work done. */
export default function FeedbackForm({ code, onDone }: { code: string; onDone?: () => void }) {
  const [solved, setSolved] = useState<"yes" | "partly" | "no" | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ verdict: { stage: string; responses: number; satisfaction: number } }>("/public/feedback", {
        method: "POST",
        json: { tracking_code: code, solved, rating, comment: comment || undefined },
      });
      setMsg(
        r.verdict.stage === "verified"
          ? "Thank you! Your neighbours agree the work is done. The project is marked VERIFIED."
          : r.verdict.stage === "disputed"
            ? "Thank you. Most residents say the problem is not fixed. The project is flagged DISPUTED and the department must revisit."
            : "Thank you! Your verification is recorded.",
      );
      onDone?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (msg && !msg.startsWith("Feedback")) return <p className="rounded-xl border border-ok/40 bg-ok/10 p-3 text-sm text-ok"><Check className="mr-1 inline h-4 w-4" />{msg}</p>;
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="font-medium text-ink">The government says the work is done. Is your problem actually fixed?</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {([
          { k: "yes", label: "Yes, fixed", cls: "border-ok/50 text-ok" },
          { k: "partly", label: "Partly", cls: "border-warn/50 text-warn" },
          { k: "no", label: "Not fixed", cls: "border-bad/50 text-bad" },
        ] as const).map((o) => (
          <button key={o.k} onClick={() => setSolved(o.k)} className={cx("rounded-lg border px-2 py-2 text-sm", solved === o.k ? `${o.cls} bg-panel-3` : "border-line-2 text-mute")}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="p-0.5">
            <Star className={cx("h-6 w-6", n <= rating ? "fill-warn text-warn" : "text-faint")} />
          </button>
        ))}
        <span className="ml-2 text-xs text-mute">quality of the work</span>
      </div>
      <textarea className="input mt-3 h-16 resize-none text-sm" placeholder="Optional: what changed, or what is still wrong?" value={comment} onChange={(e) => setComment(e.target.value)} />
      {msg && <p className="mt-2 text-sm text-bad">{msg}</p>}
      <button className="btn-primary mt-3 w-full" disabled={!solved || !rating || busy} onClick={send}>
        Submit verification
      </button>
    </div>
  );
}
