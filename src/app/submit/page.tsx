"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, LocateFixed, MapPin, Mic, Square, WifiOff, Camera, Image as ImageIcon } from "lucide-react";
import PublicNav from "@/components/PublicNav";
import { REGIONS, getRegion } from "@/lib/regions";
import { T, UI_LANGS, type UiLang } from "@/lib/client/i18n";
import { cx } from "@/components/ui";

type SpeechRec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; onerror: (() => void) | null };
type Queued = { id: string; region: string; text: string; transcript: string; language: string; lat?: number; lng?: number };

const QKEY = "cp_offline_queue";
const readQ = (): Queued[] => {
  try {
    return JSON.parse(localStorage.getItem(QKEY) || "[]");
  } catch {
    return [];
  }
};
const writeQ = (q: Queued[]) => {
  try {
    localStorage.setItem(QKEY, JSON.stringify(q));
  } catch {
    /* storage blocked */
  }
};

async function send(fd: FormData): Promise<string> {
  const res = await fetch("/api/v1/public/requests", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Failed");
  return data.tracking_code as string;
}

export default function SubmitPage() {
  const [lang, setLang] = useState<UiLang>("en");
  const [region, setRegion] = useState("IN-DL");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rec, setRec] = useState<{ blob: Blob; url: string; secs: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(32).fill(0.05));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const sr = useRef<SpeechRec | null>(null);
  const raf = useRef(0);
  const t = T[lang];
  const reg = getRegion(region);

  useEffect(() => {
    const nav = navigator.language.slice(0, 2) as UiLang;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (T[nav]) setLang(nav);
    const byLang: Record<string, string> = { mr: "IN-MH", ta: "IN-TN", bn: "IN-WB", te: "IN-TS" };
    if (byLang[nav]) setRegion(byLang[nav]);
  }, []);

  // Offline queue: flush whenever we come back online (PWA-style resilience for low connectivity).
  const flush = useCallback(async () => {
    const q = readQ();
    if (!q.length || !navigator.onLine) return;
    const left: Queued[] = [];
    for (const item of q) {
      const fd = new FormData();
      fd.set("region_code", item.region);
      fd.set("consent", "true");
      fd.set("text", item.text);
      fd.set("transcript", item.transcript);
      fd.set("language", item.language);
      fd.set("client_id", item.id);
      if (item.lat) fd.set("lat", String(item.lat));
      if (item.lng) fd.set("lng", String(item.lng));
      try {
        await send(fd);
      } catch {
        left.push(item);
      }
    }
    writeQ(left);
  }, []);
  useEffect(() => {
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  const startRec = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      m.ondataavailable = (e) => chunks.push(e.data);
      const started = Date.now();
      m.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        cancelAnimationFrame(raf.current);
        const blob = new Blob(chunks, { type: m.mimeType || "audio/webm" });
        setRec({ blob, url: URL.createObjectURL(blob), secs: Math.round((Date.now() - started) / 1000) });
        setRecording(false);
      };
      // live waveform
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const draw = () => {
        an.getByteFrequencyData(buf);
        setLevels(Array.from(buf).map((v) => Math.max(0.05, v / 255)));
        setSecs(Math.round((Date.now() - started) / 1000));
        if (Date.now() - started > 120000) m.stop();
        raf.current = requestAnimationFrame(draw);
      };
      draw();
      m.start();
      mr.current = m;
      setRecording(true);
      setRec(null);
      // Free browser speech recognition runs alongside, so voice works even without server STT keys.
      const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
      const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
      if (SR) {
        const s = new SR();
        s.lang = UI_LANGS.find((l) => l.code === lang)?.speech ?? "en-IN";
        s.continuous = true;
        s.interimResults = true;
        s.onresult = (e) => setTranscript(Array.from(e.results).map((r) => r[0].transcript).join(" "));
        s.onerror = () => undefined;
        s.start();
        sr.current = s;
      }
    } catch {
      setErr("Microphone not available. You can type instead.");
    }
  };
  const stopRec = () => {
    mr.current?.stop();
    sr.current?.stop();
  };

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, label: `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}` });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setErr("Could not get your location. Pick your neighbourhood instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const id = crypto.randomUUID();
    const fd = new FormData();
    fd.set("region_code", region);
    fd.set("consent", String(consent));
    fd.set("text", text);
    fd.set("transcript", transcript);
    fd.set("language", lang);
    fd.set("client_id", id);
    if (coords) {
      fd.set("lat", String(coords.lat));
      fd.set("lng", String(coords.lng));
    }
    if (photo) fd.set("photo", photo, photo.name);
    if (rec) fd.set("audio", rec.blob, "voice.webm");
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      setDone(await send(fd));
    } catch (e) {
      if (e instanceof TypeError) {
        writeQ([...readQ(), { id, region, text, transcript, language: lang, lat: coords?.lat, lng: coords?.lng }]);
        setQueued(true);
      } else setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Success code={done} lang={lang} onAgain={() => { setDone(null); setText(""); setRec(null); setTranscript(""); setCoords(null); }} />;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #0e2236 0%, var(--bg) 55%)" }}>
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <div className="mb-5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Language">
          {UI_LANGS.map((l) => (
            <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)} className={cx("rounded-full border px-3 py-1 text-sm", lang === l.code ? "border-accent bg-accent/15 text-accent" : "border-line-2 text-mute hover:text-ink")}>
              {l.label}
            </button>
          ))}
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{t.title}</h1>
        <p className="mt-2 text-mute">{t.subtitle}</p>

        {queued && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> {t.offlineQueued}
          </div>
        )}

        <div className="card mt-6 flex flex-col gap-5 p-5">
          <div>
            <label className="label" htmlFor="city">{t.city}</label>
            <select id="city" className="input" value={region} onChange={(e) => { setRegion(e.target.value); setCoords(null); }}>
              {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name} · {r.countryName}</option>)}
            </select>
          </div>

          {/* voice */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel-2 p-5">
            <button
              onClick={recording ? stopRec : startRec}
              className={cx("relative flex h-20 w-20 items-center justify-center rounded-full transition-transform active:scale-95", recording ? "bg-bad text-white" : "bg-accent text-[#04121a]")}
              aria-label={recording ? t.stop : t.record}
            >
              {recording && <span className="cp-ping absolute inset-0 rounded-full bg-bad/60" />}
              {recording ? <Square className="relative h-7 w-7" /> : <Mic className="h-8 w-8" />}
            </button>
            <div className="flex h-10 items-end gap-[3px]" aria-hidden>
              {levels.map((l, i) => (
                <span key={i} className={cx("w-1.5 rounded-full", recording ? "bg-bad" : "bg-line-2")} style={{ height: `${recording ? l * 100 : 12}%` }} />
              ))}
            </div>
            <div className="text-sm text-mute">{recording ? `${t.recording} ${secs}s / 120s` : rec ? `🎙 ${rec.secs}s` : t.record}</div>
            {rec && !recording && <audio controls src={rec.url} className="w-full" />}
            {transcript && (
              <div className="w-full rounded-lg bg-panel p-3 text-sm">
                <span className="text-xs text-faint">{t.heard}: </span>
                <span className="text-ink">{transcript}</span>
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="text">{t.describe}</label>
            <textarea id="text" className="input h-28 resize-none text-base" placeholder={t.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div>
            <div className="label">{t.location}</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost text-xs" onClick={locate} disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} {locating ? t.locating : t.useMyLocation}
              </button>
              <select
                className="input w-auto flex-1 text-xs"
                value={coords?.label ?? ""}
                onChange={(e) => {
                  const l = reg.localities.find((x) => x.name === e.target.value);
                  setCoords(l ? { lat: l.lat, lng: l.lng, label: l.name } : null);
                }}
                aria-label="Neighbourhood"
              >
                <option value="">— {reg.localName} —</option>
                {reg.localities.map((l) => <option key={l.name} value={l.name}>{l.local ? `${l.local} · ${l.name}` : l.name}</option>)}
              </select>
            </div>
            {coords && <div className="mt-2 flex items-center gap-1.5 text-xs text-ok"><MapPin className="h-3.5 w-3.5" /> {t.locationSet}: {coords.label}</div>}
          </div>

          <div>
            <div className="label">Photo (optional, helps officials verify)</div>
            <div className="flex gap-3">
              <label className="btn-ghost flex-1 cursor-pointer text-xs flex items-center justify-center gap-2">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }
                }} />
                <ImageIcon className="h-4 w-4" /> Upload from device
              </label>
              <label className="btn-ghost flex-1 cursor-pointer text-xs flex items-center justify-center gap-2">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }
                }} />
                <Camera className="h-4 w-4" /> Take a picture
              </label>
            </div>
            {photoPreview && <img src={photoPreview} alt="Preview" className="mt-3 max-h-48 rounded-xl object-cover" />}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-mute">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {t.consent}
          </label>
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn-primary py-3 text-base" onClick={submit} disabled={busy || !consent || (!text.trim() && !rec && !transcript)}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null} {busy ? t.sending : t.submit}
          </button>
          <p className="text-center text-xs text-faint">{t.privacy}</p>
        </div>
      </main>
    </div>
  );
}

