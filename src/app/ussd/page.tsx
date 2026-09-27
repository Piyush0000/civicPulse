"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import PublicNav from "@/components/PublicNav";
import { REGIONS } from "@/lib/regions";
import { cx } from "@/components/ui";

// A feature-phone simulator that talks to the real USSD gateway callback (Africa's Talking format).
// Billions of BRICS citizens still use feature phones; USSD needs no data plan and no smartphone.

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function UssdPage() {
  const [region, setRegion] = useState("IN-DL");
  const [phone] = useState(() => `+91 9${Math.floor(100000000 + Math.random() * 899999999)}`);
  const [session, setSession] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [screen, setScreen] = useState("Dial *123# to start");
  const [input, setInput] = useState("");
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const call = async (hist: string[], sid: string) => {
    setBusy(true);
    const res = await fetch("/api/v1/intake/ussd", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sid, phoneNumber: phone, text: hist.join("*"), serviceCode: "*123#", region }),
    });
    const txt = await res.text();
    setBusy(false);
    setScreen(txt.replace(/^(CON|END) /, ""));
    setEnded(txt.startsWith("END"));
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const dial = () => {
    const sid = `sim-${Date.now()}`;
    setSession(sid);
    setHistory([]);
    void call([], sid);
  };
  const sendInput = () => {
    if (!session || ended) return;
    const h = [...history, input];
    setHistory(h);
    void call(h, session);
  };
  const hang = () => {
    setSession(null);
    setScreen("Dial *123# to start");
    setEnded(false);
    setInput("");
  };
  useEffect(() => {
    if (ended) {
      const t = setTimeout(hang, 12000);
      return () => clearTimeout(t);
    }
  }, [ended]);

  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto grid max-w-5xl items-start gap-10 px-4 pb-16 pt-10 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Inclusion by design</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">No smartphone? No data? Dial *123#.</h1>
          <p className="mt-3 text-mute">
            USSD works on every GSM feature phone, over the voice network, with no internet. CivicPulse exposes a standard USSD gateway callback, so a
            ministry can plug in a gateway (in the pilot, an Africa&apos;s Talking-compatible format) and reach citizens who are invisible to app-based systems.
          </p>
          <label className="label mt-6" htmlFor="reg">Simulate a phone in</label>
          <select id="reg" className="input w-auto" value={region} onChange={(e) => { setRegion(e.target.value); hang(); }}>
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <p className="mt-3 text-xs text-faint">Your simulated number: {phone}. It is stored only as an HMAC pseudonym.</p>
        </div>
        <div className="mx-auto w-72 rounded-[2.5rem] border-4 border-[#2a3346] bg-gradient-to-b from-[#1b2233] to-[#0e131e] p-5 shadow-2xl">
          <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#2a3346]" />
          <div className="h-52 overflow-y-auto rounded-lg border-2 border-[#3a4a2a] bg-[#b9c99a] p-3 font-mono text-[13px] leading-5 text-[#1d2a12] shadow-inner">
            <div className="whitespace-pre-wrap">{busy ? "Connecting…" : screen}</div>
            {session && !ended && (
              <input
                ref={inputRef}
                className="mt-2 w-full border-b border-[#1d2a12]/50 bg-transparent font-mono outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInput()}
                aria-label="USSD input"
              />
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={session ? sendInput : dial} className="flex items-center justify-center gap-1 rounded-full bg-ok/80 py-2 text-sm font-semibold text-[#04121a]" aria-label={session ? "Send" : "Call *123#"}>
              <Phone className="h-4 w-4" /> {session ? "Send" : "*123#"}
            </button>
            <button onClick={hang} className="flex items-center justify-center rounded-full bg-bad/80 py-2 text-[#04121a]" aria-label="Hang up">
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                onClick={() => session && !ended && setInput((x) => x + k)}
                className={cx("rounded-xl bg-[#232c40] py-2.5 font-mono text-lg text-ink shadow active:translate-y-px", (!session || ended) && "opacity-60")}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] text-faint">Type free text with your keyboard in the screen field</p>
        </div>
      </main>
    </div>
  );
}
