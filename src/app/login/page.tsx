"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, LogIn, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/client/hooks";
import { firebaseConfigured, googleIdToken } from "@/lib/client/firebase";
import { REGIONS } from "@/lib/regions";
import { PulseLogo } from "@/components/AppShell";
import { cx } from "@/components/ui";

const GOV_DEMO = [
  { email: "cm@civicpulse.local", role: "CM's Office", note: "approves projects" },
  { email: "mp@civicpulse.local", role: "MP / MLA", note: "endorses, runs what-if" },
  { email: "analyst@civicpulse.local", role: "Department", note: "curates data, reports work" },
  { email: "admin@civicpulse.local", role: "Admin", note: "everything" },
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [portal, setPortal] = useState<"gov" | "citizen">(sp.get("portal") === "citizen" ? "citizen" : "gov");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(portal === "gov" ? GOV_DEMO[0].email : "citizen@civicpulse.local");
  const [password, setPassword] = useState("demo1234");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("IN-DL");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchPortal = (p: "gov" | "citizen") => {
    setPortal(p);
    setMode("login");
    setErr(null);
    setEmail(p === "gov" ? GOV_DEMO[0].email : "citizen@civicpulse.local");
    setPassword("demo1234");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r =
        mode === "register"
          ? await api<{ redirect: string }>("/auth/register", { method: "POST", json: { name, email: email || undefined, phone: phone || undefined, password, region } })
          : await api<{ redirect: string }>("/auth/login", { method: "POST", json: { email, password, portal } });
      const next = sp.get("next");
      router.push(next && next.startsWith(r.redirect) ? next : r.redirect);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setErr(null);
    try {
      const idToken = await googleIdToken();
      const r = await api<{ redirect: string }>("/auth/google", { method: "POST", json: { idToken, region } });
      router.push(r.redirect);
    } catch (e) {
      const m = (e as Error).message;
      setErr(m.includes("popup-closed") ? "Google sign-in was cancelled" : m.includes("operation-not-allowed") ? "Google sign-in is not enabled in Firebase (Authentication → Sign-in method)" : m);
      setBusy(false);
    }
  };

  return (
    <div className="card w-full max-w-md overflow-hidden">
      <div className="grid grid-cols-2 border-b border-line text-sm" role="tablist">
        {([
          { k: "citizen", label: "Citizen", icon: <Users className="h-4 w-4" /> },
          { k: "gov", label: "Government", icon: <Landmark className="h-4 w-4" /> },
        ] as const).map((t) => (
          <button
            key={t.k}
            role="tab"
            aria-selected={portal === t.k}
            onClick={() => switchPortal(t.k)}
            className={cx("flex items-center justify-center gap-2 py-3 font-medium", portal === t.k ? "bg-panel-2 text-accent" : "text-mute hover:text-ink")}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="p-7">
        <div className="mb-6 flex items-center gap-3">
          <PulseLogo size={36} />
          <div>
            <h1 className="text-xl font-semibold">{portal === "gov" ? "Government console" : mode === "register" ? "Create citizen account" : "Citizen portal"}</h1>
            <p className="text-xs text-mute">
              {portal === "gov" ? "Provisioned accounts only · every action is recorded in the public ledger" : "Track your complaints and confirm when work is really done"}
            </p>
          </div>
        </div>
        {mode === "register" && (
          <>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <label className="label" htmlFor="phone">Mobile number</label>
            <input id="phone" className="input mb-3" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="10-digit mobile" />
            <label className="label" htmlFor="city">City</label>
            <select id="city" className="input mb-3" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </>
        )}
        <label className="label" htmlFor="email">{portal === "gov" ? "Official email" : mode === "register" ? "Email (optional)" : "Email or mobile"}</label>
        <input id="email" className="input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label className="label" htmlFor="pw">Password</label>
        <input id="pw" type="password" className="input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} />
        {err && <p className="mb-3 text-sm text-bad">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {mode === "register" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
        </button>

        {portal === "citizen" && firebaseConfigured && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-faint">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <button type="button" className="btn-ghost w-full" disabled={busy} onClick={google}>
              <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {portal === "citizen" && (
          <p className="mt-4 text-center text-sm text-mute">
            {mode === "login" ? "New here? " : "Already registered? "}
            <button type="button" className="text-accent hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setEmail(""); setPassword(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
            <span className="mt-2 block text-xs text-faint">No account needed to report. Accounts let you follow your complaints across devices.</span>
          </p>
        )}

        {portal === "gov" && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="label">Demo government accounts (password demo1234)</p>
            <div className="flex flex-col gap-1.5">
              {GOV_DEMO.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  onClick={() => { setEmail(d.email); setPassword("demo1234"); }}
                  className={cx("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors", email === d.email ? "border-accent/50 bg-accent/10" : "border-line hover:bg-panel-2")}
                >
                  <span className="font-medium text-ink">{d.role}</span>
                  <span className="text-mute">{d.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {portal === "citizen" && mode === "login" && <p className="mt-3 text-center text-[11px] text-faint">Demo citizen: citizen@civicpulse.local / demo1234</p>}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ background: "radial-gradient(ellipse at top, #0e2236 0%, var(--bg) 60%)" }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
