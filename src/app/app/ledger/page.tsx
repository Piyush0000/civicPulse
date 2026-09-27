"use client";

import { Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useApi } from "@/lib/client/hooks";
import { Section, Spinner, cx } from "@/components/ui";

type Entry = { seq: number; user_email: string; region_code: string | null; action: string; entity_type: string; entity_id: string | null; diff: Record<string, unknown>; at: string; prev_hash: string; hash: string };

export default function LedgerPage() {
  const v = useApi<{ ok: boolean; count: number; brokenAt: number | null; head: string }>("/ledger/verify");
  const l = useApi<Entry[]>("/audit?limit=300");
  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><ShieldCheck className="h-6 w-6 text-ok" /> Decision ledger</h1>
        <p className="text-sm text-mute">
          Every analyst correction, weight change and policy decision is appended to a SHA-256 hash chain. Editing or deleting any past entry breaks every hash after it, and anyone can verify it on the public transparency page.
        </p>
      </div>
      {v.data && (
        <div className={cx("card flex flex-wrap items-center gap-4 p-4", v.data.ok ? "border-ok/40" : "border-bad/50")}>
          {v.data.ok ? <ShieldCheck className="h-8 w-8 text-ok" /> : <ShieldAlert className="h-8 w-8 text-bad" />}
          <div className="flex-1">
            <div className="font-medium text-ink">{v.data.ok ? `Chain intact: ${v.data.count} entries verified` : `Chain BROKEN at entry #${v.data.brokenAt}`}</div>
            <div className="font-mono text-[11px] text-faint">head {v.data.head}</div>
          </div>
          <button className="btn-ghost text-xs" onClick={() => v.reload()}>Re-verify</button>
        </div>
      )}
      <Section title="Entries">
        {!l.data && <Spinner />}
        <ol className="flex flex-col">
          {l.data?.map((e, i) => (
            <li key={e.seq} className="relative flex gap-3 pb-4">
              {i < (l.data?.length ?? 0) - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-line-2" />}
              <span className="z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-2 bg-panel-2"><Link2 className="h-3 w-3 text-accent" /></span>
              <div className="min-w-0 flex-1 rounded-xl border border-line bg-panel-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-ink">#{e.seq} · {e.action}</span>
                  <span className="text-mute">{e.user_email} · {e.region_code ?? "global"} · {new Date(e.at).toLocaleString()}</span>
                </div>
                {Object.keys(e.diff || {}).length > 0 && <pre className="mt-2 overflow-x-auto rounded-lg bg-panel p-2 text-[11px] text-mute">{JSON.stringify(e.diff)}</pre>}
                <div className="mt-2 break-all font-mono text-[10px] text-faint">prev {e.prev_hash.slice(0, 16)}… → hash {e.hash}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
