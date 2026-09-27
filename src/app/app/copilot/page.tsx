"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BrainCircuit, Send, Wrench } from "lucide-react";
import { api, useApi, useRegion } from "@/lib/client/hooks";
import { cx } from "@/components/ui";

type Step = { tool: string; args: Record<string, unknown>; resultPreview: string };
type Msg = { role: "user" | "assistant"; content: string; steps?: Step[]; provider?: string };

export default function CopilotPage() {
  const { code, region } = useRegion();
  const sugg = useApi<string[]>("/copilot/suggestions");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);
  useEffect(() => setMsgs([]), [code]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api<{ answer: string; steps: Step[]; provider: string }>(`/copilot?region=${code}`, { method: "POST", json: { question: q, history } });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, steps: r.steps, provider: r.provider }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-110px)] max-w-4xl flex-col">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BrainCircuit className="h-6 w-6 text-accent-2" /> Ask CivicPulse
        </h1>
        <p className="text-sm text-mute">
          A policy copilot for {region.name}. It answers only by calling the platform&apos;s analytics tools, so every number traces back to data. Tool calls are shown.
        </p>
      </div>
      <div className="card flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-2xl bg-accent-2/10 p-4"><BrainCircuit className="h-8 w-8 text-accent-2" /></div>
              <p className="max-w-md text-sm text-mute">Ask about hotspots, budget gaps, emerging outbreaks, impact of past projects, or how the BRICS pilot cities compare.</p>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {sugg.data?.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-2 bg-panel-2 px-3 py-1.5 text-xs text-ink hover:border-accent/50 hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {msgs.map((m, i) => (
              <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-accent/15 text-ink" : "border border-line bg-panel-2")}>
                  {m.role === "assistant" && m.steps && m.steps.length > 0 && (
                    <details className="mb-2 text-[11px] text-mute">
                      <summary className="flex cursor-pointer items-center gap-1.5">
                        <Wrench className="h-3 w-3" /> {m.steps.length} tool call{m.steps.length > 1 ? "s" : ""}: {m.steps.map((s) => s.tool).join(", ")}
                      </summary>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {m.steps.map((s, j) => (
                          <div key={j} className="rounded-lg bg-panel p-2 font-mono text-[10px] leading-4">
                            <span className="text-accent">{s.tool}</span>({JSON.stringify(s.args)}) → <span className="text-faint">{s.resultPreview.slice(0, 220)}…</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="prose-brief text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ sub: ({ children }) => <sub className="text-[10px] text-faint">{children}</sub> }}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                  {m.provider && <div className="mt-2 text-[10px] text-faint">answered by {m.provider}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="w-fit animate-pulse rounded-2xl border border-line bg-panel-2 px-4 py-3 text-sm text-mute">Querying analytics tools…</div>}
            <div ref={end} />
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex gap-2 border-t border-line p-3"
        >
          <input className="input" placeholder={`Ask about ${region.name}…`} value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn-primary" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
