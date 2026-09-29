"use client";

import Link from "next/link";
import { useState } from "react";
import { Database, FileText, Phone, RadioTower, Send, Smartphone, Upload } from "lucide-react";
import { catLabel } from "@/lib/categories";
import { api, fmt, fmtCompact, useApi, useRegion } from "@/lib/client/hooks";
import { Section, Spinner, StatusBadge, cx } from "@/components/ui";

type DS = {
  counts: Record<string, number>;
  sources: { category: string; source: string; is_proxy: boolean; n: number; as_of: string }[];
  documents: { id: string; title: string; doc_type: string; published_date: string; is_synthetic: boolean; chars: number }[];
  projects: { external_ref: string; title: string; category: string; status: string; budget_amount: number; currency: string; admin_name: string; cells: number }[];
  catalogue: { name: string; source: string; license: string; refresh: string }[];
};
type Status = { providers: { llm: string[]; stt: string[]; telegram: string; realtime: string; database: string; embeddings: string; geocoder: string } };

const SAMPLE_CSV = `external_ref,title,category,status,budget_amount,lat,lng,radius_km
NEW-001,Community water ATM network,water_supply,approved,45000000,28.496,77.24,0.8`;

export default function DatasetsPage() {
  const { code, region } = useRegion();
  const d = useApi<DS>(`/datasets?region=${code}`, [code]);
  const st = useApi<Status>("/system/status");
  const [tab, setTab] = useState<"catalogue" | "projects" | "documents">("catalogue");
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Database className="h-6 w-6 text-accent" /> Data & channels</h1>
        <p className="text-sm text-mute">{region.name}: the datasets fused with citizen voice, and the channels citizens use. Everything runs on free or open infrastructure.</p>
      </div>
      {d.data && (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-7">
          {Object.entries(d.data.counts).map(([k, v]) => (
            <div key={k} className="card p-3">
              <div className="text-[10px] uppercase tracking-wider text-faint">{k}</div>
              <div className="font-mono text-lg text-ink">{fmt(v)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="card min-w-0">
          <div className="flex gap-1 border-b border-line px-3 pt-3 text-sm">
            {(["catalogue", "projects", "documents"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx("rounded-t-lg px-3 py-1.5 capitalize", tab === t ? "bg-panel-2 text-ink" : "text-mute")}>{t}</button>
            ))}
          </div>
          <div className="p-4">
            {!d.data && <Spinner />}
            {d.data && tab === "catalogue" && (
              <div className="flex flex-col gap-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-faint"><tr><th className="py-2">Dataset</th><th>Source (demo → production)</th><th>License</th><th>Refresh</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.data.catalogue.map((c) => (
                      <tr key={c.name}><td className="py-2 pr-3 text-ink">{c.name}</td><td className="pr-3 text-xs text-mute">{c.source}</td><td className="pr-3 text-xs text-mute">{c.license}</td><td className="text-xs text-mute">{c.refresh}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div>
                  <div className="label">Indicators per category</div>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {d.data.sources.map((s) => (
                      <div key={s.category + s.source} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs">
                        <span className="text-ink">{catLabel(s.category)}</span>
                        <span className={cx("truncate pl-3 text-right", s.is_proxy ? "text-warn" : "text-mute")}>{s.is_proxy ? "proxy · " : ""}{s.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {d.data && tab === "projects" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-faint"><tr><th className="py-2">Ref</th><th>Project</th><th>Category</th><th>Status</th><th className="text-right">Budget</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.data.projects.map((p) => (
                      <tr key={p.external_ref}>
                        <td className="py-2 font-mono text-xs text-faint">{p.external_ref}</td>
                        <td className="pr-3 text-ink">{p.title}</td>
                        <td className="text-xs text-mute">{catLabel(p.category)}</td>
                        <td><StatusBadge s={p.status} /></td>
                        <td className="text-right font-mono text-xs text-ink">{p.currency} {fmtCompact(p.budget_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {d.data && tab === "documents" && (
              <div className="flex flex-col gap-2">
                {d.data.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-line p-3 text-sm">
                    <FileText className="h-4 w-4 text-accent" />
                    <span className="flex-1 text-ink">{doc.title}</span>
                    <span className="chip">{doc.doc_type}</span>
                    {doc.is_synthetic && <span className="chip text-warn">synthetic</span>}
                    <span className="font-mono text-xs text-faint">{fmt(doc.chars)} chars</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Citizen channels">
            <div className="flex flex-col gap-2 text-sm">
              <Channel icon={<Send className="h-4 w-4" />} name="Telegram bot" state={st.data?.providers.telegram ?? "…"} note="Free. Set TELEGRAM_BOT_TOKEN (from @BotFather); polling mode needs no public URL." />
              <Channel icon={<RadioTower className="h-4 w-4" />} name="Web + voice (PWA)" state="on" note="/submit: record voice, pin location, 5 languages" href="/submit" />
              <Channel icon={<Smartphone className="h-4 w-4" />} name="USSD / SMS (feature phones)" state="simulator" note="Africa's Talking-compatible callback at /api/v1/intake/ussd" href="/ussd" />
              <Channel icon={<Phone className="h-4 w-4" />} name="IVR (phone call)" state="endpoint" note="POST /api/v1/intake/ivr with X-Intake-Key; test below" />
            </div>
          </Section>
          <IvrSimulator region={code} />
          <UploadBox region={code} onDone={() => d.reload()} />
        </div>
      </div>
    </div>
  );
}

function Channel({ icon, name, state, note, href }: { icon: React.ReactNode; name: string; state: string; note: string; href?: string }) {
  const on = !["disabled", "…"].includes(state);
  const body = (
    <div className="flex items-start gap-3 rounded-lg border border-line p-3 hover:border-line-2">
      <span className={cx("mt-0.5", on ? "text-accent" : "text-faint")}>{icon}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between"><span className="text-ink">{name}</span><span className={cx("font-mono text-[11px]", on ? "text-ok" : "text-warn")}>{state}</span></div>
        <div className="text-xs text-mute">{note}</div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function IvrSimulator({ region }: { region: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const send = async () => {
    const fd = new FormData();
    if (file) fd.append("audio", file);
    if (transcript) fd.append("transcript", transcript);
    try {
      const r = await api<{ tracking_code: string }>(`/datasets/ivr-test?region=${region}`, { method: "POST", body: fd });
      setOut(`Call logged as ${r.tracking_code}. Watch it land in the live feed.`);
    } catch (e) {
      setOut((e as Error).message);
    }
  };
  return (
    <Section title="IVR simulator">
      <p className="mb-2 text-xs text-mute">Upload a recorded call (wav/mp3/ogg). It is transcribed automatically when AI is online; otherwise paste a transcript.</p>
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-2 w-full text-xs text-mute file:mr-3 file:rounded-lg file:border-0 file:bg-panel-3 file:px-3 file:py-1.5 file:text-ink" />
      <textarea className="input mb-2 h-16 resize-none text-xs" placeholder="Optional transcript, e.g. 'Burari mein teen din se bijli nahi hai'" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
      <button className="btn-ghost w-full text-xs" onClick={send} disabled={!file && !transcript}><Phone className="h-4 w-4" /> Simulate call</button>
      {out && <p className="mt-2 text-xs text-accent">{out}</p>}
    </Section>
  );
}

function UploadBox({ region, onDone }: { region: string; onDone: () => void }) {
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [doc, setDoc] = useState({ title: "", content: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const upCsv = async () => {
    try {
      const r = await api<{ imported: number; errors: string[] }>(`/datasets/projects?region=${region}`, { method: "POST", body: csv, headers: { "content-type": "text/csv" } });
      setMsg(`Imported ${r.imported} projects${r.errors.length ? `; ${r.errors.join("; ")}` : ""}. Recompute scores to apply.`);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const upDoc = async () => {
    try {
      await api(`/datasets/documents?region=${region}`, { method: "POST", json: { title: doc.title, docType: "plan", content: doc.content } });
      setMsg("Document chunked, embedded and available to the brief generator (RAG).");
      setDoc({ title: "", content: "" });
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <Section title="Upload government data">
      <label className="label">Planned projects CSV</label>
      <textarea className="input mb-2 h-20 resize-none font-mono text-[11px]" value={csv} onChange={(e) => setCsv(e.target.value)} />
      <button className="btn-ghost mb-4 w-full text-xs" onClick={upCsv}><Upload className="h-4 w-4" /> Import projects</button>
      <label className="label">Plan / budget document (text)</label>
      <input className="input mb-2 text-xs" placeholder="Title" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
      <textarea className="input mb-2 h-20 resize-none text-xs" placeholder="Paste document text…" value={doc.content} onChange={(e) => setDoc({ ...doc, content: e.target.value })} />
      <button className="btn-ghost w-full text-xs" onClick={upDoc} disabled={!doc.title || doc.content.length < 50}><FileText className="h-4 w-4" /> Ingest for RAG</button>
      {msg && <p className="mt-2 text-xs text-accent">{msg}</p>}
    </Section>
  );
}
