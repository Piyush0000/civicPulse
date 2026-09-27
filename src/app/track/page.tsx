"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import PublicNav from "@/components/PublicNav";

export default function TrackIndex() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-md px-4 pt-16">
        <h1 className="text-3xl font-semibold">Track your request</h1>
        <p className="mt-1 text-sm text-mute">Enter the ID you received (e.g. CP-7F3K9Q). You can also send &quot;status CP-…&quot; to the Telegram bot or dial the USSD menu.</p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c) router.push(`/track/${c.startsWith("CP-") ? c : `CP-${c}`}`);
          }}
        >
          <input className="input font-mono text-lg uppercase" placeholder="CP-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary" aria-label="Track"><Search className="h-5 w-5" /></button>
        </form>
      </main>
    </div>
  );
}
