"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { api } from "@/lib/client/hooks";
import { PulseLogo } from "@/components/AppShell";

const DEMO = [
  { email: "policy@civicpulse.local", role: "Policymaker", note: "decides on recommendations" },
  { email: "analyst@civicpulse.local", role: "Analyst", note: "curates requests & data" },
  { email: "admin@civicpulse.local", role: "Admin", note: "everything + users" },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/app";
  const [email, setEmail] = useState(DEMO[0].email);
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/auth/login", { method: "POST", json: { email, password } });
      router.push(next.startsWith("/") ? next : "/app");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-md p-7">
      <div className="mb-6 flex items-center gap-3">
        <PulseLogo size={36} />
        <div>
          <h1 className="text-xl font-semibold">Planner console</h1>
          <p className="text-xs text-mute">CivicPulse · open-source DPG for BRICS cities</p>
        </div>
      </div>
      <label className="label" htmlFor="email">Email</label>
      <input id="email" className="input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      <label className="label" htmlFor="pw">Password</label>
      <input id="pw" type="password" className="input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      {err && <p className="mb-3 text-sm text-bad">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        <LogIn className="h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="mt-6 border-t border-line pt-4">
        <p className="label">Demo accounts (password demo1234)</p>
        <div className="flex flex-col gap-1.5">
          {DEMO.map((d) => (
            <button
              type="button"
              key={d.email}
              onClick={() => setEmail(d.email)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${email === d.email ? "border-accent/50 bg-accent/10" : "border-line hover:bg-panel-2"}`}
            >
              <span className="font-medium text-ink">{d.role}</span>
              <span className="text-mute">{d.note}</span>
            </button>
          ))}
        </div>
      </div>
    </form>
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
