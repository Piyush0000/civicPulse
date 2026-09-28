"use client";

import { use, useState } from "react";
import { Check, Loader2, Users } from "lucide-react";
import PublicNav from "@/components/PublicNav";
import { T, UI_LANGS, type UiLang } from "@/lib/client/i18n";
import { useApi, useInterval } from "@/lib/client/hooks";
import { CatBadge, ErrorBox, UrgencyBadge, cx } from "@/components/ui";

type Track = {
  trackingCode: string; region: string; category: string | null; categoryLabel: string | null; urgency: string | null; summary: string | null; area: string | null;
  status: string; pipelineStatus: string; failed: boolean; submittedAt: string; timeline: { step: keyof (typeof T)["en"]["steps"]; done: boolean }[]; neighboursReportingSame: number;
  photoUrl: string | null;
};

export default function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [lang, setLang] = useState<UiLang>("en");
  const t = T[lang];
  const d = useApi<Track>(`/public/requests/${code}`, [code]);
  useInterval(() => d.reload(), d.data && d.data.pipelineStatus !== "completed" ? 2000 : null);

  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {UI_LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} className={cx("rounded-full border px-2.5 py-0.5 text-xs", lang === l.code ? "border-accent text-accent" : "border-line-2 text-mute")}>{l.label}</button>
          ))}
        </div>
        <h1 className="text-2xl font-semibold">{t.trackTitle}</h1>
        <div className="mt-1 font-mono text-3xl text-accent">{code.toUpperCase()}</div>
        {d.error && <div className="mt-6"><ErrorBox msg={d.error} /></div>}
        {!d.data && !d.error && <Loader2 className="mt-6 h-6 w-6 animate-spin text-mute" />}
        {d.data && (
          <>
            <div className="card mt-6 p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
                {d.data.region} · {new Date(d.data.submittedAt).toLocaleString()}
              </div>
              {d.data.category && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <CatBadge c={d.data.category} lang={lang} />
                  <UrgencyBadge u={d.data.urgency} />
                  {d.data.area && <span className="chip">{d.data.area}</span>}
                </div>
              )}
              {d.data.summary && (() => {
                const cleanSummary = d.data.summary.replace(/\[Attached Photo\].*/g, "").trim();
                return (
                  <>
                    <p className="mt-3 text-ink">{cleanSummary}</p>
                    {d.data.photoUrl && (
                      <div className="mt-4">
                        <img src={d.data.photoUrl} alt="Attached" className="max-h-64 rounded-xl object-cover" />
                      </div>
                    )}
                  </>
                );
              })()}
              {d.data.neighboursReportingSame > 0 && (
                <p className="mt-3 flex items-center gap-2 text-sm text-accent"><Users className="h-4 w-4" /> {t.neighbours(d.data.neighboursReportingSame)}</p>
              )}
            </div>
            <ol className="mt-6 flex flex-col">
              {d.data.timeline.map((s, i) => (
                <li key={s.step} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < d.data!.timeline.length - 1 && <span className={cx("absolute left-[13px] top-7 h-full w-0.5", s.done ? "bg-accent" : "bg-line-2")} />}
                  <span className={cx("z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", s.done ? "border-accent bg-accent text-[#04121a]" : "border-line-2 bg-panel")}>
                    {s.done && <Check className="h-4 w-4" />}
                  </span>
                  <span className={cx("pt-0.5 text-base", s.done ? "text-ink" : "text-faint")}>{t.steps[s.step]}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}