function Success({ code, lang, onAgain }: { code: string; lang: UiLang; onAgain: () => void }) {
  const t = T[lang];
  const [copied, setCopied] = useState(false);
  const [st, setSt] = useState<{ pipelineStatus: string; categoryLabel: string | null; area: string | null; urgency: string | null; summary: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      for (let i = 0; i < 40 && alive; i++) {
        try {
          const r = await fetch(`/api/v1/public/requests/${code}`).then((x) => x.json());
          setSt(r);
          if (["completed", "failed"].includes(r.pipelineStatus)) return;
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    };
    void poll();
    return () => {
      alive = false;
    };
  }, [code]);
  const steps = ["received", "transcribed", "translated", "extracted", "geocoded", "completed"];
  const idx = st ? steps.indexOf(st.pipelineStatus) : 0;
  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #0b2a2a 0%, var(--bg) 55%)" }}>
      <PublicNav />
      <main className="mx-auto max-w-lg px-4 pt-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok/15"><Check className="h-8 w-8 text-ok" /></div>
        <h1 className="mt-4 text-3xl font-semibold">{t.thanks}</h1>
        <div className="card mt-6 p-5">
          <div className="text-xs uppercase tracking-wider text-mute">{t.yourCode}</div>
          <div className="mt-1 font-mono text-4xl font-semibold tracking-wider text-accent">{code}</div>
          <button className="btn-ghost mt-3 text-xs" onClick={() => { void navigator.clipboard.writeText(code); setCopied(true); }}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t.copied : t.copy}
          </button>
        </div>
        <div className="card mt-4 p-5 text-left">
          <div className="mb-3 flex gap-1">
            {steps.map((s, i) => <div key={s} className={cx("h-1.5 flex-1 rounded-full", i <= idx ? "bg-accent" : "bg-panel-3")} title={s} />)}
          </div>
          {st?.pipelineStatus === "completed" ? (
            <div className="text-sm">
              <div className="font-medium text-ink">{st.categoryLabel} · {st.urgency}{st.area ? ` · ${st.area}` : ""}</div>
              <div className="mt-1 text-mute">{st.summary}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-mute"><Loader2 className="h-4 w-4 animate-spin" /> AI: {st?.pipelineStatus ?? "received"}…</div>
          )}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/track/${code}`} className="btn-primary">{t.track}</Link>
          <button className="btn-ghost" onClick={onAgain}>{t.another}</button>
        </div>
      </main>
    </div>
  );
}
